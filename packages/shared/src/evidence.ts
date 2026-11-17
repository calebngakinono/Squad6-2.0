import { z } from "zod";

// A summary of a workout recorded by another app or a watch, read from Apple Health (later Health
// Connect) after a Squad Six workout and attached as evidence. Mirrors the checks in
// supabase/migrations/*_workout_evidence.sql. Summaries only: no raw samples, no routes.

export const EVIDENCE_PROVIDERS = ["healthkit", "health_connect"] as const;
export type EvidenceProvider = (typeof EVIDENCE_PROVIDERS)[number];

/** Records written by Squad Six itself are not independent evidence. */
export const OWN_BUNDLE_ID = "com.squadsix.app";

const heartRate = z.number().min(25).max(250);

export const platformEvidenceSchema = z
  .object({
    provider: z.enum(EVIDENCE_PROVIDERS),
    id: z.string().min(1).max(100),
    source_name: z.string().max(100).nullable(),
    bundle_id: z.string().min(1).max(200),
    device_name: z.string().max(100).nullable(),
    activity: z.string().max(60).nullable(),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    user_entered: z.boolean(),
    distance_m: z.number().min(0).max(1_000_000).nullable(),
    energy_kcal: z.number().min(0).max(20_000).nullable(),
    hr_samples: z.number().int().min(0).nullable(),
    hr_minutes: z.number().int().min(0).max(720).nullable(),
    hr_min: heartRate.nullable(),
    hr_avg: heartRate.nullable(),
    hr_max: heartRate.nullable(),
  })
  .refine((e) => Date.parse(e.end) > Date.parse(e.start), "must end after it starts");
export type PlatformEvidence = z.infer<typeof platformEvidenceSchema>;

/** What the server stored, as read back for the workout summary. */
export const attachedEvidenceSchema = z.object({
  provider: z.enum(EVIDENCE_PROVIDERS),
  source_name: z.string().nullable(),
  device_name: z.string().nullable(),
  overlap: z.number(),
  hr_avg: z.number().nullable(),
});
export type AttachedEvidence = z.infer<typeof attachedEvidenceSchema>;
