"use client";

import { ArrowRight, Pill, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FIXED_CONDITIONS, type FixedConditionKey } from "@/domain/profile-context/constants";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { packYearPreview } from "@/domain/profile-context/pack-years";

const anatomyLabels = {
  cervix: "Cervix",
  breast_tissue: "Breast tissue",
  prostate: "Prostate",
  uterus: "Uterus",
  ovaries: "Ovaries",
} as const;
type AnatomyKey = keyof typeof anatomyLabels;
type AnatomyState = "present" | "absent" | "unknown" | "prefer_not_to_answer";
type SexAssignedAtBirth = "female" | "male" | "intersex" | "unknown" | "prefer_not_to_answer";

export type ProfileEditorValue = {
  displayName: string;
  relationshipLabel: string;
  dateOfBirth: string;
  sexAssignedAtBirth: SexAssignedAtBirth;
  genderIdentity: string;
  timezone: string;
  carePlanMode: "evidence_based" | "extra_attentive" | "clinician_plan";
  anatomy: Record<AnatomyKey, AnatomyState>;
  healthContext: {
    tobaccoStatus: "never" | "current" | "former" | "unknown" | "prefer_not_to_answer";
    smokingStartYear: string;
    smokingEndYear: string;
    packsPerDay: string;
    heightInches: string;
    weightPounds: string;
    pregnancyStatus: "pregnant" | "not_pregnant" | "unknown" | "prefer_not_to_answer";
    immunocompromised: "yes" | "no" | "unknown";
    alcoholAssessmentPreference: "yes" | "no" | "unknown";
    fallConcern: "yes" | "no" | "unknown";
    sexualHealthRisk: "present" | "absent" | "unknown";
    conditions: Record<FixedConditionKey, boolean>;
    familyHistoryNote: string;
    surgeryNote: string;
    surgeryAnatomyKey: AnatomyKey | "";
    surgeryAnatomyState: AnatomyState | "";
    confirmSurgeryAnatomy: boolean;
  };
};

type PlanChangeCounts = {
  newly_applicable: number;
  no_longer_applicable: number;
  status_changed: number;
  due_range_changed: number;
};

