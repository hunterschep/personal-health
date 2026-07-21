import { z } from "zod";
import { textSchema } from "./shared";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(256, "Password is too long.");

export const registrationSchema = z
  .object({
    name: textSchema("Name", 100),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    acknowledged: z.preprocess(
      (value) => value === true || value === "true" || value === "on",
      z.literal(true, { error: "Please acknowledge the privacy and medical notice." }),
    ),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
});

export const householdInputSchema = z.object({
  name: textSchema("Household name", 100),
  timezone: z.string().trim().min(1).max(80),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
});
