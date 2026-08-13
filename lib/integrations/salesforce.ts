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

type SalesforceField = {
  label?: string;
  name?: string;
  updateable?: boolean;
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

async function updateLoanPurpose(
  auth: { accessToken: string; instanceUrl: string },
  leadId: string | undefined,
  email: string,
  loanPurpose: string,
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
  const field = describe.fields?.find(
    (item) => item.updateable && item.label?.trim().toLowerCase() === "loan purpose" && item.name,
  );
  if (!field?.name) throw new Error("Salesforce Loan Purpose field was not found or is not updateable.");

  const updateResponse = await fetch(
    `${auth.instanceUrl}${latest.url}/sobjects/Lead/${encodeURIComponent(leadId)}`,
    {
      method: "PATCH",
      headers: { ...requestHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ [field.name]: loanPurpose }),
      cache: "no-store",
    },
  );
  if (!updateResponse.ok) throw new Error(`Salesforce Loan Purpose update failed: ${updateResponse.status}`);
  return leadId;
}

function buildDescription(lead: LeadPayload, consentTimestamp: string, consentVersion: string) {
  return [
    "Free & Clear Advantage website lead.",
    `Debt types: ${lead.debtTypes.join(", ") || "Not provided"}.`,
    `Payment status: ${lead.paymentStatus || "Not provided"}.`,
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

  leadId = await updateLoanPurpose(auth, leadId, lead.email, loanPurpose);

  return { leadId };
}