function planChangeMessage(counts: PlanChangeCounts | undefined): string {
  if (counts === undefined) return "Profile saved and care plan recalculated.";
  const parts = [
    counts.newly_applicable > 0 ? `${counts.newly_applicable} added` : null,
    counts.no_longer_applicable > 0 ? `${counts.no_longer_applicable} removed` : null,
    counts.status_changed > 0 ? `${counts.status_changed} status changed` : null,
    counts.due_range_changed > 0 ? `${counts.due_range_changed} timing changed` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0
    ? "Profile saved. No care-plan status or timing changed."
    : `Profile saved. Care-plan summary: ${parts.join(", ")}.`;
}

export function ProfileEditor({
  profileId,
  initialValue,
}: {
  profileId: string;
  initialValue: ProfileEditorValue;
}) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const currentYear = new Date().getFullYear();
  const packYears = packYearPreview(
    {
      status: value.healthContext.tobaccoStatus,
      startedYear: value.healthContext.smokingStartYear,
      endedYear: value.healthContext.smokingEndYear,
      packsPerDay: value.healthContext.packsPerDay,
    },
    currentYear,
  );
  const birthYear = Number(value.dateOfBirth.slice(0, 4));
  const asksFallConcern = Number.isFinite(birthYear) && currentYear - birthYear >= 64;
  const asksPregnancy = value.anatomy.uterus !== "absent";

  function updateHealthContext(patch: Partial<ProfileEditorValue["healthContext"]>) {
    setValue((current) => ({
      ...current,
      healthContext: { ...current.healthContext, ...patch },
    }));
  }

  function updateTobaccoStatus(status: ProfileEditorValue["healthContext"]["tobaccoStatus"]) {
    updateHealthContext({
      tobaccoStatus: status,
      ...(status === "current" ? { smokingEndYear: "" } : {}),
      ...(status === "current" || status === "former"
        ? {}
        : { smokingStartYear: "", smokingEndYear: "", packsPerDay: "" }),
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...value,
          genderIdentity: value.genderIdentity || null,
          anatomy: Object.entries(value.anatomy).map(([key, state]) => ({ key, state })),
        }),
      });
      if (response.ok) {
        const result = (await response.json()) as { planChanges?: PlanChangeCounts };
        const proposal = value.healthContext.surgeryAnatomyKey;
        if (
          proposal !== "" &&
          value.healthContext.surgeryAnatomyState !== "" &&
          value.healthContext.confirmSurgeryAnatomy
        ) {
          setValue((current) => ({
            ...current,
            anatomy: {
              ...current.anatomy,
              [proposal]: current.healthContext.surgeryAnatomyState as AnatomyState,
            },
            healthContext: {
              ...current.healthContext,
              surgeryAnatomyKey: "",
              surgeryAnatomyState: "",
              confirmSurgeryAnatomy: false,
            },
          }));
        }
        setMessage({ tone: "success", text: planChangeMessage(result.planChanges) });
      } else {
        const result = (await response.json()) as {
          error?: string;
          fieldErrors?: Record<string, string[]>;
        };
        setMessage({
          tone: "error",
          text:
            Object.values(result.fieldErrors ?? {}).flat()[0] ??
            result.error ??
            "The profile could not be saved.",
        });
      }
    } catch {
      setMessage({
        tone: "error",
        text: "The profile could not be saved. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={save}>
      {message !== undefined ? (
        <Alert tone={message.tone} title={message.tone === "success" ? "Saved" : "Could not save"}>
          {message.text}
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Basics</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField id="profile-name" label="Display name">
              <Input
                id="profile-name"
                required
                maxLength={80}
                value={value.displayName}
                onChange={(event) =>
                  setValue((current) => ({ ...current, displayName: event.target.value }))
                }
              />
            </FormField>
            <FormField id="profile-relationship" label="Relationship">
              <Input
                id="profile-relationship"
                required
                maxLength={50}
                value={value.relationshipLabel}
                onChange={(event) =>
                  setValue((current) => ({ ...current, relationshipLabel: event.target.value }))
                }
              />
            </FormField>
            <FormField id="profile-birth" label="Date of birth">
              <Input
                id="profile-birth"
                type="date"
                required
                value={value.dateOfBirth}
                onChange={(event) =>
                  setValue((current) => ({ ...current, dateOfBirth: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="profile-sex-assigned"
              label="Sex assigned at birth"
              hint="Anatomy is still recorded separately and used where relevant."
            >
              <Select
                id="profile-sex-assigned"
                value={value.sexAssignedAtBirth}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    sexAssignedAtBirth: event.target.value as SexAssignedAtBirth,
                  }))
                }
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="intersex">Intersex</option>
                <option value="unknown">Unsure</option>
                <option value="prefer_not_to_answer">Prefer not to answer</option>
              </Select>
            </FormField>
            <FormField id="profile-timezone" label="Timezone">
              <Input
                id="profile-timezone"
                required
                maxLength={80}
                value={value.timezone}
                onChange={(event) =>
                  setValue((current) => ({ ...current, timezone: event.target.value }))
                }
              />
            </FormField>
            <FormField id="profile-gender" label="Gender identity (optional)">
              <Input
                id="profile-gender"
                maxLength={120}
                value={value.genderIdentity}
                onChange={(event) =>
                  setValue((current) => ({ ...current, genderIdentity: event.target.value }))
                }
              />
            </FormField>
            <FormField id="profile-mode" label="Care-plan mode">
              <Select
                id="profile-mode"
                value={value.carePlanMode}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    carePlanMode: event.target.value as ProfileEditorValue["carePlanMode"],
                  }))
                }
              >
                <option value="evidence_based">Evidence-based</option>
                <option value="extra_attentive">Extra-attentive planning window</option>
                <option value="clinician_plan">Clinician-plan emphasis</option>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Relevant anatomy</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Anatomy is used directly where guidance depends on it. Sex assigned at birth is not
            substituted for an organ or tissue.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(Object.keys(anatomyLabels) as AnatomyKey[]).map((key) => (
              <FormField key={key} id={`anatomy-${key}`} label={anatomyLabels[key]}>
                <Select
                  id={`anatomy-${key}`}
                  value={value.anatomy[key]}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      anatomy: {
                        ...current.anatomy,
                        [key]: event.target.value as AnatomyState,
                      },
                    }))
                  }
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="unknown">Unsure</option>
                  <option value="prefer_not_to_answer">Prefer not to answer</option>
                </Select>
              </FormField>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Risk context</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            These bounded fields support reviewed rules. Unknown is a valid answer and never becomes
            an invented fact.
          </p>
          <div className="mt-5 space-y-5">
            <FormField id="profile-tobacco" label="Tobacco history">
              <Select
                id="profile-tobacco"
                value={value.healthContext.tobaccoStatus}
                onChange={(event) =>
                  updateTobaccoStatus(
                    event.target.value as ProfileEditorValue["healthContext"]["tobaccoStatus"],
                  )
                }
              >
                <option value="never">Never</option>
                <option value="current">Current</option>
                <option value="former">Former</option>
                <option value="unknown">Unsure</option>
                <option value="prefer_not_to_answer">Prefer not to answer</option>
              </Select>
            </FormField>
            {value.healthContext.tobaccoStatus === "current" ||
            value.healthContext.tobaccoStatus === "former" ? (
              <div className="bg-surface-muted/60 grid gap-4 rounded-xl p-4 sm:grid-cols-3">
                <FormField id="profile-smoking-start" label="Start year">
                  <Input
                    id="profile-smoking-start"
                    type="number"
                    min={1900}
                    max={currentYear}
                    value={value.healthContext.smokingStartYear}
                    onChange={(event) =>
                      updateHealthContext({ smokingStartYear: event.target.value })
                    }
                  />
                </FormField>
                <FormField id="profile-smoking-end" label="Quit year (if former)">
                  <Input
                    id="profile-smoking-end"
                    type="number"
                    min={1900}
                    max={currentYear}
                    disabled={value.healthContext.tobaccoStatus === "current"}
                    value={value.healthContext.smokingEndYear}
                    onChange={(event) =>
                      updateHealthContext({ smokingEndYear: event.target.value })
                    }
                  />
                </FormField>
                <FormField id="profile-packs" label="Average packs/day">
                  <Input
                    id="profile-packs"
                    type="number"
                    min={0}
                    max={20}
                    step="0.1"
                    value={value.healthContext.packsPerDay}
                    onChange={(event) => updateHealthContext({ packsPerDay: event.target.value })}
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
              <FormField id="profile-height" label="Height in inches (optional)">
                <Input
                  id="profile-height"
                  type="number"
                  min={24}
                  max={110}
                  step="0.1"
                  value={value.healthContext.heightInches}
                  onChange={(event) => updateHealthContext({ heightInches: event.target.value })}
                />
              </FormField>
              <FormField id="profile-weight" label="Weight in pounds (optional)">
                <Input
                  id="profile-weight"
                  type="number"
                  min={45}
                  max={1322}
                  step="0.1"
                  value={value.healthContext.weightPounds}
                  onChange={(event) => updateHealthContext({ weightPounds: event.target.value })}
                />
              </FormField>
            </div>
            <FormField id="profile-immunocompromised" label="Immunocompromised status">
              <Select
                id="profile-immunocompromised"
                value={value.healthContext.immunocompromised}
                onChange={(event) =>
                  updateHealthContext({
                    immunocompromised: event.target.value as "yes" | "no" | "unknown",
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
                <option value="unknown">Unsure</option>
              </Select>
            </FormField>
            {asksPregnancy ? (
              <FormField
                id="profile-pregnancy"
                label="Pregnancy status"
                hint="Shown because uterus anatomy is present or unsure."
              >
                <Select
                  id="profile-pregnancy"
                  value={value.healthContext.pregnancyStatus}
                  onChange={(event) =>
                    updateHealthContext({
                      pregnancyStatus: event.target
                        .value as ProfileEditorValue["healthContext"]["pregnancyStatus"],
                    })
                  }
                >
                  <option value="pregnant">Pregnant</option>
                  <option value="not_pregnant">Not pregnant</option>
                  <option value="unknown">Unsure</option>
                  <option value="prefer_not_to_answer">Prefer not to answer</option>
                </Select>
              </FormField>
            ) : null}
            <FormField
              id="profile-alcohol-preference"
              label="Include an alcohol-use check-in?"
              hint="This is an assessment preference, not an inferred use level."
            >
              <Select
                id="profile-alcohol-preference"
                value={value.healthContext.alcoholAssessmentPreference}
                onChange={(event) =>
                  updateHealthContext({
                    alcoholAssessmentPreference: event.target
                      .value as ProfileEditorValue["healthContext"]["alcoholAssessmentPreference"],
                  })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unsure</option>
              </Select>
            </FormField>
            {asksFallConcern ? (
              <FormField id="profile-fall-concern" label="Any fall history or concern?">
                <Select
                  id="profile-fall-concern"
                  value={value.healthContext.fallConcern}
                  onChange={(event) =>
                    updateHealthContext({
                      fallConcern: event.target
                        .value as ProfileEditorValue["healthContext"]["fallConcern"],
                    })
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unknown">Unsure</option>
                </Select>
              </FormField>
            ) : null}
            <FormField
              id="profile-sexual-risk"
              label="Consent-based sexual health risk context"
              hint="Active hepatitis B and STI rules can use this broad answer; no underlying details are requested."
            >
              <Select
                id="profile-sexual-risk"
                value={value.healthContext.sexualHealthRisk}
                onChange={(event) =>
                  updateHealthContext({
                    sexualHealthRisk: event.target
                      .value as ProfileEditorValue["healthContext"]["sexualHealthRisk"],
                  })
                }
              >
                <option value="present">Increased-risk guidance may apply</option>
                <option value="absent">No known increased-risk context</option>
                <option value="unknown">Unsure or prefer not to answer</option>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Health history</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Edit the same fixed context captured during onboarding. Other diagnoses and records
            remain outside this concise setup form.
          </p>
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">Conditions or prior history</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {FIXED_CONDITIONS.map(({ key, label }) => (
                <label
                  key={key}
                  className="border-line flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="accent-brand size-4"
                    checked={value.healthContext.conditions[key]}
                    onChange={(event) =>
                      updateHealthContext({
                        conditions: {
                          ...value.healthContext.conditions,
                          [key]: event.target.checked,
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <FormField
              id="profile-family-history"
              label="First-degree family history (optional)"
              hint="Keep this to a concise condition and relationship note."
            >
              <Textarea
                id="profile-family-history"
                maxLength={1000}
                value={value.healthContext.familyHistoryNote}
                onChange={(event) => updateHealthContext({ familyHistoryNote: event.target.value })}
              />
            </FormField>
            <FormField
              id="profile-surgery"
              label="Relevant surgery note (optional)"
              hint="Update anatomy separately when surgery changed an organ or tissue."
            >
              <Textarea
                id="profile-surgery"
                maxLength={1000}
                value={value.healthContext.surgeryNote}
                onChange={(event) =>
                  updateHealthContext({
                    surgeryNote: event.target.value,
                    ...(event.target.value.trim() === ""
                      ? {
                          surgeryAnatomyKey: "",
                          surgeryAnatomyState: "",
                          confirmSurgeryAnatomy: false,
                        }
                      : {}),
                  })
                }
              />
            </FormField>
          </div>
          {value.healthContext.surgeryNote.trim() === "" ? null : (
            <div className="border-sky/30 bg-sky-soft/45 mt-4 space-y-4 rounded-xl border p-4">
              <div>
                <p className="font-semibold">Propose an anatomy update from this surgery</p>
                <p className="text-ink-soft mt-1 text-xs leading-5">
                  The proposed state is applied in the same transaction only after explicit
                  confirmation.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="profile-surgery-anatomy" label="Affected anatomy (optional)">
                  <Select
                    id="profile-surgery-anatomy"
                    value={value.healthContext.surgeryAnatomyKey}
                    onChange={(event) =>
                      updateHealthContext({
                        surgeryAnatomyKey: event.target.value as AnatomyKey | "",
                        confirmSurgeryAnatomy: false,
                      })
                    }
                  >
                    <option value="">No proposed update</option>
                    {(Object.keys(anatomyLabels) as AnatomyKey[]).map((key) => (
                      <option key={key} value={key}>
                        {anatomyLabels[key]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="profile-surgery-state" label="Proposed state">
                  <Select
                    id="profile-surgery-state"
                    disabled={value.healthContext.surgeryAnatomyKey === ""}
                    value={value.healthContext.surgeryAnatomyState}
                    onChange={(event) =>
                      updateHealthContext({
                        surgeryAnatomyState: event.target.value as AnatomyState | "",
                        confirmSurgeryAnatomy: false,
                      })
                    }
                  >
                    <option value="">Choose a state</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="unknown">Unsure</option>
                    <option value="prefer_not_to_answer">Prefer not to answer</option>
                  </Select>
                </FormField>
              </div>
              {value.healthContext.surgeryAnatomyKey === "" ||
              value.healthContext.surgeryAnatomyState === "" ? null : (
                <label className="border-line bg-surface flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="accent-brand size-4"
                    checked={value.healthContext.confirmSurgeryAnatomy}
                    onChange={(event) =>
                      updateHealthContext({ confirmSurgeryAnatomy: event.target.checked })
                    }
                  />
                  Confirm {anatomyLabels[value.healthContext.surgeryAnatomyKey]} as{" "}
                  {value.healthContext.surgeryAnatomyState.replaceAll("_", " ")}
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-editorial text-2xl font-semibold">Clinical and personal plans</h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Medication details and clinician-defined timing have dedicated workflows so this profile
            form never infers monitoring.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="secondary" asChild>
              <Link href={`/app/profile/${profileId}/medications`}>
                <Pill aria-hidden="true" /> Manage medications <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link href={`/app/profile/${profileId}/maintenance`}>
                <Stethoscope aria-hidden="true" /> Clinician or custom plan{" "}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving and recalculating…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
