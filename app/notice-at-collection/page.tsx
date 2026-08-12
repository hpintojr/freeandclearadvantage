import Link from "next/link";

export default function NoticeAtCollectionPage() {
  return (
    <article className="legal-page">
      <p className="eyebrow">Privacy</p>
      <h1>Notice at Collection</h1>
      <p className="updated">Draft for launch review • August 12, 2026</p>
      <p>
        This notice describes the categories of personal information Free & Clear Advantage may collect through this website and the purposes for which we use that information. Please review our <Link href="/privacy">Privacy Policy</Link> for additional details.
      </p>

      <h2>Categories we may collect</h2>
      <p>
        We may collect identifiers and contact information such as your name, email address, telephone number, mailing address, ZIP code, state, and date of birth; information about the request you submit, such as estimated debt amount, debt types, employment status, and payment status; consent and communication records; and internet or device information such as IP address, browser/device information, referring source, and campaign parameters.
      </p>

      <h2>Purposes of collection and use</h2>
      <p>
        We use this information to process and respond to your request, evaluate which potential services or providers may be relevant, communicate with you when you have provided the required consent, schedule consultations, route your request through configured CRM and service systems, maintain consent and compliance records, prevent abuse or fraud, measure site performance and campaign effectiveness, and satisfy legal or regulatory obligations.
      </p>

      <h2>Disclosure to service providers and participating providers</h2>
      <p>
        Information may be disclosed to technology and CRM service providers acting for us and, when appropriate to fulfill your request and permitted by law, to participating service providers. Before production launch, Free & Clear Advantage must determine whether any planned advertising, analytics, referral, or partner-transfer activity constitutes a “sale” or “sharing” under applicable state privacy law and implement any required opt-out mechanism before that activity begins.
      </p>

      <h2>Retention</h2>
      <p>
        We intend to retain information only as long as reasonably necessary for the purposes described above, including consent, compliance, dispute, fraud-prevention, and legal recordkeeping. The final production policy must state or describe the applicable retention criteria for each required category.
      </p>

      <div className="legal-note">
        <strong>Launch requirement:</strong> This is a compliance-oriented draft, not legal advice. Counsel should confirm whether Free & Clear Advantage is subject to the CCPA/CPRA or other state privacy laws, the precise categories collected, whether any transfer is a sale or sharing, applicable sensitive-information rules, and the final retention language before production.
      </div>
    </article>
  );
}
