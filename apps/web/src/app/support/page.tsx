import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DocPage } from "@/components/site/doc-page";
import { mailto, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Squad Six, delete your account, and answers to common questions about points and squads.",
};

const faq: { q: string; a: ReactNode }[] = [
  {
    q: "Do I need Apple Health or a watch?",
    a: (
      <p>
        No. Squad Six works with your iPhone alone: GPS on outdoor workouts and your phone&rsquo;s step count give
        a workout its evidence. Connecting Apple Health is optional. If you do, the app reads workouts and heart
        rate (for example from an Apple Watch) to add evidence after you finish. It never writes to Apple Health.
      </p>
    ),
  },
  {
    q: "Why did my workout earn 0 points?",
    a: (
      <>
        <p>The workout summary in the app shows the reason. The usual ones are:</p>
        <ul>
          <li>
            <strong>Too short.</strong> A workout needs at least 20 minutes of active time (15 for HIIT). Paused
            time does not count.
          </li>
          <li>
            <strong>No evidence.</strong> A running timer on its own is recorded in your history but earns no
            points. Allow location for outdoor workouts and motion access for steps, or connect Apple Health.
          </li>
          <li>
            <strong>In review.</strong> A workout that looks unusual earns nothing until it has been reviewed.
          </li>
          <li>
            <strong>Daily limit.</strong> Your first scored workout of the day earns full points, the second half,
            and any more earn none.
          </li>
          <li>
            <strong>Merged.</strong> The same activity started less than 2 hours after your last one ended counts as
            one workout and is scored once.
          </li>
        </ul>
        <p>In test builds, scoring may not be switched on yet, so every workout shows 0.</p>
      </>
    ),
  },
  {
    q: "How are squads ranked?",
    a: (
      <p>
        By the plain total of every point their members earned while in the squad, in your city, your country and
        the world. Nothing is averaged. A squad is ranked once it has {site.rankedFromMembers} members; smaller
        squads are listed with their points but no rank. Points stay with the squad where they were earned. People
        are not ranked individually; you see your own season total.
      </p>
    ),
  },
  {
    q: "Who can see where I worked out?",
    a: (
      <p>
        Only you. Your GPS route is never shown to teammates or in standings; others see your city at most. See the{" "}
        <Link href="/privacy#visible">privacy policy</Link> for everything that is visible.
      </p>
    ),
  },
  {
    q: "Can I be in more than one squad?",
    a: <p>No. You can be in one squad at a time, and a squad has at most {site.maxSquadSize} members.</p>,
  },
  {
    q: "Is there an Android version?",
    a: <p>Not yet. The first release is for iPhone.</p>,
  },
];

export default function SupportPage() {
  return (
    <DocPage
      title="Support"
      intro={
        <p>
          Help with the Squad Six app. Email{" "}
          <a href={mailto("Squad Six help")} className="link-underlined text-foreground">
            {site.contactEmail}
          </a>{" "}
          and a person will reply.
        </p>
      }
    >
      <h2 id="contact">Get help</h2>
      <p>
        Email <a href={mailto("Squad Six help")}>{site.contactEmail}</a>. To help us answer quickly, include:
      </p>
      <ul>
        <li>the email address you signed up with;</li>
        <li>your iPhone model and iOS version;</li>
        <li>what you expected to happen and what happened instead, with the date and time of the workout if it is about one.</li>
      </ul>
      <p>Never send us your password. We will never ask for it.</p>

      <h2 id="delete-account">Delete your account</h2>
      <ol>
        <li>Open Squad Six and go to Settings.</li>
        <li>Tap Delete account and confirm.</li>
      </ol>
      <p>
        This removes your sign-in, profile, workouts, GPS points, step data and Apple Health summaries. Points
        already counted for your squad stay with the squad, with your name removed. Deletion cannot be undone.
      </p>
      <p>
        The Delete account option is arriving in an upcoming version of the app. If your version does not have it
        yet, or you cannot sign in, email <a href={mailto("Delete my account")}>{site.contactEmail}</a> from the
        address on your account and we will delete it for you. Details are in the{" "}
        <Link href="/privacy#keep">privacy policy</Link>.
      </p>

      <h2 id="faq">Questions</h2>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {faq.map(({ q, a }) => (
          <details key={q} className="group py-1 [&_p]:mt-3 [&_ul]:mt-3">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
              <h3 className="mt-0 text-lg">{q}</h3>
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="pb-5 text-muted-foreground [&_strong]:text-foreground">{a}</div>
          </details>
        ))}
      </div>

      <h2 id="more">More</h2>
      <p>
        How points and squads work: <Link href="/#how">How Squad Six works</Link>. The rules:{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    </DocPage>
  );
}
