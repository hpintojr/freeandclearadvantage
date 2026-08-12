import type { LeadPayload } from "./types";

const stateCodes = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
]);

export function validateLead(input: unknown): { ok: true; data: LeadPayload } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request." };
  const data = input as Partial<LeadPayload>;

  if (!Number.isFinite(data.debtAmount) || Number(data.debtAmount) < 1000 || Number(data.debtAmount) > 250000) {
    return { ok: false, error: "Enter a valid debt amount." };
  }
  if (!data.state || !stateCodes.has(String(data.state).toUpperCase())) return { ok: false, error: "Select a valid state." };
  if (!data.employment) return { ok: false, error: "Select employment status." };
  if (!Array.isArray(data.debtTypes) || data.debtTypes.length < 1) return { ok: false, error: "Select at least one debt type." };
  if (!data.paymentStatus) return { ok: false, error: "Select payment status." };

  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const email = data.email?.toLowerCase().trim();
  const address = data.address?.trim();
  const zip = data.zip?.trim();
  const dob = data.dob?.trim();

  if (!firstName || !lastName) return { ok: false, error: "Enter your name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  if (!address) return { ok: false, error: "Enter your mailing address." };
  if (!zip || !/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, error: "Enter a valid ZIP code." };
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, error: "Enter a valid date of birth." };

  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  if (!Number.isFinite(birth.getTime()) || age < 18 || age > 110) return { ok: false, error: "You must be at least 18 years old." };

  const digits = (data.phone || "").replace(/\D/g, "");
  if (digits.length !== 10 && !(digits.length === 11 && digits.startsWith("1"))) return { ok: false, error: "Enter a valid U.S. phone number." };

  return {
    ok: true,
    data: {
      ...(data as LeadPayload),
      state: String(data.state).toUpperCase(),
      firstName,
      lastName,
      email,
      address,
      zip,
      dob,
      phone: digits.length === 10 ? `+1${digits}` : `+${digits}`,
      tcpaConsent: data.tcpaConsent === true,
    },
  };
}
