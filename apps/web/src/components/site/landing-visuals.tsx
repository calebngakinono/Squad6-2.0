/**
 * Visuals for the landing page. Everything here shows the product's real rules (scoring rule v1,
 * squad size, standings scopes, evidence categories), never invented people, workouts or numbers:
 * hard rule 5 in CLAUDE.md and docs/data-integrity.md.
 */
import {
  Activity,
  Dumbbell,
  Footprints,
  HeartPulse,
  MapPin,
  Pause,
  Play,
  Smartphone,
  Square,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

/** Points under scoring rule v1 (docs/scoring-proposal.md §1). */
export const scoring = { base: 170, verification: 30, performance: 50, max: 250 } as const;

function Window({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card text-card-foreground shadow-[0_24px_60px_-30px_rgb(20_40_30/0.35)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <p className="text-[0.9375rem] font-medium">{title}</p>
        {meta ? <p className="text-[0.8125rem] text-muted-foreground">{meta}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** The lit ground a window sits on. */
export function LitFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] bg-[radial-gradient(120%_90%_at_20%_0%,var(--brand-soft),var(--surface)_60%)] ${className}`}
    >
      {children}
    </div>
  );
}

const parts = [
  { key: "base", label: "Base", note: "An eligible workout", value: `${scoring.base}` },
  { key: "verification", label: "Verification", note: "Independent evidence", value: `0 to ${scoring.verification}` },
  { key: "performance", label: "Performance", note: "Effort and intensity", value: `0 to ${scoring.performance}` },
] as const;

/** The hero window: how one workout is scored. */
export function ScoringWindow({ className = "" }: { className?: string }) {
  return (
    <Window title="How a workout is scored" meta="Scoring rules v1" className={className}>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
        <span className="bg-brand" style={{ width: `${(scoring.base / scoring.max) * 100}%` }} />
        <span className="bg-brand/55" style={{ width: `${(scoring.verification / scoring.max) * 100}%` }} />
        <span className="bg-brand/25" style={{ width: `${(scoring.performance / scoring.max) * 100}%` }} />
      </div>
      <dl className="mt-5 divide-y divide-border">
        {parts.map((p, i) => (
          <div key={p.key} className="flex items-center justify-between gap-4 py-3">
            <dt className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-full ${i === 0 ? "bg-brand" : i === 1 ? "bg-brand/55" : "bg-brand/25"}`}
              />
              <span>
                <span className="block font-medium">{p.label}</span>
                <span className="block text-sm text-muted-foreground">{p.note}</span>
              </span>
            </dt>
            <dd className="font-mono text-[0.9375rem] tabular-nums">{p.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-4">
          <dt className="font-medium">Most one workout can earn</dt>
          <dd className="font-mono text-lg font-medium tabular-nums">{scoring.max}</dd>
        </div>
      </dl>
    </Window>
  );
}

/** The small card over the hero window: where the squad's points count. */
export function StandingsCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-4 shadow-[0_18px_40px_-24px_rgb(20_40_30/0.45)] ${className}`}
    >
      <p className="text-sm font-medium">Squad standings</p>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {["City", "Country", "World"].map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1.5 text-[0.8125rem] ${i === 0 ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground"}`}
          >
            {s}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[0.8125rem] text-muted-foreground">Ranked from 4 members</p>
    </div>
  );
}

/** Six seats: the size of a squad. One is you; the rest are open. */
export function SquadSeats() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 ${
            i === 0
              ? "bg-brand text-primary-foreground"
              : "border border-dashed border-foreground/25 text-muted-foreground"
          }`}
        >
          <UserRound className="size-6 sm:size-7" aria-hidden="true" strokeWidth={1.6} />
          <span className="text-sm">{i === 0 ? "You" : `Seat ${i + 1}`}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- The four step visuals for "How it works" ---------- */

export function JoinVisual() {
  return (
    <Window title="Join a squad" meta="Invite code">
      <p className="text-sm text-muted-foreground">Enter the 8-character code from your captain.</p>
      <div className="mt-4 grid grid-cols-8 gap-1.5" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="aspect-[3/4] rounded-lg border border-border bg-background" />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm">
        <span>Request to join</span>
        <span className="text-muted-foreground">Captain approves</span>
      </div>
    </Window>
  );
}

export function RecordVisual() {
  return (
    <Window title="Live workout" meta="Run">
      <p className="text-center font-mono text-5xl font-medium tracking-tight tabular-nums">00:00</p>
      <div className="mt-5 flex justify-center gap-3" aria-hidden="true">
        <span className="grid size-12 place-items-center rounded-full bg-brand text-primary-foreground">
          <Play className="size-5" />
        </span>
        <span className="grid size-12 place-items-center rounded-full bg-surface">
          <Pause className="size-5" />
        </span>
        <span className="grid size-12 place-items-center rounded-full bg-surface">
          <Square className="size-4" />
        </span>
      </div>
      <ul className="mt-5 grid gap-2 text-sm">
        <li className="flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-2.5">
          <MapPin className="size-4 text-brand" aria-hidden="true" /> GPS on runs, walks, hikes and rides
        </li>
        <li className="flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-2.5">
          <Footprints className="size-4 text-brand" aria-hidden="true" /> Steps from your phone
        </li>
      </ul>
    </Window>
  );
}

const categories = [
  { icon: MapPin, label: "Location", note: "GPS track" },
  { icon: Activity, label: "Motion", note: "Steps and cadence" },
  { icon: HeartPulse, label: "Heart rate", note: "Watch or strap" },
  { icon: Smartphone, label: "Platform record", note: "Apple Health" },
  { icon: Dumbbell, label: "Live set log", note: "Strength sets" },
] as const;

export function EvidenceVisual() {
  return (
    <Window title="Evidence categories" meta="Bonus 0 to 30">
      <ul className="grid gap-2">
        {categories.map(({ icon: Icon, label, note }) => (
          <li key={label} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5 text-sm">
            <span className="flex items-center gap-2.5">
              <Icon className="size-4 text-brand" aria-hidden="true" /> {label}
            </span>
            <span className="text-muted-foreground">{note}</span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

export function StandingsVisual() {
  return (
    <Window title="Squad standings" meta="Season Jan 1 to Dec 31">
      <div className="flex gap-1.5" aria-hidden="true">
        {["City", "Country", "World"].map((s, i) => (
          <span
            key={s}
            className={`flex-1 rounded-full px-3 py-2 text-center text-sm ${i === 0 ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground"}`}
          >
            {s}
          </span>
        ))}
      </div>
      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-border pb-3">
          <dt className="text-muted-foreground">Squad score</dt>
          <dd>Plain total of its points</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border pb-3">
          <dt className="text-muted-foreground">Ranked</dt>
          <dd>From 4 members</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Individual ranking</dt>
          <dd>None</dd>
        </div>
      </dl>
    </Window>
  );
}
