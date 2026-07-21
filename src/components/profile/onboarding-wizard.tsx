"use client";

import { ArrowLeft, ArrowRight, Check, LockKeyhole, Save } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ApproximateDateInput } from "@/components/ui/approximate-date-input";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import type { DatePrecision } from "@/contracts";
import { packYearPreview } from "@/domain/profile-context/pack-years";

const steps = [
  "Basics",
  "Relevant anatomy",
  "Risk context",
  "Health history",
  "Medications",
  "Review",
] as const;
const anatomy = [
  ["cervix", "Cervix"],
  ["breast_tissue", "Breast tissue"],
  ["prostate", "Prostate"],
  ["uterus", "Uterus"],
  ["ovaries", "Ovaries"],
] as const;

type WizardState = Record<string, string | boolean>;

function datePrecision(value: string | boolean | undefined): DatePrecision {
  return value === "day" || value === "month" || value === "year" ? value : "unknown";
}

export function OnboardingWizard({
  initialStep = 0,
  initialState = {},
}: {
  initialStep?: number;
  initialState?: WizardState;
}) {
  const [step, setStep] = useState(initialStep);
  const [state, setState] = useState<WizardState>({
    countryCode: "US",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    relationshipLabel: "Self",
    ownership: "self",
    visibility: "owner_only",
    anatomy_cervix: "unknown",
    anatomy_breast_tissue: "unknown",
    anatomy_prostate: "unknown",
    anatomy_uterus: "unknown",
    anatomy_ovaries: "unknown",
    tobaccoStatus: "unknown",
    pregnancyStatus: "unknown",
    immunocompromised: "unknown",
    alcoholAssessmentPreference: "unknown",
    fallConcern: "unknown",
    sexualHealthRisk: "unknown",
    surgeryAnatomyKey: "",
    surgeryAnatomyState: "",
    confirmSurgeryAnatomy: false,
    medicationStartedDate: "",
    medicationStartedPrecision: "unknown",
    ...initialState,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const currentYear = new Date().getFullYear();
  const packYears = packYearPreview(
    {
      status: String(state.tobaccoStatus ?? "unknown") as
        "never" | "current" | "former" | "unknown" | "prefer_not_to_answer",
      startedYear: String(state.smokingStartYear ?? ""),
      endedYear: String(state.smokingEndYear ?? ""),
      packsPerDay: String(state.packsPerDay ?? ""),
    },
    currentYear,
  );
  const birthYear = Number(String(state.dateOfBirth ?? "").slice(0, 4));
  const asksFallConcern = Number.isFinite(birthYear) && currentYear - birthYear >= 64;
  const asksPregnancy = state.anatomy_uterus !== "absent";

  function update(key: string, value: string | boolean) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateTobaccoStatus(status: string) {
    setState((current) => ({
      ...current,
      tobaccoStatus: status,
      ...(status === "current" ? { smokingEndYear: "" } : {}),
      ...(status === "current" || status === "former"
        ? {}
        : { smokingStartYear: "", smokingEndYear: "", packsPerDay: "" }),
    }));
  }

  async function save(status: "draft" | "complete", intent?: "save_exit" | "continue") {
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/profiles/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          step,
          data: state,
          ...(intent === undefined ? {} : { intent }),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        fieldErrors?: Record<string, string[]>;
        step?: number;
        handoffUrl?: string;
      };
      if (!response.ok) {
        const fieldMessage = Object.values(payload.fieldErrors ?? {}).flat()[0];
        setError(fieldMessage ?? payload.error ?? "The profile could not be saved.");
        return;
      }
      if (status === "complete") {
        window.location.assign(payload.handoffUrl ?? "/app");
      } else if (intent === "continue") {
        setStep(payload.step ?? Math.min(steps.length - 1, step + 1));
      } else {
        window.location.assign("/app");
      }
    } catch {
      setError("The profile could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside>
        <ol className="space-y-1" aria-label="Onboarding progress">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                aria-current={index === step ? "step" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                  index === step
                    ? "bg-brand-soft text-brand-strong"
                    : index < step
                      ? "text-ink hover:bg-surface-muted"
                      : "text-ink-soft/60"
                }`}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full text-xs ${index < step ? "bg-brand text-white" : "border-line-strong border"}`}
                >
                  {index < step ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <div className="border-line text-ink-soft mt-6 rounded-xl border p-3 text-xs leading-5">
          <LockKeyhole aria-hidden="true" className="text-brand mb-2 size-4" />
          Adult profiles can remain private within a household. You choose who can view or edit
          them.
        </div>
      </aside>

      <section className="rounded-card border-line bg-surface border p-5 shadow-[0_18px_50px_rgb(var(--shadow)/0.08)] sm:p-8">
        <div className="mb-7">
          <p className="text-brand text-xs font-bold tracking-[0.1em] uppercase">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="font-editorial mt-2 text-3xl font-semibold">{steps[step]}</h2>
        </div>

        {error !== undefined ? (
          <Alert tone="error" title="Could not save">
            {error}
          </Alert>
        ) : null}

        <div className="mt-5 min-h-[24rem]">
          {step === 0 ? (
            <div className="space-y-5">
              <p className="text-ink-soft leading-7">
                Start with the basics needed to calculate age on a specific date and keep plans in
                the right timezone.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="displayName" label="Profile display name">
                  <Input
                    id="displayName"
                    value={String(state.displayName ?? "")}
                    onChange={(event) => update("displayName", event.target.value)}
                    maxLength={80}
                    required
                  />
                </FormField>
                <FormField id="relationship" label="Relationship">
                  <Select
                    id="relationship"
                    value={String(state.relationshipLabel)}
                    onChange={(event) => update("relationshipLabel", event.target.value)}
                  >
                    <option>Self</option>
                    <option>Parent</option>
                    <option>Spouse or partner</option>
                    <option>Adult family member</option>
                    <option>Other adult</option>
                  </Select>
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="dateOfBirth"
                  label="Date of birth"
                  hint="Version one supports adults age 18 and older."
                >
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={String(state.dateOfBirth ?? "")}
                    onChange={(event) => update("dateOfBirth", event.target.value)}
                    required
                  />
                </FormField>
                <FormField
                  id="sexAssigned"
                  label="Sex assigned at birth"
                  hint="This is not used as a substitute for relevant anatomy."
                >
                  <Select
                    id="sexAssigned"
                    value={String(state.sexAssignedAtBirth ?? "")}
                    onChange={(event) => update("sexAssignedAtBirth", event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Choose an answer
                    </option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="intersex">Intersex</option>
                    <option value="unknown">Unsure</option>
                    <option value="prefer_not_to_answer">Prefer not to answer</option>
                  </Select>
                </FormField>
              </div>
              <FormField id="genderIdentity" label="Gender identity (optional)">
                <Input
                  id="genderIdentity"
                  value={String(state.genderIdentity ?? "")}
                  onChange={(event) => update("genderIdentity", event.target.value)}
                  maxLength={120}
                />
              </FormField>
              <FormField
                id="ownership"
                label="Who will own this adult profile?"
                hint="Another adult can claim ownership through a secure invitation."
              >
                <Select
                  id="ownership"
                  value={String(state.ownership)}
                  onChange={(event) => update("ownership", event.target.value)}
                >
                  <option value="self">I will own this profile</option>
                  <option value="unclaimed">Set up for another adult</option>
                </Select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="timezone" label="Timezone">
                  <Input
                    id="timezone"
                    value={String(state.timezone)}
                    onChange={(event) => update("timezone", event.target.value)}
                  />
                </FormField>
                <FormField id="visibility" label="Profile privacy">
                  <Select
                    id="visibility"
                    value={String(state.visibility)}
                    onChange={(event) => update("visibility", event.target.value)}
                  >
                    <option value="owner_only">Only me</option>
                    <option value="selected_members">Selected members</option>
                    <option value="household">Whole household</option>
                  </Select>
                </FormField>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <Alert tone="info" title="Why these questions appear">
                Some preventive-care recommendations depend on which organs or tissue a person
                currently has, especially after surgery or gender-affirming care.
              </Alert>
              <div className="divide-line border-line divide-y rounded-xl border">
                {anatomy.map(([key, label]) => (
                  <fieldset
                    key={key}
                    className="grid gap-3 p-4 sm:grid-cols-[1fr_repeat(4,auto)] sm:items-center"
                  >
                    <legend className="font-semibold sm:float-left">{label}</legend>
                    {[
                      ["present", "Present"],
                      ["absent", "Absent"],
                      ["unknown", "Unsure"],
                      ["prefer_not_to_answer", "Prefer not to answer"],
                    ].map(([value, option]) => (
                      <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={key}
                          value={value}
                          checked={state[`anatomy_${key}`] === value}
                          onChange={() => update(`anatomy_${key}`, value!)}
                          className="accent-brand size-4"
                        />{" "}
                        {option}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <p className="text-ink-soft leading-7">
                Only high-impact context is requested. Every question includes an unsure or skip
                path.
              </p>
              <FormField
                id="tobaccoStatus"
                label="Tobacco history"
                hint="Smoking history can affect whether certain screening guidance applies."
              >
                <Select
                  id="tobaccoStatus"
                  value={String(state.tobaccoStatus ?? "unknown")}
                  onChange={(event) => updateTobaccoStatus(event.target.value)}
                >
                  <option value="never">Never</option>
                  <option value="current">Current</option>
                  <option value="former">Former</option>
                  <option value="unknown">I’m not sure</option>
                  <option value="prefer_not_to_answer">Prefer not to answer</option>
                </Select>
              </FormField>
              {state.tobaccoStatus === "current" || state.tobaccoStatus === "former" ? (
                <div className="bg-surface-muted/60 grid gap-4 rounded-xl p-4 sm:grid-cols-3">
                  <FormField id="smokingStartYear" label="Start year">
                    <Input
                      id="smokingStartYear"
                      type="number"
                      min={1900}
                      max={currentYear}
                      value={String(state.smokingStartYear ?? "")}
                      onChange={(event) => update("smokingStartYear", event.target.value)}
                    />
                  </FormField>
                  <FormField id="smokingEndYear" label="Quit year (if former)">
                    <Input
                      id="smokingEndYear"
                      type="number"
                      min={1900}
                      max={currentYear}
                      value={String(state.smokingEndYear ?? "")}
                      onChange={(event) => update("smokingEndYear", event.target.value)}
                    />
                  </FormField>
                  <FormField id="packsPerDay" label="Average packs/day">
                    <Input
                      id="packsPerDay"
                      type="number"
                      min={0}
                      max={20}
                      step="0.1"
                      value={String(state.packsPerDay ?? "")}
                      onChange={(event) => update("packsPerDay", event.target.value)}
                    />
                  </FormField>
                  <div className="border-line bg-surface rounded-xl border p-3 sm:col-span-3">
                    <p className="text-sm font-semibold">
                      {packYears.packYears === null
                        ? "Pack-year estimate unavailable"
                        : `About ${packYears.packYears} pack-years`}
                    </p>
                    <p className="text-ink-soft mt-1 text-xs leading-5">{packYears.detail}</p>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="height" label="Height in inches (optional)">
                  <Input
                    id="height"
                    type="number"
                    min={24}
                    max={110}
                    value={String(state.heightInches ?? "")}
                    onChange={(event) => update("heightInches", event.target.value)}
                  />
                </FormField>
                <FormField id="weight" label="Weight in pounds (optional)">
                  <Input
                    id="weight"
                    type="number"
                    min={45}
                    max={1322}
                    value={String(state.weightPounds ?? "")}
                    onChange={(event) => update("weightPounds", event.target.value)}
                  />
                </FormField>
              </div>
              <label className="border-line flex min-h-12 items-center justify-between rounded-xl border p-3">
                <span>
                  <span className="block text-sm font-semibold">Immunocompromised status</span>
                  <span className="text-ink-soft text-xs">
                    Only if known or clinician-confirmed
                  </span>
                </span>
                <Select
                  aria-label="Immunocompromised status"
                  value={String(state.immunocompromised ?? "unknown")}
                  onChange={(event) => update("immunocompromised", event.target.value)}
                  className="w-36"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="unknown">Unsure</option>
                </Select>
              </label>
              {asksPregnancy ? (
                <FormField
                  id="pregnancyStatus"
                  label="Pregnancy status"
                  hint="Shown because uterus anatomy is present or unsure. This can be skipped."
                >
                  <Select
                    id="pregnancyStatus"
                    value={String(state.pregnancyStatus ?? "unknown")}
                    onChange={(event) => update("pregnancyStatus", event.target.value)}
                  >
                    <option value="pregnant">Pregnant</option>
                    <option value="not_pregnant">Not pregnant</option>
                    <option value="unknown">I’m not sure</option>
                    <option value="prefer_not_to_answer">Prefer not to answer</option>
                  </Select>
                </FormField>
              ) : null}
              <FormField
                id="alcoholAssessmentPreference"
                label="Include an alcohol-use check-in?"
                hint="This records whether you want that assessment included; it does not infer use."
              >
                <Select
                  id="alcoholAssessmentPreference"
                  value={String(state.alcoholAssessmentPreference ?? "unknown")}
                  onChange={(event) => update("alcoholAssessmentPreference", event.target.value)}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unknown">I’m not sure</option>
                </Select>
              </FormField>
              {asksFallConcern ? (
                <FormField
                  id="fallConcern"
                  label="Any fall history or concern?"
                  hint="Shown near the age when the active fall-risk guidance can apply."
                >
                  <Select
                    id="fallConcern"
                    value={String(state.fallConcern ?? "unknown")}
                    onChange={(event) => update("fallConcern", event.target.value)}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="unknown">I’m not sure</option>
                  </Select>
                </FormField>
              ) : null}
              <FormField
                id="sexualHealthRisk"
                label="Consent-based sexual health risk context"
                hint="Active hepatitis B and STI rules can use this broad answer. No underlying details are requested."
              >
                <Select
                  id="sexualHealthRisk"
                  value={String(state.sexualHealthRisk ?? "unknown")}
                  onChange={(event) => update("sexualHealthRisk", event.target.value)}
                >
                  <option value="present">Increased-risk guidance may apply</option>
                  <option value="absent">No known increased-risk context</option>
                  <option value="unknown">I’m not sure or prefer not to answer</option>
                </Select>
              </FormField>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <p className="text-ink-soft leading-7">
                Select only history relevant to current preventive rules. Abnormal prior results
                move routine timing to a clinician-managed pathway.
              </p>
              <fieldset className="space-y-3">
                <legend className="font-semibold">Conditions or prior history</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "Hypertension",
                    "Diabetes",
                    "Cardiovascular disease",
                    "Prior cancer",
                    "Prior abnormal screening",
                    "Osteoporosis or fragility fracture",
                  ].map((condition) => (
                    <label
                      key={condition}
                      className="border-line flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(state[`condition_${condition}`])}
                        onChange={(event) => update(`condition_${condition}`, event.target.checked)}
                        className="accent-brand size-4"
                      />
                      {condition}
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormField
                id="familyHistory"
                label="First-degree family history (optional)"
                hint="Use a brief condition and relationship, such as ‘parent — colorectal cancer.’"
              >
                <Textarea
                  id="familyHistory"
                  value={String(state.familyHistory ?? "")}
                  onChange={(event) => update("familyHistory", event.target.value)}
                  maxLength={1000}
                />
              </FormField>
              <FormField
                id="surgeries"
                label="Relevant surgeries (optional)"
                hint="Anatomy changes are confirmed separately and updated transactionally."
              >
                <Textarea
                  id="surgeries"
                  value={String(state.surgeries ?? "")}
                  onChange={(event) => {
                    update("surgeries", event.target.value);
                    if (event.target.value.trim() === "") {
                      update("surgeryAnatomyKey", "");
                      update("surgeryAnatomyState", "");
                      update("confirmSurgeryAnatomy", false);
                    }
                  }}
                  maxLength={1000}
                />
              </FormField>
              {String(state.surgeries ?? "").trim() === "" ? null : (
                <div className="border-sky/30 bg-sky-soft/45 space-y-4 rounded-xl border p-4">
                  <div>
                    <p className="font-semibold">Did this surgery change relevant anatomy?</p>
                    <p className="text-ink-soft mt-1 text-xs leading-5">
                      Choose a proposed update only when it is known. It is applied with the surgery
                      after you confirm it.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="surgeryAnatomyKey" label="Affected anatomy (optional)">
                      <Select
                        id="surgeryAnatomyKey"
                        value={String(state.surgeryAnatomyKey ?? "")}
                        onChange={(event) => {
                          update("surgeryAnatomyKey", event.target.value);
                          update("confirmSurgeryAnatomy", false);
                        }}
                      >
                        <option value="">No proposed update</option>
                        {anatomy.map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField id="surgeryAnatomyState" label="Proposed state">
                      <Select
                        id="surgeryAnatomyState"
                        value={String(state.surgeryAnatomyState ?? "")}
                        disabled={String(state.surgeryAnatomyKey ?? "") === ""}
                        onChange={(event) => {
                          update("surgeryAnatomyState", event.target.value);
                          update("confirmSurgeryAnatomy", false);
                        }}
                      >
                        <option value="">Choose a state</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="unknown">Unsure</option>
                        <option value="prefer_not_to_answer">Prefer not to answer</option>
                      </Select>
                    </FormField>
                  </div>
                  {String(state.surgeryAnatomyKey ?? "") === "" ||
                  String(state.surgeryAnatomyState ?? "") === "" ? null : (
                    <label className="border-line bg-surface flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="accent-brand size-4"
                        checked={Boolean(state.confirmSurgeryAnatomy)}
                        onChange={(event) => update("confirmSurgeryAnatomy", event.target.checked)}
                      />
                      Confirm this anatomy update with the surgery
                    </label>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <Alert tone="info" title="Medication monitoring stays explicit">
                CareCadence never infers a lab or schedule from a medication name. Add only the
                instructions given by a clinician.
              </Alert>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="medicationName" label="Medication name (optional)">
                  <Input
                    id="medicationName"
                    maxLength={160}
                    value={String(state.medicationName ?? "")}
                    onChange={(event) => update("medicationName", event.target.value)}
                  />
                </FormField>
                <FormField id="medicationDose" label="Dose (optional)">
                  <Input
                    id="medicationDose"
                    maxLength={120}
                    value={String(state.medicationDose ?? "")}
                    onChange={(event) => update("medicationDose", event.target.value)}
                  />
                </FormField>
                <FormField id="medicationFrequency" label="Frequency (optional)">
                  <Input
                    id="medicationFrequency"
                    maxLength={120}
                    value={String(state.medicationFrequency ?? "")}
                    onChange={(event) => update("medicationFrequency", event.target.value)}
                  />
                </FormField>
                <FormField id="medicationPrescriber" label="Prescriber (optional)">
                  <Input
                    id="medicationPrescriber"
                    maxLength={160}
                    value={String(state.medicationPrescriber ?? "")}
                    onChange={(event) => update("medicationPrescriber", event.target.value)}
                  />
                </FormField>
                <FormField id="medicationReason" label="Reason (optional)">
                  <Input
                    id="medicationReason"
                    maxLength={500}
                    value={String(state.medicationReason ?? "")}
                    onChange={(event) => update("medicationReason", event.target.value)}
                  />
                </FormField>
              </div>
              <ApproximateDateInput
                name="medicationStarted"
                precision={datePrecision(state.medicationStartedPrecision)}
                value={String(state.medicationStartedDate ?? "")}
                onPrecisionChange={(precision) => {
                  update("medicationStartedPrecision", precision);
                  if (precision === "unknown") update("medicationStartedDate", "");
                }}
                onValueChange={(value) => update("medicationStartedDate", value)}
                legend="When did this medication start?"
                unknownDescription="The medication can stay on the list without a guessed start date."
                unknownOptionLabel="Start date unknown"
              />
              <FormField id="monitoring" label="Clinician monitoring instruction (optional)">
                <Textarea
                  id="monitoring"
                  maxLength={2000}
                  value={String(state.monitoringInstructions ?? "")}
                  onChange={(event) => update("monitoringInstructions", event.target.value)}
                />
              </FormField>
              <FormField id="nextReview" label="Next medication review (optional)">
                <Input
                  id="nextReview"
                  type="date"
                  value={String(state.nextMedicationReview ?? "")}
                  onChange={(event) => update("nextMedicationReview", event.target.value)}
                />
              </FormField>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-5">
              <Alert tone="success" title="Ready to generate the initial plan">
                CareCadence will evaluate versioned, source-backed rules against this profile on
                today’s date. The plan will improve as history is added.
              </Alert>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Profile", String(state.displayName ?? "Not entered")],
                  ["Relationship", String(state.relationshipLabel)],
                  ["Birth date", String(state.dateOfBirth ?? "Not entered")],
                  ["Privacy", String(state.visibility).replaceAll("_", " ")],
                  ["Tobacco history", String(state.tobaccoStatus ?? "Not entered")],
                  ["Relevant anatomy", "Captured with unsure options"],
                ].map(([label, value]) => (
                  <div key={label} className="border-line rounded-xl border p-4">
                    <dt className="text-ink-soft text-xs font-bold tracking-wider uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 font-semibold capitalize">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-ink-soft text-sm leading-6">
                After generation, you can start guided backfill, open the dashboard, or record a
                personal clinician plan.
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-line mt-8 flex flex-col-reverse justify-between gap-3 border-t pt-5 sm:flex-row">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => void save("draft", "save_exit")}
            >
              <Save aria-hidden="true" /> Save and exit
            </Button>
          </div>
          {step < steps.length - 1 ? (
            <Button type="button" disabled={saving} onClick={() => void save("draft", "continue")}>
              {saving ? "Saving…" : "Save and continue"} <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={() => void save("complete")}>
              {saving ? "Generating…" : "Generate care plan"} <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
