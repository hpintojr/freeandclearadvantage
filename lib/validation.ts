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
  if (!data.firstName?.trim() || !data.lastName?.trim()) return { ok: false, error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return { ok: false, error: "Enter a valid email." };
  if (!data.address?.trim()) return { ok: false, error: "Enter your mailing address." };
  if (!/^\d{5}(-\d{4})?$/.test(data.zip || "")) return { ok: false, error: "Enter a valid ZIP code." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob || "")) return { ok: false, error: "Enter a valid date of birth." };

  const birth = new Date(`${data.dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  if (!Number.isFinite(birth.getTime()) || age < 18 || age > 110) return { ok: false, error: "You must be at least 18 years old." };

  const digits = (data.phone || "").replace(/\D/g, "");
  if (digits.length !== 10 && !(digits.length === 11 && digits.startsWith("1"))) return { ok: false, error: "Enter a valid U.S. phone number." };
  if (data.tcpaConsent !== true) return { ok: false, error: "Consent is required to request a call or text." };

  return {
    ok: true,
    data: {
      ...(data as LeadPayload),
      state: String(data.state).toUpperCase(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      address: data.address.trim(),
      phone: digits.length === 10 ? `+1${digits}` : `+${digits}`,
    },
  };
}
