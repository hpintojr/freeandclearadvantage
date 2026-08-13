import type { LeadPayload } from "../types";

const DEFAULT_INSTANCE_URL = "https://customer-ruby-1712.my.salesforce.com";
const DEFAULT_SOURCE = "F&C-Website";

type SalesforceTokenResponse = {
  access_token?: string;
  instance_url?: string;
  token_type?: string;
  issued_at?: string;
  signature?: string;
};

type SalesforceVersion = {
  version?: string;
  url?: string;
};

type SalesforceCreateResponse = {
  id?: string;
  success?: boolean;
  errors?: unknown[];
};

type SalesforceField = {
  label?: string;
  name?: string;
  updateable?: boolean;
  type?: string;
  picklistValues?: { active?: boolean; label?: string; value?: string }[];
};

async function getSalesforceAccessToken() {
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const instance = (process.env.SALESFORCE_INSTANCE_URL || DEFAULT_INSTANCE_URL).replace(/\/$/, "");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${instance}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Salesforce OAuth failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as SalesforceTokenResponse;
  if (!json.access_token) throw new Error("Salesforce OAuth response did not include an access token.");

  return {
    accessToken: json.access_token,
    instanceUrl: (json.instance_url || instance).replace(/\/$/, ""),
  };
}

async function getLatestSalesforceDataUrl(auth: { accessToken: string; instanceUrl: string }) {
  const response = await fetch(`${auth.instanceUrl}/services/data/`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Salesforce API versions failed: ${response.status}`);

  const versions = (await response.json()) as SalesforceVersion[];
  const latest = versions
    .filter((item) => item.url && Number.isFinite(Number(item.version)))
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  if (!latest?.url) throw new Error("Salesforce API versions response was invalid.");
  return latest.url;
}

function escapeSoqlLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function createSalesforceAppointmentEvent(input: {
  leadId: string;
  ghlAppointmentId: string;
  startTime: string;
  endTime: string;
  consumerName: string;
}) {
  const auth = await getSalesforceAccessToken();
  if (!auth) return null;

  const dataUrl = await getLatestSalesforceDataUrl(auth);
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const assignmentEmail = (process.env.SALESFORCE_DEFAULT_ASSIGNMENT_EMAIL || "alex@advantagefirst.com").trim();
  const emailLiteral = escapeSoqlLiteral(assignmentEmail);
  const userQuery = `SELECT Id FROM User WHERE IsActive = true AND (Email = '${emailLiteral}' OR Username = '${emailLiteral}') ORDER BY LastLoginDate DESC NULLS LAST LIMIT 1`;
  const userResponse = await fetch(
    `${auth.instanceUrl}${dataUrl}/query?q=${encodeURIComponent(userQuery)}`,
    { headers, cache: "no-store" },
  );
  if (!userResponse.ok) throw new Error(`Salesforce assignment user lookup failed: ${userResponse.status}`);
  const userResult = (await userResponse.json()) as { records?: { Id?: string }[] };
  const ownerId = userResult.records?.[0]?.Id;
  if (!ownerId) throw new Error(`No active Salesforce user found for ${assignmentEmail}.`);

  const eventResponse = await fetch(`${auth.instanceUrl}${dataUrl}/sobjects/Event`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      Subject: `F&C Telephone Consultation [GHL:${input.ghlAppointmentId}]`,
      WhoId: input.leadId,
      OwnerId: ownerId,
      StartDateTime: input.startTime,
      EndDateTime: input.endTime,
      Location: "Telephone",
      Description: [
        `Consumer: ${input.consumerName}.`,
        `GHL appointment ID: ${input.ghlAppointmentId}.`,
        "Initially assigned to Alex for manual distribution.",
        "Reassign both the Lead owner and this Event owner to place it on the agent's Salesforce calendar.",
      ].join(" "),
    }),
    cache: "no-store",
  });
  const responseText = await eventResponse.text();
  if (!eventResponse.ok) {
    throw new Error(`Salesforce Event create failed: ${eventResponse.status} ${responseText.slice(0, 300)}`);
  }

  const created = responseText ? (JSON.parse(responseText) as SalesforceCreateResponse) : {};
  if (!created.id) throw new Error("Salesforce Event create response did not include an ID.");
  return { eventId: created.id, ownerId };
}

function mapEmploymentStatus(value: string) {
  switch (value) {
    case "employed-full-time":
    case "employed-part-time":
      return "Employed";
    case "self-employed":
      return "Self-Employed";
    case "retired":
      return "Retired";
    case "not-employed":
      return "Unemployed";
    default:
      return value;
  }
}

function mapLoanPurpose(debtTypes: string[]) {
  // Multiple debts are best represented by the CRM's consolidation option.
  if (debtTypes.length !== 1) return "Debt Consolidation";

  switch (debtTypes[0]) {
    case "Credit Cards":
      return "Pay off credit cards";
    case "Medical Bills":
      return "Medical Bill";
    case "Auto Loans":
      return "New auto purchase";
    case "Other":
      return "Other";
    default:
      return "Debt Consolidation";
  }
}

function normalizeFieldIdentifier(value: string | undefined) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isLoanField(field: SalesforceField, identifier: "loanpurpose" | "loanamount") {
  const label = normalizeFieldIdentifier(field.label);
  const name = normalizeFieldIdentifier(field.name);
  return label === identifier || name.includes(identifier);
}

async function updateLoanFields(
  auth: { accessToken: string; instanceUrl: string },
  leadId: string | undefined,
  email: string,
  loanPurpose: string,
  loanAmount: number,
) {
  const requestHeaders = { Authorization: `Bearer ${auth.accessToken}` };
  const versionsResponse = await fetch(`${auth.instanceUrl}/services/data/`, {
    headers: requestHeaders,
    cache: "no-store",
  });
  if (!versionsResponse.ok) throw new Error(`Salesforce API versions failed: ${versionsResponse.status}`);

  const versions = (await versionsResponse.json()) as SalesforceVersion[];
  const latest = versions
    .filter((item) => item.url && Number.isFinite(Number(item.version)))
    .sort((a, b) => Number(b.version) - Number(a.version))[0];
  if (!latest?.url) throw new Error("Salesforce API versions response was invalid.");

  if (!leadId) {
    const emailLiteral = email.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const query = `SELECT Id FROM Lead WHERE Email = '${emailLiteral}' ORDER BY LastModifiedDate DESC LIMIT 1`;
    const queryResponse = await fetch(
      `${auth.instanceUrl}${latest.url}/query?q=${encodeURIComponent(query)}`,
      { headers: requestHeaders, cache: "no-store" },
    );
    if (!queryResponse.ok) throw new Error(`Salesforce Lead lookup failed: ${queryResponse.status}`);
    const queryResult = (await queryResponse.json()) as { records?: { Id?: string }[] };
    leadId = queryResult.records?.[0]?.Id;
  }
  if (!leadId) throw new Error("Salesforce Lead ID was not returned or found.");

  const describeResponse = await fetch(`${auth.instanceUrl}${latest.url}/sobjects/Lead/describe`, {
    headers: requestHeaders,
    cache: "no-store",
  });
  if (!describeResponse.ok) throw new Error(`Salesforce Lead describe failed: ${describeResponse.status}`);

  const describe = (await describeResponse.json()) as { fields?: SalesforceField[] };
  const allFields = describe.fields || [];
  const purposeFields = allFields.flatMap((field) => {
    if (!field.name || !isLoanField(field, "loanpurpose")) return [];
    if (field.type !== "picklist" && field.type !== "multipicklist") {
      return [{ field, value: loanPurpose }];
    }

    const compatibleValue = field.picklistValues?.find(
      (option) =>
        option.active &&
        [option.label, option.value].some(
          (candidate) => candidate?.trim().toLowerCase() === loanPurpose.trim().toLowerCase(),
        ),
    )?.value;
    return compatibleValue ? [{ field, value: compatibleValue }] : [];
  });
  const amountFields = allFields
    .filter((field) => field.name && isLoanField(field, "loanamount"))
    .map((field) => ({ field, value: loanAmount }));

  if (!purposeFields.length) throw new Error("Salesforce Loan Purpose field was not found or compatible.");
  if (!amountFields.length) throw new Error("Salesforce Loan Amount field was not found.");

  // Duplicate custom fields can share a label. Update each candidate separately so
  // one inaccessible legacy field cannot prevent the visible field from saving.
  for (const candidate of [...purposeFields, ...amountFields]) {
    if (!candidate.field.updateable || !candidate.field.name) continue;
    const updateResponse = await fetch(
      `${auth.instanceUrl}${latest.url}/sobjects/Lead/${encodeURIComponent(leadId)}`,
      {
        method: "PATCH",
        headers: { ...requestHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ [candidate.field.name]: candidate.value }),
        cache: "no-store",
      },
    );
    if (!updateResponse.ok && updateResponse.status !== 400 && updateResponse.status !== 403) {
      throw new Error(`Salesforce loan field update failed: ${updateResponse.status}`);
    }
  }

  const fieldsToVerify = [...purposeFields, ...amountFields].map(({ field }) => field.name as string);
  const verifyQuery = `SELECT ${fieldsToVerify.join(", ")} FROM Lead WHERE Id = '${leadId}' LIMIT 1`;
  const verifyResponse = await fetch(
    `${auth.instanceUrl}${latest.url}/query?q=${encodeURIComponent(verifyQuery)}`,
    { headers: requestHeaders, cache: "no-store" },
  );
  if (!verifyResponse.ok) throw new Error(`Salesforce loan field verification failed: ${verifyResponse.status}`);

  const verifyResult = (await verifyResponse.json()) as { records?: Record<string, unknown>[] };
  const savedRecord = verifyResult.records?.[0];
  const purposeSaved = purposeFields.some(
    ({ field, value }) => field.name && savedRecord?.[field.name] === value,
  );
  const amountSaved = amountFields.some(
    ({ field }) => field.name && Number(savedRecord?.[field.name]) === loanAmount,
  );
  if (!purposeSaved) throw new Error("Salesforce Loan Purpose update could not be verified.");
  if (!amountSaved) throw new Error("Salesforce Loan Amount update could not be verified.");
  return leadId;
}

function buildDescription(lead: LeadPayload, consentTimestamp: string, consentVersion: string) {
  return [
    "Free & Clear Advantage website lead.",
    `Debt types: ${lead.debtTypes.join(", ") || "Not provided"}.`,
    `Payment status: ${lead.paymentStatus || "Not provided"}.`,
    `Submission IP address: ${lead.ipAddress || "Not available"}.`,
    `IP-derived country: ${lead.ipCountry || "Not available"}.`,
    `IP-derived region: ${lead.ipRegion || "Not available"}.`,
    `Consumer timezone: ${lead.timezone || "Not available"}.`,
    `Automated/prerecorded/AI contact consent: ${lead.tcpaConsent ? "YES" : "NO"}.`,
    `Submission/consent-decision timestamp: ${consentTimestamp}.`,
    `Disclosure version: ${consentVersion}.`,
  ].join(" ");
}

export async function sendLeadToSalesforce(
  lead: LeadPayload,
  consentTimestamp: string,
  consentVersion: string,
) {
  if (process.env.SALESFORCE_WEBHOOK_URL) {
    const response = await fetch(process.env.SALESFORCE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...lead,
        consentTimestamp,
        consentVersion,
        source: lead.source || "Free & Clear Advantage Web Funnel",
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Salesforce webhook failed: ${response.status}`);
    return { leadId: undefined };
  }

  const auth = await getSalesforceAccessToken();
  if (!auth) return null;

  const configuredSource = (process.env.SALESFORCE_SOURCE_NAME || DEFAULT_SOURCE).trim();
  // Migrate the original production value without requiring an immediate Vercel env change.
  const source = configuredSource === "Website" ? DEFAULT_SOURCE : configuredSource;
  const endpoint = `${auth.instanceUrl}/services/apexrest/api/leads/${encodeURIComponent(source)}`;

  const loanPurpose = mapLoanPurpose(lead.debtTypes);
  const payload = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    mobilePhone: lead.phone,
    description: buildDescription(lead, consentTimestamp, consentVersion),
    addressLine1: lead.address,
    city: lead.city,
    state: lead.state,
    zipCode: lead.zip,
    applicantDOB: lead.dob,
    debtAmount: lead.debtAmount,
    loanAmount: lead.debtAmount,
    employmentStatus: mapEmploymentStatus(lead.employment),
    loanPurpose,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Salesforce Apex lead create failed: ${response.status}`);
  }

  let leadId: string | undefined;
  if (text) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const candidate = json.id ?? json.leadId ?? json.recordId;
      if (typeof candidate === "string") leadId = candidate;
    } catch {
      // The Apex resource may return a non-JSON success body. A 2xx response is enough to treat it as saved.
    }
  }

  leadId = await updateLoanFields(auth, leadId, lead.email, loanPurpose, lead.debtAmount);

  return { leadId };
}

