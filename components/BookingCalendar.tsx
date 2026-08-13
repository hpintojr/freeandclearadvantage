"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Confirmation = {
  bookingId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  durationMinutes: number;
  appointmentType: string;
  icsUrl: string | null;
  demoMode: boolean;
};

const timezone = "America/Los_Angeles";

/**
 * A confirmed booking must survive a refresh so the consumer cannot land back
 * on the slot grid and book a second appointment. Keyed by contact so a shared
 * device does not show one person's appointment to the next.
 */
function storageKey(contactId: string) {
  return `fca_booking_confirmation_${contactId || "preview"}`;
}

function readStoredConfirmation(contactId: string): Confirmation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(contactId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Confirmation;
    if (!parsed?.bookingId || !parsed.startTime) return null;
    // Drop a stale confirmation once the appointment itself has passed.
    if (new Date(parsed.endTime).getTime() < Date.now()) {
      window.sessionStorage.removeItem(storageKey(contactId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function BookingCalendar({ contactId, salesforceLeadId, firstName, demoMode }: { contactId: string; salesforceLeadId: string; firstName: string; demoMode: boolean }) {
  const [slots, setSlots] = useState<Record<string,string[]>>({});
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Restore before the first paint of the grid so a refreshed page never
  // flashes the booking options to someone who has already booked.
  useEffect(() => {
    setConfirmation(readStoredConfirmation(contactId));
    setRestoring(false);
  }, [contactId]);

  useEffect(() => {
    if (restoring || confirmation) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const startDate = new Date().toISOString().slice(0,10);
    fetch(`/api/booking/availability?startDate=${startDate}&timezone=${encodeURIComponent(timezone)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setSlots(data.slots || {});
        const first = Object.keys(data.slots || {}).sort()[0];
        if (first) setSelectedDate(first);
      })
      .catch((e) => { if (!cancelled) setMessage(e.message || "Unable to load availability."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [restoring, confirmation]);

  const dates = useMemo(() => Object.keys(slots).sort().slice(0,7), [slots]);
  const daySlots = selectedDate ? slots[selectedDate] || [] : [];

  const toDate = useCallback((iso: string) => (iso.includes("Z") || /[+-]\d\d:\d\d$/.test(iso) ? new Date(iso) : new Date(`${iso}-07:00`)), []);

  function labelDate(date: string) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone }).format(new Date(`${date}T12:00:00-07:00`));
  }
  function labelTime(iso: string) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(toDate(iso));
  }
  function labelFullDate(iso: string) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone }).format(toDate(iso));
  }
  /** "1:30 PM PDT" — the abbreviation resolves DST for us, so no hardcoded PST. */
  function labelTimeWithZone(iso: string) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: timezone }).format(toDate(iso));
  }

  async function book(startTime: string) {
    setMessage("");
    if (!contactId) {
      setMessage("This is sample availability. Connect the HighLevel location, contact integration, and appointment calendar to create live appointments.");
      return;
    }
    if (booking || confirmation) return; // guard against double taps

    setBooking(startTime);
    try {
      const normalized = toDate(startTime).toISOString();
      const response = await fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, salesforceLeadId, startTime: normalized, name: firstName }) });
      const data = await response.json();
      // A 409 or any failure leaves the grid on screen so another slot can be picked.
      if (!response.ok) throw new Error(data.error || "Unable to book that time.");

      const confirmed: Confirmation = {
        bookingId: data.bookingId,
        startTime: data.startTime || normalized,
        endTime: data.endTime || new Date(new Date(normalized).getTime() + 60 * 60_000).toISOString(),
        timezone: data.timezone || timezone,
        durationMinutes: data.durationMinutes || 60,
        appointmentType: data.appointmentType || "telephone",
        icsUrl: data.icsUrl || null,
        demoMode: Boolean(data.demoMode || demoMode),
      };
      setConfirmation(confirmed);
      try { window.sessionStorage.setItem(storageKey(contactId), JSON.stringify(confirmed)); } catch { /* private browsing — confirmation still shows for this view */ }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to book that time."); }
    finally { setBooking(""); }
  }

  // The section heading lives here rather than on the server-rendered page so
  // that a confirmed booking replaces the scheduling invitation too, not just
  // the slot grid.
  const schedulingHeader = (
    <>
      <p className="eyebrow">Prefer a scheduled time?</p>
      <h2>Book a one-hour consultation</h2>
      <p>One-hour telephone consultations are offered with start times every 30 minutes beginning at 9:00 AM Pacific. The final available start time is 5:30 PM, ending at 6:30 PM. A manager assigns each appointment to an available specialist.</p>
      {demoMode ? <div className="demo-note">Preview mode: a live HighLevel contact/calendar connection is not available yet, so the calendar below shows sample availability.</div> : null}
    </>
  );

  if (restoring) return <>{schedulingHeader}<div className="calendar-loading">Loading…</div></>;

  if (confirmation) {
    return (
      <div className="confirmation-card" role="status" aria-live="polite">
        <div className="confirmation-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <p className="eyebrow">Appointment confirmed</p>
        <h3>You&rsquo;re booked for a telephone consultation.</h3>

        <dl className="confirmation-details">
          <div><dt>Date</dt><dd>{labelFullDate(confirmation.startTime)}</dd></div>
          <div><dt>Time</dt><dd>{labelTimeWithZone(confirmation.startTime)} &ndash; {labelTimeWithZone(confirmation.endTime)}</dd></div>
          <div><dt>Length</dt><dd>{confirmation.durationMinutes} minutes</dd></div>
          <div><dt>Format</dt><dd>Telephone &mdash; a specialist will call you</dd></div>
        </dl>

        <p className="confirmation-note">A specialist will call the phone number you provided at the start of your appointment. You do not need to call in.</p>

        {confirmation.icsUrl ? (
          <>
          <a className="calendar-download" href={confirmation.icsUrl} download>
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: ".5rem", flex: "0 0 auto" }}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></svg>
            <span>Add to calendar</span>
          </a>
            <p className="microcopy center">Opens in Apple Calendar on iPhone and your calendar app on Android.</p>
          </>
        ) : null}

        {confirmation.demoMode ? <div className="demo-note">Preview mode: this confirmation is a sample. Connect the HighLevel calendar credentials to create live appointments.</div> : null}
      </div>
    );
  }

  if (loading) return <>{schedulingHeader}<div className="calendar-loading">Loading availability…</div></>;
  return <>{schedulingHeader}<div className="calendar-card">
    <div className="date-row">{dates.map((date) => <button key={date} className={date===selectedDate?"date-chip active":"date-chip"} onClick={() => setSelectedDate(date)}>{labelDate(date)}</button>)}</div>
    {daySlots.length ? <div className="slot-grid">{daySlots.map((slot) => <button key={slot} className="time-slot" disabled={Boolean(booking)} onClick={() => book(slot)}>{booking===slot?"Booking…":labelTime(slot)}</button>)}</div> : <p>No times are available on this date. Please choose another day or call us.</p>}
    {message && <div className="booking-message" role="status" aria-live="polite">{message}</div>}
    <p className="microcopy center">Consultations are 60-minute telephone appointments with available start times every 30 minutes from 9:00 AM through 5:30 PM Pacific. Your appointment is first routed to the manager, who assigns an available specialist.</p>
  </div></>;
}
"use client";

import { useEffect, useMemo, useState } from "react";

export default function BookingCalendar({ contactId, salesforceLeadId, firstName, demoMode }: { contactId: string; salesforceLeadId: string; firstName: string; demoMode: boolean }) {
  const [slots, setSlots] = useState<Record<string,string[]>>({});
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState("");
  const [message, setMessage] = useState("");
  const timezone = "America/Los_Angeles";

  useEffect(() => {
    const startDate = new Date().toISOString().slice(0,10);
    fetch(`/api/booking/availability?startDate=${startDate}&timezone=${encodeURIComponent(timezone)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSlots(data.slots || {});
        const first = Object.keys(data.slots || {}).sort()[0];
        if (first) setSelectedDate(first);
      })
      .catch((e) => setMessage(e.message || "Unable to load availability."))
      .finally(() => setLoading(false));
  }, []);

  const dates = useMemo(() => Object.keys(slots).sort().slice(0,7), [slots]);
  const daySlots = selectedDate ? slots[selectedDate] || [] : [];

  function labelDate(date: string) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: timezone }).format(new Date(`${date}T12:00:00-07:00`));
  }
  function labelTime(iso: string) {
    const d = iso.includes("Z") || /[+-]\d\d:\d\d$/.test(iso) ? new Date(iso) : new Date(`${iso}-07:00`);
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(d);
  }

  async function book(startTime: string) {
    setMessage("");
    if (!contactId) {
      setMessage("This is sample availability. Connect the HighLevel location, contact integration, and appointment calendar to create live appointments.");
      return;
    }

    setBooking(startTime);
    try {
      const normalized = startTime.includes("Z") || /[+-]\d\d:\d\d$/.test(startTime) ? new Date(startTime).toISOString() : new Date(`${startTime}-07:00`).toISOString();
      const response = await fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, salesforceLeadId, startTime: normalized, name: firstName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to book that time.");
      setMessage(data.demoMode || demoMode ? "Preview booking saved for this demo. Connect the GHL calendar credentials to create live appointments." : `You’re booked for ${labelDate(selectedDate)} at ${labelTime(startTime)}. We’ll send confirmation details shortly.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to book that time."); }
    finally { setBooking(""); }
  }

  if (loading) return <div className="calendar-loading">Loading availability…</div>;
  return <div className="calendar-card">
    <div className="date-row">{dates.map((date) => <button key={date} className={date===selectedDate?"date-chip active":"date-chip"} onClick={() => setSelectedDate(date)}>{labelDate(date)}</button>)}</div>
    {daySlots.length ? <div className="slot-grid">{daySlots.map((slot) => <button key={slot} className="time-slot" disabled={booking===slot} onClick={() => book(slot)}>{booking===slot?"Booking…":labelTime(slot)}</button>)}</div> : <p>No times are available on this date. Please choose another day or call us.</p>}
    {message && <div className="booking-message">{message}</div>}
    <p className="microcopy center">Consultations are 60-minute telephone appointments with available start times every 30 minutes from 9:00 AM through 5:30 PM Pacific. Your appointment is first routed to the manager, who assigns an available specialist.</p>
  </div>;
}
