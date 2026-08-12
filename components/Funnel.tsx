"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const states = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],["DC","District of Columbia"]
];

const debtOptions = ["Credit Cards", "Personal Loans", "Medical Bills", "Student Loans", "Auto Loans", "Other"];

const initial = {
  debtAmount: 25000,
  state: "",
  employment: "",
  debtTypes: [] as string[],
  paymentStatus: "",
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  zip: "",
  dob: "",
  phone: "",
  tcpaConsent: false,
};

export default function Funnel() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const progress = useMemo(() => Math.round(((step + 1) / 10) * 100), [step]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleDebt = (value: string) => set("debtTypes", form.debtTypes.includes(value) ? form.debtTypes.filter((x) => x !== value) : [...form.debtTypes, value]);

  function validCurrent() {
    setError("");
    if (step === 0 && form.debtAmount < 1000) return setError("Select your estimated debt amount."), false;
    if (step === 1 && !form.state) return setError("Select your state."), false;
    if (step === 2 && !form.employment) return setError("Select your employment status."), false;
    if (step === 3 && !form.debtTypes.length) return setError("Select at least one type of debt."), false;
    if (step === 4 && !form.paymentStatus) return setError("Select the option that best describes your payments."), false;
    if (step === 5 && (!form.firstName.trim() || !form.lastName.trim())) return setError("Enter your first and last name."), false;
    if (step === 6 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Enter a valid email address."), false;
    if (step === 7 && (!form.address.trim() || !/^\d{5}(-\d{4})?$/.test(form.zip))) return setError("Enter your address and a valid ZIP code."), false;
    if (step === 8 && !form.dob) return setError("Enter your date of birth."), false;
    if (step === 9 && (!form.phone.trim() || !form.tcpaConsent)) return setError("Enter your phone number and provide consent to continue."), false;
    return true;
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!validCurrent()) return;
    if (step < 9) return setStep((s) => s + 1);

    setSubmitting(true);
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "Free & Clear Advantage Web Funnel" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your request.");
      const params = new URLSearchParams({
        leadId: data.leadId,
        firstName: form.firstName,
        debt: String(form.debtAmount),
      });
      if (data.ghlContactId) params.set("contactId", data.ghlContactId);
      if (data.demoMode) params.set("demo", "1");
      router.push(`/results?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  const next = () => submit();

  return (
    <section className="funnel-shell">
      <div className="progress-track" aria-label={`Form progress ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
      <div className="funnel-card">
        <div className="trust-kicker">Private request • About 2 minutes</div>
        <form onSubmit={submit}>
          {step === 0 && <>
            <p className="eyebrow">Start with a quick estimate</p>
            <h1>How much debt do you have?</h1>
            <p className="subtitle">An estimate is fine. You can review exact balances on the call.</p>
            <div className="amount-display">${form.debtAmount >= 100000 ? "100,000+" : form.debtAmount.toLocaleString()}</div>
            <input className="range" type="range" min="5000" max="100000" step="5000" value={form.debtAmount} onChange={(e) => set("debtAmount", Number(e.target.value))} aria-label="Debt amount" />
            <div className="range-labels"><span>$5,000</span><span>$100k+</span></div>
          </>}

          {step === 1 && <>
            <p className="eyebrow">Personalization</p><h1>What state do you live in?</h1>
            <p className="subtitle">Availability can vary by state.</p>
            <label className="field-label" htmlFor="state">State</label>
            <select id="state" value={form.state} onChange={(e) => set("state", e.target.value)}><option value="">Select your state</option>{states.map(([code,name]) => <option key={code} value={code}>{name}</option>)}</select>
          </>}

          {step === 2 && <>
            <p className="eyebrow">A few details</p><h1>Are you currently employed?</h1>
            <div className="option-grid">
              {[["employed-full-time","Yes, full-time"],["employed-part-time","Yes, part-time"],["self-employed","Self-employed"],["retired","Retired"],["not-employed","Not currently employed"]].map(([value,label]) => <button type="button" key={value} className={`choice ${form.employment===value?"selected":""}`} onClick={() => set("employment", value)}>{label}<span>{form.employment===value?"✓":""}</span></button>)}
            </div>
          </>}

          {step === 3 && <>
            <p className="eyebrow">Your debt profile</p><h1>What types of debt do you have?</h1><p className="subtitle">Select all that apply.</p>
            <div className="option-grid">{debtOptions.map((value) => <button type="button" key={value} className={`choice ${form.debtTypes.includes(value)?"selected":""}`} onClick={() => toggleDebt(value)}>{value}<span>{form.debtTypes.includes(value)?"✓":""}</span></button>)}</div>
          </>}

          {step === 4 && <>
            <p className="eyebrow">Payment status</p><h1>Are you making your monthly payments?</h1>
            <div className="option-grid">{[["current-struggling","Yes, but it’s a struggle"],["fallen-behind","I’ve fallen behind"],["stopped-paying","I’ve stopped paying"],["collections","Some accounts are in collections"]].map(([value,label]) => <button type="button" key={value} className={`choice ${form.paymentStatus===value?"selected":""}`} onClick={() => set("paymentStatus", value)}>{label}<span>{form.paymentStatus===value?"✓":""}</span></button>)}</div>
          </>}

          {step === 5 && <>
            <p className="eyebrow">Almost there</p><h1>What’s your name?</h1>
            <div className="two-col"><label>First name<input autoComplete="given-name" value={form.firstName} onChange={(e)=>set("firstName",e.target.value)} /></label><label>Last name<input autoComplete="family-name" value={form.lastName} onChange={(e)=>set("lastName",e.target.value)} /></label></div>
            <div className="helper-card">Based on what you’ve shared, we’ll use your information to find the most relevant next step.</div>
          </>}

          {step === 6 && <>
            <p className="eyebrow">We’re preparing your options</p><h1>What’s your email?</h1>
            <label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(e)=>set("email",e.target.value)} placeholder="you@example.com" /></label>
            <p className="microcopy">We use your email to send information related to your request. See our <a href="/privacy">Privacy Policy</a>.</p>
          </>}

          {step === 7 && <>
            <p className="eyebrow">Location details</p><h1>What’s your mailing address?</h1><p className="subtitle">This helps determine which options may be available where you live.</p>
            <label>Street address<input autoComplete="street-address" value={form.address} onChange={(e)=>set("address",e.target.value)} /></label>
            <label>ZIP code<input inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={(e)=>set("zip",e.target.value.replace(/[^0-9-]/g,""))} /></label>
          </>}

          {step === 8 && <>
            <p className="eyebrow">Eligibility details</p><h1>What’s your date of birth?</h1>
            <label>Date of birth<input type="date" autoComplete="bday" value={form.dob} onChange={(e)=>set("dob",e.target.value)} /></label>
            <p className="microcopy">You must be 18 or older. We do not request a Social Security number on this form.</p>
          </>}

          {step === 9 && <>
            <p className="eyebrow">Final step</p><h1>What’s your phone number?</h1><p className="subtitle">Use the number where you want us to reach you.</p>
            <label>Mobile phone<input type="tel" autoComplete="tel" value={form.phone} onChange={(e)=>set("phone",e.target.value)} placeholder="(555) 555-5555" /></label>
            <label className="consent-box"><input type="checkbox" checked={form.tcpaConsent} onChange={(e)=>set("tcpaConsent",e.target.checked)} /><span>By checking this box and selecting “See My Options,” I provide my electronic signature and agree that Free & Clear Advantage may call or text me at the number I provided about my request, including using automated technology, prerecorded or artificial voice, and/or AI. Consent is not a condition of purchase. Message and data rates may apply. I can revoke consent at any time and can reply STOP to text messages. I agree to the <a href="/terms" target="_blank">Terms of Use</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label>
          </>}

          {error && <div className="error" role="alert">{error}</div>}
          <div className="form-actions">
            {step > 0 && <button className="back" type="button" onClick={() => { setError(""); setStep((s)=>s-1); }}>Back</button>}
            <button className="primary" type={step === 9 ? "submit" : "button"} onClick={step===9?undefined:next} disabled={submitting}>{submitting ? "Submitting…" : step === 9 ? "See My Options →" : "Next →"}</button>
          </div>
        </form>
      </div>
      <div className="privacy-strip">🔒 Secure form • Your information is transmitted over HTTPS</div>
    </section>
  );
}
