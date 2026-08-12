import { siteConfig } from "@/lib/config";

export default function PrivacyChoicesPage() {
  return <article className="legal-page">
    <p className="eyebrow">Privacy</p><h1>Your Privacy Choices</h1>
    <p>If applicable to your jurisdiction, you may request access, correction, deletion, or portability of certain personal information, or request to opt out of sale, sharing, or targeted advertising. You may also ask questions about how your information is used.</p>
    <div className="info-card tinted"><h2>Submit a request</h2><p>Email <a href={`mailto:${siteConfig.privacyEmail}?subject=Privacy%20Request`}>{siteConfig.privacyEmail}</a> with the subject “Privacy Request.” Please do not send Social Security numbers, bank account numbers, or passwords. We may need to verify your identity before completing a request.</p></div>
    <p>This page is intentionally owned by Free & Clear Advantage. Do not send Free & Clear Advantage consumer requests through another company’s TrustArc form or privacy portal.</p>
  </article>;
}
