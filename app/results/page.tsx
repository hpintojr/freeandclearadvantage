import { Suspense } from "react";
import BookingCalendar from "@/components/BookingCalendar";
import { siteConfig } from "@/lib/config";

function ResultsContent({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  return <AsyncResults searchParams={searchParams} />;
}

async function AsyncResults({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const firstName = typeof params.firstName === "string" ? params.firstName : "there";
  const debt = typeof params.debt === "string" ? Number(params.debt) : undefined;
  const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
  const leadId = typeof params.leadId === "string" ? params.leadId : "";
  const demo = params.demo === "1";

  return (
    <section className="results-shell">
      <div className="success-icon">✓</div>
      <p className="eyebrow">Request received</p>
      <h1>Good news, {firstName} — based on your answers, you may qualify.</h1>
      <p className="results-subtitle">A specialist can review your information, explain which options may be available, and answer your questions. Nothing is automatic and there is no obligation to enroll.</p>
      {debt ? <div className="result-pill">Estimated debt: ${debt.toLocaleString()}</div> : null}
      <a className="call-cta" href={`tel:${siteConfig.callPhoneE164}`}>☎ Call Now — {siteConfig.callPhone}</a>
      <p className="microcopy center">The initial consultation is free. Program costs, if any, are disclosed by the provider before enrollment.</p>

      <div className="result-grid">
        <div className="info-card tinted"><h2>Have this ready when you call</h2><ul><li>A rough total of your unsecured debt</li><li>Creditor or lender names</li><li>Your approximate monthly income and major expenses</li><li>Whether any accounts are past due or in collections</li></ul></div>
        <div className="info-card"><h2>What happens on the call</h2><ul><li>A specialist reviews a few details about your situation</li><li>You hear which programs or next steps may fit</li><li>You can ask questions before making any decision</li><li>You decide what to do next — nothing is automatic</li></ul></div>
      </div>

      <div className="booking-section">
        <p className="eyebrow">Prefer a scheduled time?</p><h2>Book a one-hour consultation</h2><p>Appointments are offered between 9:30 AM and 5:00 PM Pacific. Live availability is pulled from our HighLevel round-robin calendar when connected.</p>
        {demo && <div className="demo-note">Preview mode: CRM credentials are not connected yet, so the calendar below shows sample availability.</div>}
        <BookingCalendar contactId={contactId || leadId} firstName={firstName} demoMode={demo || !contactId} />
      </div>
    </section>
  );
}

export default function ResultsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  return <Suspense fallback={<div className="results-shell">Loading your results…</div>}><ResultsContent searchParams={searchParams} /></Suspense>;
}
