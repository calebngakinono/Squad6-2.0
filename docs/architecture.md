# Architecture

Revised 2026-11-04 for the video-copilot pivot. One Next.js app, one Postgres database per environment,
one AI provider behind an interface.

```
Browser
 ├─ YouTube IFrame Player (official embed): reports currentTime, state, errors 101/150
 └─ Wrench UI (garage, missions, chat)
        │  Server Actions / Route Handlers (sign-in required for AI)
        ▼
Next.js on Railway ──► Supabase (Auth, Postgres + RLS)
        │
        └─► AI provider interface ──► Gemini API (video understanding via public YouTube URL; chat)
```

| Environment | Branch | Railway | Supabase |
|---|---|---|---|
| local | any | `pnpm dev` | Docker |
| CI | PRs | — | disposable Docker DB |
| staging | `staging` | `staging` env (`web2`) | `Wrench-staging` |
| production | `main` (after Caleb approves) | `production` env (`web`) | `Wrench-prod` |

## Video status: the honesty contract

Every video in a session has exactly one status, and the UI and assistant behave accordingly:

| Status | Meaning | Assistant may |
|---|---|---|
| `analyzed` | The provider processed this public video and we stored its index | Answer about the video, cite timestamps |
| `analyzing` | The index is being built | Say so; answer general questions only |
| `embeddable_not_analyzed` | Plays fine but isn't analyzed (limits, length cap, failure) | General questions only; must say it has not seen the video |
| `not_embeddable` | Player error 101/150, private, unlisted, or removed | Nothing about the video; suggest another |

The assistant prompt receives the status. Grounded answers are only produced when the status is `analyzed`.
Each stored message records whether it was `video_grounded` or `general`.

## How a timestamp question is answered

1. The client sends `{missionId, question, currentTime}`. The server loads the vehicle, the video and a bounded
   chat history (the last N turns).
2. **Video index** (built once per video, cached and shared across users): summary plus timestamped step list,
   as Zod-validated JSON stored in `videos.analysis`.
3. **Moment call:** the provider gets the YouTube URL **clipped to a window around `currentTime`** (e.g. −30 s /
   +10 s, at a higher frame rate), the index for overall context, the vehicle, and the question.
4. The answer separates **what is visible or said** from **inference**, cites `MM:SS`, and states uncertainty.
   No torque specs, part numbers or vehicle-specific procedures unless they are shown or said in the video,
   and even then they are attributed to the video, never presented as verified for the user's car.

## Provider interface

`src/server/ai/` exposes `analyzeVideo(url)`, `answerAboutMoment(...)` and `answerGeneral(...)`. Gemini is the
only implementation for the MVP. The model id comes from an environment variable, so swapping models or
providers does not touch the UI.

## Cost and abuse controls

- AI features require sign-in, with a per-user daily question quota counted from `ai_usage`.
- The video index is cached per YouTube id, so the same video is never re-analyzed.
- Max video length for analysis (e.g. 30 min), max output tokens, and a clip window for moment questions.
- Zod validation on every input. Provider errors map to clear user messages. Usage is logged with token counts.

## Security model

RLS on every user table (owner-only). `videos` is readable by signed-in users and written only by the server.
The Gemini key is server-only (`GEMINI_API_KEY`, never `NEXT_PUBLIC_*`). The repo is public, so no secrets
go in it.

## Code layout

```
src/app/             routes (garage, missions/[id] workspace, auth)
src/features/        garage, missions, workspace, maintenance
src/server/ai/       provider interface, Gemini implementation, prompts, schemas
src/lib/             env, supabase clients, utilities
supabase/            migrations, pgTAP tests
scripts/experiments/ one-off research scripts (not shipped)
```
