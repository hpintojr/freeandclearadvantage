export const siteConfig = {
  name: "Free & Clear Advantage",
  description:
    "Request information about debt-relief options and speak with a specialist.",
  callPhone: process.env.NEXT_PUBLIC_CALL_PHONE || "(949) 669-5546",
  callPhoneE164: process.env.NEXT_PUBLIC_CALL_PHONE_E164 || "+19496695546",
  timezone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Los_Angeles",
  privacyEmail:
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@freeandclearadvantage.com",
};

export const consentVersion = "2026-08-12-v2-optional-contact-consent";
