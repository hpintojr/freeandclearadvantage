import {
  addContactToGhlWorkflow,
  addGhlContactTags,
  createAppointmentOpportunity,
  getGhlAppointment,
  getGhlUsers,
  updateAppointmentOpportunity,
  updateGhlAppointment,
} from "./ghl";
import {
  deleteSalesforceAppointmentEvent,
  getSalesforceAppointmentEvents,
  getSalesforceCallActivities,
  getSalesforceLeadStates,
  updateSalesforceAppointmentEvent,
} from "./salesforce";

const APPOINTMENT_MARKER = /\[GHL:([^\]]+)\]/;
// GHL rejects any assignee other than the owner of a personal calendar. Matched
// so the expected pre-cutover rejection can be separated from real failures.
const CALENDAR_TEAM_REJECTION = /not part of calendar team/i;
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);
const OVERDUE_MARKER = "[FCA:OVERDUE_QUEUED]";
const APPOINTMENT_STATUS = "application pending";
const APPOINTMENT_SUB_STATUS = "appointment set to finish application";

function time(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameInstant(left: string | undefined, right: string | undefined) {
  return Boolean(left && right) && Math.abs(time(left) - time(right)) < 1000;
}

function appointmentUpdatedAt(appointment: { updatedAt?: string; dateUpdated?: string; dateAdded?: string }) {
  return time(appointment.updatedAt || appointment.dateUpdated || appointment.dateAdded);
}

export async function syncAppointments() {
  const [events, users] = await Promise.all([getSalesforceAppointmentEvents(), getGhlUsers()]);
  const leadIds = events.map((event) => event.WhoId || "").filter(Boolean);
  const oldestRelevant = new Date(
    Math.min(Date.now(), ...events.map((event) => time(event.StartDateTime)).filter(Boolean)) - 15 * 60 * 1000,
  )
    .toISOString()
    .replace(".000", "");
  const [leadStates, callActivities] = await Promise.all([
    getSalesforceLeadStates(leadIds),
    getSalesforceCallActivities(leadIds, oldestRelevant),
  ]);
  const leadsById = new Map(leadStates.map((lead) => [lead.Id, lead]));
  const defaultUserId = process.env.GHL_DEFAULT_ASSIGNED_USER_ID || "8tTyPhJCYmCqsCFvaiq6";
  const overdueAfterMinutes = Math.max(5, Number(process.env.APPOINTMENT_OVERDUE_AFTER_MINUTES || "5"));
  const overdueMaxAgeMinutes = Math.max(
    overdueAfterMinutes,
    Number(process.env.APPOINTMENT_OVERDUE_MAX_AGE_MINUTES || "120"),
  );
  const results = {
    examined: 0,
    updatedGhl: 0,
    updatedSalesforce: 0,
    opportunities: 0,
    overdueEligible: 0,
    overdueQueued: 0,
    overdueSkippedNoWorkflow: 0,
    assignmentBlocked: [] as string[],
    errors: [] as string[],
  };

  for (const event of events) {
    const appointmentId = event.Subject?.match(APPOINTMENT_MARKER)?.[1];
    if (!appointmentId) continue;
    results.examined += 1;

    try {
      const appointment = await getGhlAppointment(appointmentId);
      if (!appointment?.id) throw new Error("GHL appointment response did not include an ID.");

      if (event.IsDeleted) {
        if (!CANCELLED_STATUSES.has((appointment.appointmentStatus || "").toLowerCase())) {
          await updateGhlAppointment(appointmentId, { appointmentStatus: "cancelled" });
          results.updatedGhl += 1;
        }
        continue;
      }

      if (CANCELLED_STATUSES.has((appointment.appointmentStatus || "").toLowerCase())) {
        await deleteSalesforceAppointmentEvent(event.Id);
        results.updatedSalesforce += 1;
        continue;
      }

      const ghlUser = users.find(
        (user) => user.email?.trim().toLowerCase() === event.Owner?.Email?.trim().toLowerCase(),
      );
      const timeChanges: Record<string, string> = {};

      const timesDiffer =
        !sameInstant(event.StartDateTime, appointment.startTime) ||
        !sameInstant(event.EndDateTime, appointment.endTime);
      if (timesDiffer) {
        const salesforceIsNewer = time(event.LastModifiedDate) >= appointmentUpdatedAt(appointment);
        if (salesforceIsNewer && event.StartDateTime && event.EndDateTime) {
          timeChanges.startTime = event.StartDateTime;
          timeChanges.endTime = event.EndDateTime;
        } else if (appointment.startTime && appointment.endTime) {
          await updateSalesforceAppointmentEvent(event.Id, {
            StartDateTime: appointment.startTime,
            EndDateTime: appointment.endTime,
          });
          results.updatedSalesforce += 1;
        }
      }

      if (Object.keys(timeChanges).length) {
        await updateGhlAppointment(appointmentId, timeChanges);
        results.updatedGhl += 1;
      }

      // The manager hands an appointment off by reassigning the Salesforce
      // Event. Push that owner onto the GHL appointment itself, not just the
      // opportunity — otherwise the appointment stays with the manager forever
      // and any workflow keyed on its assigned user never fires, so the agent
      // is never notified.
      //
      // This is a SEPARATE call from the reschedule above, and its failure is
      // caught rather than allowed to escape. The booking calendar is personal
      // to one user, so GHL answers 422 "The user id not part of calendar team"
      // for every other assignee, on every run. When that rejection was allowed
      // to propagate it aborted the whole iteration, so the opportunity
      // assignment and the overdue-call path below — the parts that do reach the
      // agent — silently stopped running for any appointment awaiting handoff.
      // Bundling assignment into the same PUT as a reschedule also meant one
      // rejected assignee discarded a legitimate time change.
      if (ghlUser?.id && ghlUser.id !== appointment.assignedUserId) {
        try {
          await updateGhlAppointment(appointmentId, { assignedUserId: ghlUser.id });
          results.updatedGhl += 1;
        } catch (assignmentError) {
          const message =
            assignmentError instanceof Error ? assignmentError.message : "Unknown assignment error";
          if (CALENDAR_TEAM_REJECTION.test(message)) {
            // Expected until the booking calendar is replaced with a team
            // calendar. Reported separately so it stays visible without
            // masquerading as a new failure every minute.
            results.assignmentBlocked.push(`${appointmentId}: ${message}`);
          } else {
            results.errors.push(`${appointmentId}: appointment assignment failed: ${message}`);
          }
        }
      }

      let opportunity = await updateAppointmentOpportunity(appointmentId, appointment.contactId, {
        assignedTo: ghlUser?.id,
        stageName: ghlUser?.id && ghlUser.id !== defaultUserId ? "Assigned" : undefined,
      });
      if (!opportunity && appointment.contactId) {
        opportunity = await createAppointmentOpportunity({
          appointmentId,
          contactId: appointment.contactId,
          consumerName: appointment.title || "Consumer",
          assignedUserId: ghlUser?.id || appointment.assignedUserId || defaultUserId,
        });
      }
      if (opportunity) results.opportunities += 1;

      const lead = event.WhoId ? leadsById.get(event.WhoId) : undefined;
      const startTime = time(event.StartDateTime);
      const minutesPastStart = startTime ? (Date.now() - startTime) / 60_000 : -1;
      const stillAwaitingConsultation =
        lead?.Status?.trim().toLowerCase() === APPOINTMENT_STATUS &&
        lead?.Sub_Status__c?.trim().toLowerCase() === APPOINTMENT_SUB_STATUS;
      const callWasLogged = callActivities.some((activity) => {
        if (!event.WhoId || activity.WhoId !== event.WhoId) return false;
        const created = time(activity.CreatedDate);
        if (!created || created < startTime - 15 * 60 * 1000) return false;
        return activity.Status?.toLowerCase() === "completed" || Boolean(activity.CallDisposition);
      });
      const isEligibleForOverdueCall =
        Boolean(lead) &&
        lead?.LeadSource?.trim().toLowerCase() === "f&c-website" &&
        !lead?.DNC__c &&
        stillAwaitingConsultation &&
        !callWasLogged &&
        minutesPastStart >= overdueAfterMinutes &&
        minutesPastStart <= overdueMaxAgeMinutes &&
        !event.Description?.includes(OVERDUE_MARKER);

      if (isEligibleForOverdueCall && appointment.contactId) {
        results.overdueEligible += 1;
        const workflowId = process.env.GHL_OVERDUE_WORKFLOW_ID?.trim();
        if (!workflowId) {
          results.overdueSkippedNoWorkflow += 1;
          continue;
        }

        const previousDescription = event.Description || "";
        await updateSalesforceAppointmentEvent(event.Id, {
          Description: [previousDescription.trim(), OVERDUE_MARKER].filter(Boolean).join(" "),
        });
        try {
          await addGhlContactTags(appointment.contactId, ["F&C-Website", "f&c-appointment-overdue"]);
          await addContactToGhlWorkflow(appointment.contactId, workflowId);
          results.overdueQueued += 1;
          try {
            await updateAppointmentOpportunity(appointmentId, appointment.contactId, {
              stageName: process.env.GHL_OVERDUE_STAGE_NAME || "Overdue - Call Queued",
            });
          } catch (stageError) {
            results.errors.push(
              `${appointmentId}: overdue call queued, but pipeline stage update failed: ${stageError instanceof Error ? stageError.message : "Unknown error"}`,
            );
          }
        } catch (workflowError) {
          await updateSalesforceAppointmentEvent(event.Id, { Description: previousDescription });
          throw workflowError;
        }
      }
    } catch (error) {
      results.errors.push(
        `${appointmentId}: ${error instanceof Error ? error.message : "Unknown appointment sync error"}`,
      );
    }
  }

  return results;
}
