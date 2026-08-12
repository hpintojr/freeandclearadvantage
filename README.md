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
8. Mailing address + ZIP
9. Date of birth
10. Phone + express contact consent
11. Results page with call CTA and booking calendar

The result page deliberately says **“based on your answers, you may qualify”** rather than making a guaranteed qualification claim.

## CRM routing

`POST /api/lead` can send the same lead to HighLevel, Salesforce, or both.

- HighLevel: native API with `GHL_ACCESS_TOKEN` + `GHL_LOCATION_ID`, or a workflow webhook using `GHL_INBOUND_WEBHOOK_URL`.
- Salesforce: native REST Lead creation using `SALESFORCE_INSTANCE_URL` + `SALESFORCE_ACCESS_TOKEN`, or a Salesforce Flow/webhook using `SALESFORCE_WEBHOOK_URL`.
- If no CRM credentials are present, the site runs in preview/demo mode and does not persist the lead.

Custom CRM fields are environment-configurable. Verify all HighLevel custom-field IDs and Salesforce API field names before production.

## Booking / HighLevel round robin

The custom results-page calendar reads live availability from the HighLevel calendar API and creates the appointment back in HighLevel when credentials are present.

For the requested five-booking capacity, configure the HighLevel calendar as **Round Robin** with five eligible team members, each available for one appointment at a time. Keep appointment duration at 60 minutes. The site will then reflect the live free slots returned by HighLevel rather than maintaining a second calendar database.

The default visual schedule uses one-hour windows inside the requested 9:30 AM–5:00 PM Pacific range. Because a strict sequence of one-hour sessions cannot both begin at 9:30 AM and end exactly at 5:00 PM without either a gap or overlap, the preview uses 9:30, 10:30, 11:30, 12:30, 1:30, 2:30, and 4:00. Once HighLevel is connected, its actual calendar availability is the source of truth.

## Compliance / legal review before launch

The repository includes original draft Privacy Policy, Terms of Use, Privacy Choices page, footer disclosures, and phone-step consent language. They are not copied from Forbes Advisor or another advertiser.

Before production, confirm with counsel:

- Exact legal entity name, physical/business address, privacy contact, and all state-specific registrations/licensing disclosures.
- Whether Free & Clear Advantage is a marketing/referral service, direct provider, or both; adjust footer/legal text to match reality.
- Which parties are authorized to call/text. The current contact consent is specific to **Free & Clear Advantage**. If third-party providers will independently place automated/prerecorded/AI marketing calls or texts, add compliant party-specific consent at the correct point in the flow rather than silently expanding this disclosure.
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
