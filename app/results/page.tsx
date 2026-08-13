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
  const contactId = typeof params.contactId === "string" ? params.contactId : "";
  const salesforceLeadId = typeof params.salesforceLeadId === "string" ? params.salesforceLeadId : "";
  const demo = params.demo === "1";

  return (
    <section className="results-shell">
      <div className="success-icon">✓</div>
      <p className="eyebrow">Request received</p>
      <h1>Good news, {firstName} — based on your answers, you may qualify.</h1>
      <p className="results-subtitle">A specialist can review your information, explain which options may be available, and answer your questions. Nothing is automatic and there is no obligation to enroll.</p>
      {debt ? <div className="result-pill">Estimated debt: ${debt.toLocaleString()}</div> : null}
      <a className="call-cta" href={`tel:${siteConfig.callPhoneE164}`} aria-label={`Call ${siteConfig.callPhone}`}>
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: ".55rem", flex: "0 0 auto" }}
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.62a2 2 0 0 1-.45 2.11L8 9.88a16 16 0 0 0 6.12 6.12l1.43-1.23a2 2 0 0 1 2.11-.45c.84.29 1.72.5 2.62.62A2 2 0 0 1 22 16.92z" />
        </svg>
        <span>Call Now — {siteConfig.callPhone}</span>
      </a>
      <p className="microcopy center">The initial consultation is free. Program costs, if any, are disclosed by the provider before enrollment.</p>

      <div className="result-grid">
        <div className="info-card tinted"><h2>Have this ready when you call</h2><ul><li>A rough total of your unsecured debt</li><li>Creditor or lender names</li><li>Your approximate monthly income and major expenses</li><li>Whether any accounts are past due or in collections</li></ul></div>
        <div className="info-card"><h2>What happens on the call</h2><ul><li>A specialist reviews a few details about your situation</li><li>You hear which programs or next steps may fit</li><li>You can ask questions before making any decision</li><li>You decide what to do next — nothing is automatic</li></ul></div>
      </div>

      <div className="booking-section">
        <p className="eyebrow">Prefer a scheduled time?</p><h2>Book a one-hour consultation</h2><p>One-hour telephone consultations are offered with start times every 30 minutes beginning at 9:00 AM Pacific. The final available start time is 5:30 PM, ending at 6:30 PM. A manager assigns each appointment to an available specialist.</p>
        {(demo || !contactId) && <div className="demo-note">Preview mode: a live HighLevel contact/calendar connection is not available yet, so the calendar below shows sample availability.</div>}
        <BookingCalendar contactId={contactId} salesforceLeadId={salesforceLeadId} firstName={firstName} demoMode={demo || !contactId} />
      </div>
    </section>
  );
}

export default function ResultsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  return <Suspense fallback={<div className="results-shell">Loading your results…</div>}><ResultsContent searchParams={searchParams} /></Suspense>;
}
