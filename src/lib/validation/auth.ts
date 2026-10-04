import { z } from "zod";
import { INVITE_CODE_LENGTH, normaliseInviteCode } from "@/lib/auth/codes";
import { LOCATION_TYPES } from "@/lib/constants";

export const PIN_LENGTH = 6;

const pin = z
  .string()
  .regex(/^\d{6}$/, `PIN must be exactly ${PIN_LENGTH} digits.`);

const displayName = z
  .string()
  .trim()
  .min(1, "Pick a display name.")
  .max(40, "Display name is 40 characters at most.");

const inviteCode = z
  .string()
  .transform(normaliseInviteCode)
  .pipe(
    z
      .string()
      .length(
        INVITE_CODE_LENGTH,
        `Invite codes are ${INVITE_CODE_LENGTH} characters.`,
      ),
  );

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Not a real date.");

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1, "Name the trip.").max(80),
    destination: z.string().trim().min(1, "Where are you going?").max(120),
    startDate: isoDate,
    endDate: isoDate,
    locationType: z.enum(LOCATION_TYPES),
    displayName,
    pin,
    confirmPin: z.string(),
  })
  .refine((values) => values.endDate >= values.startDate, {
    message: "The trip cannot end before it starts.",
    path: ["endDate"],
  })
  .refine((values) => values.pin === values.confirmPin, {
    message: "The two PINs do not match.",
    path: ["confirmPin"],
  });

export const joinSchema = z.object({
  inviteCode,
  displayName,
  pin,
});

export const resetPinSchema = z
  .object({
    memberId: z.string().uuid("Unknown member."),
    pin,
    confirmPin: z.string(),
  })
  .refine((values) => values.pin === values.confirmPin, {
    message: "The two PINs do not match.",
    path: ["confirmPin"],
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type JoinInput = z.infer<typeof joinSchema>;

export function formToObject(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export type FieldErrors = Record<string, string>;

/** First error per field, which is all the forms need to render. */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
