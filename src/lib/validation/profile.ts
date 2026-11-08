import { z } from "zod";
import { fullNameSchema } from "./auth";
import { handleSchema } from "./workspace";
import { isValidTimeZone } from "@/lib/utils/timezones";

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Choose a timezone")
  .refine(isValidTimeZone, "Choose a valid timezone");

export const jobTitleSchema = z.string().trim().max(80, "Use at most 80 characters");

export const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//.test(v), "Avatar must be an http(s) URL");

export const onboardingProfileSchema = z.object({
  fullName: fullNameSchema,
  jobTitle: jobTitleSchema,
  timezone: timezoneSchema,
  avatarUrl: avatarUrlSchema,
});

export const profileSettingsSchema = z.object({
  fullName: fullNameSchema,
  handle: handleSchema,
  jobTitle: jobTitleSchema,
  timezone: timezoneSchema,
  avatarUrl: avatarUrlSchema,
});

export const preferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  reducedMotion: z.boolean(),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  weekendStreakProtection: z.boolean(),
  showOnLeaderboard: z.boolean(),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
