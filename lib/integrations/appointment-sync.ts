import {
  createAppointmentOpportunity,
  getGhlAppointment,
  getGhlUsers,
  updateAppointmentOpportunity,
  updateGhlAppointment,
} from "./ghl";
import {
  deleteSalesforceAppointmentEvent,
  getSalesforceAppointmentEvents,
  updateSalesforceAppointmentEvent,
} from "./salesforce";

const APPOINTMENT_MARKER = /\[GHL:([^\]]+)\]/;
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);

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
  const defaultUserId = process.env.GHL_DEFAULT_ASSIGNED_USER_ID || "8tTyPhJCYmCqsCFvaiq6";
  const results = { examined: 0, updatedGhl: 0, updatedSalesforce: 0, opportunities: 0, errors: [] as string[] };

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
      const ghlChanges: Record<string, string> = {};
      if (ghlUser?.id && ghlUser.id !== appointment.assignedUserId) ghlChanges.assignedUserId = ghlUser.id;

      const timesDiffer =
        !sameInstant(event.StartDateTime, appointment.startTime) ||
        !sameInstant(event.EndDateTime, appointment.endTime);
      if (timesDiffer) {
        const salesforceIsNewer = time(event.LastModifiedDate) >= appointmentUpdatedAt(appointment);
        if (salesforceIsNewer && event.StartDateTime && event.EndDateTime) {
          ghlChanges.startTime = event.StartDateTime;
          ghlChanges.endTime = event.EndDateTime;
        } else if (appointment.startTime && appointment.endTime) {
          await updateSalesforceAppointmentEvent(event.Id, {
            StartDateTime: appointment.startTime,
            EndDateTime: appointment.endTime,
          });
          results.updatedSalesforce += 1;
        }
      }

      if (Object.keys(ghlChanges).length) {
        await updateGhlAppointment(appointmentId, ghlChanges);
        results.updatedGhl += 1;
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
    } catch (error) {
      results.errors.push(
        `${appointmentId}: ${error instanceof Error ? error.message : "Unknown appointment sync error"}`,
      );
    }
  }

  return results;
}
