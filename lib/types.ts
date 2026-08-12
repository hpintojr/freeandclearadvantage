export type EmploymentStatus =
  | "employed-full-time"
  | "employed-part-time"
  | "self-employed"
  | "retired"
  | "not-employed";

export type PaymentStatus =
  | "current-struggling"
  | "fallen-behind"
  | "stopped-paying"
  | "collections";

export type LeadPayload = {
  debtAmount: number;
  state: string;
  employment: EmploymentStatus;
  debtTypes: string[];
  paymentStatus: PaymentStatus;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  zip: string;
  dob: string;
  phone: string;
  tcpaConsent: boolean;
  source?: string;
  campaign?: string;
};

export type LeadResult = {
  leadId: string;
  ghlContactId?: string;
  salesforceLeadId?: string;
  demoMode?: boolean;
};
