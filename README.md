# Free & Clear Advantage

Mobile-first debt-relief lead funnel for `freeandclearadvantage.com`, built with Next.js 16 and intended for Vercel.

## Funnel

1. Debt amount
2. State
3. Employment status
4. Debt types
5. Monthly payment status
6. Name
7. Email
8. Google-assisted mailing address + hidden city + ZIP (with manual fallback)
9. Date of birth
10. Phone + optional express contact consent
11. Results page with call CTA and booking calendar

The result page deliberately says **“based on your answers, you may qualify”** rather than making a guaranteed qualification claim.

## CRM routing

`POST /api/lead` can send the same lead to HighLevel, Salesforce, or both.

- HighLevel: native API with `GHL_ACCESS_TOKEN` + `GHL_LOCATION_ID`, or a workflow webhook using `GHL_INBOUND_WEBHOOK_URL`.
- Salesforce: native REST Lead creation using the configured Salesforce integration.
- If no CRM credentials are present, the site runs in preview/demo mode and does not persist the lead.

Custom CRM fields are environment-configurable. Verify all HighLevel custom-field IDs before production. The form records the consumer’s contact-consent choice, timestamp, and disclosure version when the corresponding CRM fields are configured. If the optional contact-consent box is not selected, the native HighLevel integration sets DND.

Address autocomplete uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Server-side address validation uses `GOOGLE_ADDRESS_VALIDATION_API_KEY`; a Google outage does not block lead submission, and the selected/manual address remains the fallback.

## Booking / HighLevel round robin

The custom results-page calendar reads live availability from the HighLevel calendar API and creates the appointment back in HighLevel when credentials are present.

Booking start times are **9:00 AM through 5:30 PM Pacific**, with **60-minute consultations** and **30-minute start intervals**. The final 5:30 PM appointment ends at 6:30 PM.

For a hard cap of **five simultaneous active consultations**, configure one HighLevel **Round Robin** calendar with exactly **five eligible team members**, appointment duration **60 minutes**, slot interval **30 minutes**, and **Appointments Per Slot = 1 per team member**. Because appointments last one hour while starts are offered every 30 minutes, HighLevel availability must remain the source of truth: if all five team members are occupied by earlier appointments, the overlapping half-hour start should not be shown as available. Do not set Appointments Per Slot to 5 on each user if the intent is five total simultaneous consultations.

The preview schedule uses 9:00, 9:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30, 1:00, 1:30, 2:00, 2:30, 3:00, 3:30, 4:00, 4:30, 5:00, and 5:30 PM. Once HighLevel is connected, its actual calendar availability is the source of truth.

## Compliance / legal review before launch

The repository includes original draft Privacy Policy, Notice at Collection, Terms of Use, Privacy Choices page, footer disclosures, and phone-step consent language. They are not copied from Forbes Advisor or another advertiser.

Before production, confirm with counsel:

- Exact legal entity name, physical/business address, privacy contact, and all state-specific registrations/licensing disclosures.
- Whether Free & Clear Advantage is a marketing/referral service, direct provider, or both; adjust footer/legal text to match reality.
- Which parties are authorized to call/text. The current optional contact consent is specific to **Free & Clear Advantage**. If third-party providers will independently place automated/prerecorded/AI marketing calls or texts, add compliant party-specific consent at the correct point in the flow rather than silently expanding this disclosure.
- All debt-relief advertising claims and substantiation. Do not use guaranteed savings, guaranteed approval/qualification, or claims such as “get rid of all your debt” without appropriate legal review and substantiation.
- Required Telemarketing Sales Rule disclosures before enrollment, including timing, cost, negative consequences, and dedicated-account disclosures when applicable.
- Cookie/analytics/ad pixels, state privacy notices, Notice at Collection, opt-out mechanisms, retention periods, and request-verification workflow.

The TrustArc URL supplied as a design reference belongs to another brand. Do **not** route Free & Clear Advantage privacy requests through that third-party form.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Vercel

Import the GitHub repository into Vercel, then add the environment variables from `.env.example`. Use Vercel Preview deployments for QA before assigning the production domain.
