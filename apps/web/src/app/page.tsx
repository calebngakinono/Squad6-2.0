import Link from "next/link";
import { HeartPulse, MapPin, Trash2 } from "lucide-react";
import { HowItWorks } from "@/components/site/how-it-works";
import {
  EvidenceVisual,
  JoinVisual,
  LitFrame,
  RecordVisual,
  ScoringWindow,
  SquadSeats,
  StandingsCard,
  StandingsVisual,
  scoring,
} from "@/components/site/landing-visuals";
import { mailto } from "@/lib/site";

/*
  Landing page plan (design-taste-frontend):
  kind software · hero "collage" (text left, the scoring window on a lit frame right, one small card)
  · rhythm dark-band (#points) · buttons pill · mark initial tile · moment pinned-chapters (#how)
  · close-word. Palette and type are Caleb's brand direction (warm neutral, #1F6F4A, Geist), not dealt.
*/

const screen = "lg:min-h-[calc(100svh-var(--nav-h))]";
const h2 = "text-[1.875rem] leading-[1.1] font-medium tracking-[-0.025em] sm:text-[2.5rem] lg:text-5xl";

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className={`flex items-center py-14 sm:py-20 ${screen}`}>
        <div className="wrap grid items-center gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <p className="enter text-sm text-muted-foreground" style={{ ["--i" as string]: 0 }}>
              <span className="mr-2 inline-block size-2 rounded-full bg-brand align-middle" aria-hidden="true" />
              Coming to iPhone · Seasons run January 1 to December 31
            </p>
            <h1
              className="enter mt-5 text-[2.5rem] leading-[1.03] text-balance font-medium tracking-[-0.035em] sm:text-[3.5rem] lg:text-[4rem]"
              style={{ ["--i" as string]: 1 }}
            >
              Fitness accountability for squads of up to six
            </h1>
            <p
              className="enter mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
              style={{ ["--i" as string]: 2 }}
            >
              Start or join a squad, record each workout live on your phone, and earn points our server
              calculates from real evidence. Your squad&rsquo;s total counts in your city, your country and the
              world.
            </p>
            <div className="enter mt-8 flex flex-col gap-3 sm:flex-row" style={{ ["--i" as string]: 3 }}>
              <Link href="#how" className="btn btn-primary">
                See how it works
              </Link>
              <Link href="/privacy" className="btn btn-secondary">
                Read the privacy policy
              </Link>
            </div>
          </div>
          <LitFrame className="enter grid place-items-center p-6 sm:p-10 lg:col-span-6 lg:col-start-7 lg:min-h-[560px] lg:p-14">
            <div className="relative mx-auto w-full max-w-md">
              <ScoringWindow />
              <StandingsCard className="mt-4 sm:mr-8 sm:-ml-8 sm:w-64" />
            </div>
          </LitFrame>
        </div>
      </section>

      {/* Squads */}
      <section id="squads" className={`bg-surface py-24 sm:py-28 lg:py-32 ${screen}`}>
        <div className="wrap grid gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <h2 className={h2}>A squad is six people at most</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              You train on your own schedule. Every workout you finish adds to your squad&rsquo;s total for the
              season, so the other five notice when you skip a week.
            </p>
            <dl className="mt-10 grid gap-0 border-t border-border">
              {[
                ["Joining", "An 8-character invite code; the captain approves each request"],
                ["One squad", "You belong to one squad at a time"],
                ["Teammates see", "Your display name and city, never your route"],
                ["Leaving", "Points you earned stay with the squad"],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 border-b border-border py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <LitFrame className="p-6 sm:p-12">
              <div className="mx-auto max-w-md">
                <SquadSeats />
              </div>
            </LitFrame>
          </div>
        </div>
      </section>

      {/* How it works: the page's one scroll moment */}
      <HowItWorks
        id="how"
        heading="How Squad Six works"
        intro="Four steps, from joining a squad to seeing where it stands."
        steps={[
          {
            title: "Join or start a squad",
            body: "Start a squad in your city, or join one with its invite code. The captain approves who joins, up to six people.",
            visual: <JoinVisual />,
          },
          {
            title: "Record a live workout",
            body: "Press start on your phone when you begin and finish when you are done. Runs, walks, hikes and rides use GPS.",
            visual: <RecordVisual />,
          },
          {
            title: "Earn points from evidence",
            body: "Our server checks what your phone measured and scores the workout. A timer on its own earns no points.",
            visual: <EvidenceVisual />,
          },
          {
            title: "See your squad's standing",
            body: "Your squad's total ranks against other squads in your city, your country and the world, all season.",
            visual: <StandingsVisual />,
          },
        ]}
      />

      {/* Fair points: the dark band */}
      <section id="points" className={`bg-band py-24 text-band-foreground sm:py-28 lg:py-32 ${screen}`}>
        <div className="wrap">
          <h2 className={`${h2} max-w-3xl`}>How points are calculated</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-band-muted">
            The same rules apply to everyone in the season, and every point traces back to one workout.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-3 sm:gap-6" aria-label="Points for one workout">
            {[
              [`${scoring.base}`, "Base, for an eligible workout"],
              [`0–${scoring.verification}`, "Verification, from evidence"],
              [`0–${scoring.performance}`, "Performance, from effort"],
            ].map(([n, label]) => (
              <div key={label} className="border-t border-band-foreground/20 pt-4">
                <p className="font-mono text-[1.75rem] leading-none tracking-tight tabular-nums sm:text-5xl lg:text-6xl">
                  {n}
                </p>
                <p className="mt-3 text-sm text-band-muted sm:text-base">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-band-muted">
            At most {scoring.max} points for one workout, under scoring rules version 1.
          </p>

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            {[
              {
                t: "Scored by the server",
                b: "Your phone sends what it measured. The server decides the points, and each workout is awarded once.",
              },
              {
                t: "Evidence counts, brands do not",
                b: "The bonus counts kinds of evidence, never the make of your watch. A phone alone reaches most of it.",
              },
              {
                t: "No pay-to-win",
                b: "A paid plan will never change points, eligibility or rankings. Subscriptions are not available yet.",
              },
            ].map((c) => (
              <div key={c.t}>
                <h3 className="text-xl font-medium tracking-[-0.01em]">{c.t}</h3>
                <p className="mt-2 leading-relaxed text-band-muted">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy in short */}
      <section id="privacy" className={`py-24 sm:py-28 lg:py-32 ${screen}`}>
        <div className="wrap">
          <h2 className={`${h2} max-w-3xl`}>What your squad can see</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Other members see your display name and the city you chose. The rest of your data stays with you.
          </p>
          <ul className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              {
                icon: MapPin,
                t: "Your route stays private",
                b: "GPS points from outdoor workouts are visible to you alone. Teammates and standings show your city at most.",
              },
              {
                icon: HeartPulse,
                t: "Apple Health is optional",
                b: "If you connect it, Squad Six reads workouts and heart rate to check a workout. It writes nothing back.",
              },
              {
                icon: Trash2,
                t: "Delete your account in the app",
                b: "Deleting removes your personal data. Points already counted for your squad stay, with your name removed.",
              },
            ].map(({ icon: Icon, t, b }) => (
              <li key={t} className="rounded-3xl bg-surface p-7 sm:p-8">
                <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-xl font-medium tracking-[-0.01em]">{t}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{b}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10">
            <Link href="/privacy" className="link text-lg font-medium text-brand">
              Read the full privacy policy
            </Link>
          </p>
        </div>
      </section>

      {/* Close */}
      <section id="iphone" className={`flex flex-col justify-between bg-surface pt-24 sm:pt-28 lg:pt-32 ${screen}`}>
        <div className="wrap grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
          <div className="lg:col-span-7">
            <h2 className={h2}>Squad Six is coming to iPhone</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              The first build is in testing now. There is no App Store download yet; this site will link to it
              once there is one. Until then, questions go to support.
            </p>
          </div>
          <div className="lg:col-span-5 lg:flex lg:justify-end">
            <a href={mailto("Squad Six question")} className="btn btn-primary w-full sm:w-auto">
              Email support
            </a>
          </div>
        </div>
        <p
          aria-hidden="true"
          className="wrap mt-16 overflow-hidden pb-2 text-[clamp(3.5rem,17vw,15rem)] leading-[0.85] font-medium tracking-[-0.055em] whitespace-nowrap text-brand/90 select-none"
        >
          Squad Six
        </p>
      </section>
    </main>
  );
}
