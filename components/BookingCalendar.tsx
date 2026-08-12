"use client";

import { useEffect, useMemo, useState } from "react";

export default function BookingCalendar({ contactId, firstName, demoMode }: { contactId: string; firstName: string; demoMode: boolean }) {
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
      setMessage("This is sample availability. Connect the HighLevel location, contact integration, and round-robin calendar to create live appointments.");
      return;
    }

    setBooking(startTime);
    try {
      const normalized = startTime.includes("Z") || /[+-]\d\d:\d\d$/.test(startTime) ? new Date(startTime).toISOString() : new Date(`${startTime}-07:00`).toISOString();
      const response = await fetch("/api/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, startTime: normalized, name: firstName }) });
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
    <p className="microcopy center">Configure the HighLevel calendar as Round Robin, set the appointment duration to 60 minutes, and set Appointments Per Slot to 5. Add enough eligible team members to staff the five concurrent consultations you want available at each time.</p>
  </div>;
}
