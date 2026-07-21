"use client";

import { useId, useState } from "react";
import type { DatePrecision } from "@/contracts";
import { FormField, Input, Select } from "./form";

export function ApproximateDateInput({
  name = "performed",
  initialPrecision = "day",
  initialValue = "",
  legend = "When did this happen?",
  unknownDescription = "Completion will be recorded without a guessed date. The plan may ask for confirmation later.",
  unknownOptionLabel = "Completed, date unknown",
  precision: controlledPrecision,
  value: controlledValue,
  onPrecisionChange,
  onValueChange,
}: {
  name?: string;
  initialPrecision?: DatePrecision;
  initialValue?: string;
  legend?: string;
  unknownDescription?: string;
  unknownOptionLabel?: string;
  precision?: DatePrecision;
  value?: string;
  onPrecisionChange?: (precision: DatePrecision) => void;
  onValueChange?: (value: string) => void;
}) {
  const id = useId();
  const [internalPrecision, setInternalPrecision] = useState<DatePrecision>(initialPrecision);
  const precision = controlledPrecision ?? internalPrecision;
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold">{legend}</legend>
      <FormField id={`${id}-precision`} label="How precise is the date?">
        <Select
          id={`${id}-precision`}
          name={`${name}Precision`}
          value={precision}
          onChange={(event) => {
            const nextPrecision = event.target.value as DatePrecision;
            setInternalPrecision(nextPrecision);
            onPrecisionChange?.(nextPrecision);
          }}
        >
          <option value="day">Exact date</option>
          <option value="month">Month and year</option>
          <option value="year">Year only</option>
          <option value="unknown">{unknownOptionLabel}</option>
        </Select>
      </FormField>
      {precision !== "unknown" ? (
        <FormField
          id={`${id}-date`}
          label={precision === "day" ? "Date" : precision === "month" ? "Month and year" : "Year"}
          hint="CareCadence keeps this exact level of precision and will not invent a day or month."
        >
          <Input
            id={`${id}-date`}
            name={`${name}Date`}
            type={precision === "day" ? "date" : precision === "month" ? "month" : "number"}
            min={precision === "year" ? 1900 : undefined}
            max={precision === "year" ? new Date().getFullYear() : undefined}
            inputMode={precision === "year" ? "numeric" : undefined}
            {...(controlledValue === undefined
              ? { defaultValue: initialValue }
              : { value: controlledValue })}
            onChange={(event) => onValueChange?.(event.target.value)}
            required
          />
        </FormField>
      ) : (
        <p className="bg-surface-muted text-ink-soft rounded-xl p-3 text-sm leading-6">
          {unknownDescription}
        </p>
      )}
    </fieldset>
  );
}
