import { z } from "zod";

// Squad join requests (supabase/migrations/*_squads.sql, *_join_request_details.sql).
// The server decides everything; these schemas only check what the app sends and reads.

export const JOIN_NOTE_MAX = 280;

/** Payload for request_to_join(). The note is optional; blank means none. */
export const joinRequestInputSchema = z.object({
  invite_code: z.string().trim().min(1).max(20),
  note: z
    .string()
    .trim()
    .max(JOIN_NOTE_MAX)
    .optional()
    .transform((n) => (n ? n : undefined)),
});
export type JoinRequestInput = z.input<typeof joinRequestInputSchema>;

/** One row of squad_join_request_details(): what the captain sees before deciding. */
export const joinRequestDetailSchema = z.object({
  request_id: z.string(),
  user_id: z.string(),
  display_name: z.string().nullable(),
  note: z.string().nullable(),
  requested_at: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  member_since: z.string(),
  season: z.number().int(),
  season_workouts: z.number().int(),
  season_points: z.number(),
});
export type JoinRequestDetail = z.infer<typeof joinRequestDetailSchema>;
