import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/site/doc-page";
import { mailto, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What the Squad Six app collects, who can see it, which providers process it, and how to delete your account.",
};

/*
  Every statement here must match what the app does today. Sources: docs/data-integrity.md,
  docs/health-integrations.md, docs/database-schema.md and supabase/migrations/. Change this page in
  the same PR as any change to what the app collects or shows to others.
*/

const contents = [
  { id: "summary", label: "Summary" },
  { id: "collect", label: "What we collect" },
  { id: "visible", label: "Who can see what" },
  { id: "health", label: "Apple Health" },
  { id: "use", label: "How we use it" },
  { id: "processors", label: "Service providers" },
  { id: "website", label: "This website" },
  { id: "keep", label: "Keeping and deleting data" },
  { id: "rights", label: "Your choices and rights" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <DocPage
      title="Privacy policy"
      intro={
        <p>
          This policy explains what the Squad Six app and this website collect, who can see it, and what you can
          do about it. Squad Six is a fitness app where squads of up to six people record workouts and earn points
          together.
        </p>
      }
      updated={site.policyEffectiveDateLabel}
      contents={contents}
    >
      <h2 id="summary">Summary</h2>
      <ul>
        <li>We collect what the app needs to run squads, record workouts and calculate points.</li>
        <li>
          Other signed-in users can see your display name and the city you chose. Your precise location is never
          shown to anyone else.
        </li>
        <li>Apple Health access is optional and read-only. We store summaries, not raw health samples.</li>
        <li>We do not sell your data, show ads, or track you across other apps and websites.</li>
        <li>You can delete your account in the app, which removes your personal data.</li>
      </ul>

      <h2 id="collect">What we collect</h2>
      <h3>Account</h3>
      <ul>
        <li>
          <strong>Email address and password.</strong> Used to sign you in. Passwords are handled by our
          authentication provider (Supabase Auth) and stored only as a secure hash.
        </li>
      </ul>

      <h3>Profile</h3>
      <ul>
        <li>
          <strong>Display name and city.</strong> You choose your city from a fixed list of cities. Both are shown
          to other signed-in users.
        </li>
        <li>
          <strong>Home time zone.</strong> Used to decide which day and which season a workout belongs to.
          Private to you.
        </li>
        <li>
          <strong>Weekly goal and onboarding answers.</strong> Your personal weekly workout goal and the answers
          you give during setup (such as your fitness goal, experience, activities and whether you use a
          wearable). Private to you. The weekly goal does not affect points.
        </li>
      </ul>

      <h3>Squads</h3>
      <ul>
        <li>
          <strong>Membership.</strong> Which squad you are in, your role (such as captain), when you joined and
          left, and your join requests.
        </li>
      </ul>

      <h3>Workouts</h3>
      <ul>
        <li>
          <strong>Workout records.</strong> The activity, start and finish times, pauses, active time, any
          strength sets you log (exercise, reps and optional weight), and the points the workout earned with the
          reasons for them.
        </li>
        <li>
          <strong>Precise location (GPS).</strong> During an outdoor workout (run, walk, hike or ride), and only
          with your permission, the app records GPS points: position, time, accuracy, altitude and speed. Location
          is collected only while a workout you started is running, including when your screen is locked. It is
          never collected outside a workout.
        </li>
        <li>
          <strong>Step counts.</strong> Steps per minute from your phone&rsquo;s motion sensors during a workout,
          with your permission.
        </li>
        <li>
          <strong>Measurements we calculate.</strong> From the GPS points and steps, our server calculates values
          such as distance, how much of the workout had good GPS coverage, and total steps.
        </li>
      </ul>

      <h3>Points</h3>
      <ul>
        <li>
          <strong>Points ledger.</strong> Every award or correction of points, the workout it came from, the squad
          you were in at the time, the season, and the scoring-rule version used.
        </li>
        <li>
          <strong>Reviews.</strong> If a workout is flagged as unusual, a reviewer may look at its summary and
          record a decision and reason, which you can see.
        </li>
      </ul>

      <h2 id="visible">Who can see what</h2>
      <ul>
        <li>
          <strong>Other signed-in users</strong> can see your display name and city, and the names, cities and
          point totals of squads in the standings.
        </li>
        <li>
          <strong>Your squadmates</strong> can see that you are a member of the squad and your role.
        </li>
        <li>
          <strong>Only you</strong> can see your GPS routes and coordinates, step data, Apple Health summaries,
          time zone, weekly goal, onboarding answers, and your own points ledger. Teammates, feeds and standings
          show your city at most.
        </li>
        <li>
          <strong>Squad Six staff</strong> can access data when needed to run the service, review a flagged
          workout, or answer a request from you.
        </li>
      </ul>
      <p>
        Standings rank squads only. There is no public ranking of individual people; you see your own season
        total.
      </p>

      <h2 id="health">Apple Health</h2>
      <p>
        Connecting Apple Health is optional. Squad Six asks for permission only when you choose to connect it on
        the screen after a workout.
      </p>
      <ul>
        <li>
          <strong>What we read:</strong> workouts and heart rate. Access is read-only. Squad Six writes nothing to
          Apple Health.
        </li>
        <li>
          <strong>Why:</strong> only to check a workout you recorded in Squad Six. After you finish, the app looks
          for an Apple Health workout recorded at the same time (for example by an Apple Watch) and attaches it as
          evidence.
        </li>
        <li>
          <strong>What we store:</strong> a summary of the matched workout: its start and end time, the app and
          device that recorded it, and, when available, distance, active energy and a heart-rate summary (such as
          average and maximum). We do not store raw heart-rate samples or Apple Health routes.
        </li>
        <li>
          <strong>What we never do:</strong> sell health data, use it for advertising or marketing, share it with
          data brokers, or store it in iCloud.
        </li>
      </ul>
      <p>
        You can turn off access at any time in the iPhone Settings app (Privacy &amp; Security, then Health). The
        app then stops reading new data. Android and Health Connect are not supported yet.
      </p>

      <h2 id="use">How we use your data</h2>
      <ul>
        <li>To create your account and sign you in.</li>
        <li>To run squads: invites, join requests, membership and roles.</li>
        <li>To record workouts and calculate points on our server from the evidence each workout has.</li>
        <li>To show squad standings for your city, your country and the world.</li>
        <li>To detect and review unusual workouts and keep standings fair.</li>
        <li>To answer your support requests and keep the service secure.</li>
      </ul>
      <p>
        We do not sell your data, show advertising, use your data to build advertising profiles, or track you
        across other companies&rsquo; apps and websites.
      </p>

      <h2 id="processors">Service providers</h2>
      <p>We use a small number of providers to run Squad Six. They process data only to provide their service to us.</p>
      <ul>
        <li>
          <strong>Supabase</strong>: our database and sign-in provider. Stores your account and all app data
          described above.
        </li>
        <li>
          <strong>Railway</strong>: hosts this website and its server endpoints.
        </li>
        <li>
          <strong>Expo (EAS)</strong>: builds the app and delivers app updates. When the app checks for an update,
          Expo receives technical information such as your IP address and app version, not your account or
          workout data.
        </li>
        <li>
          <strong>Apple</strong>: distributes the app through TestFlight and the App Store. If you send feedback
          or crash reports through TestFlight, Apple shares them with us under its own terms.
        </li>
        <li>
          <strong>RevenueCat</strong>: would process purchases if paid subscriptions launch. Subscriptions are not
          available yet, so no data goes to RevenueCat today. We will update this policy before that changes.
        </li>
      </ul>
      <p>
        These providers may process data in countries other than your own, including the United States.
      </p>

      <h2 id="website">This website</h2>
      <p>
        This website does not use advertising, analytics or tracking cookies. Our hosting provider keeps standard
        server logs (such as IP address, browser type and the page requested) for security and troubleshooting.
      </p>
      <p>
        City names come from GeoNames (geonames.org), used under the Creative Commons Attribution 4.0 licence.
      </p>

      <h2 id="keep">Keeping and deleting data</h2>
      <p>
        We keep your data while you have an account. You can delete your account in the app under Settings, then
        Delete account. Deleting your account:
      </p>
      <ul>
        <li>removes your sign-in, profile, private settings, workouts, GPS points, step data and Apple Health summaries;</li>
        <li>
          keeps the points already counted for squads, because they are part of other people&rsquo;s standings,
          but removes your name from them so they no longer point to you.
        </li>
      </ul>
      <p>
        Copies held in our providers&rsquo; backups are removed as those backups expire. If you cannot use the app,
        email <a href={mailto("Delete my account")}>{site.contactEmail}</a> from your account&rsquo;s email address and
        we will delete it for you.
      </p>

      <h2 id="rights">Your choices and rights</h2>
      <ul>
        <li>Location, motion and Apple Health permissions can be turned off in your iPhone settings at any time.</li>
        <li>You can correct your display name and city in the app&rsquo;s settings or by emailing us.</li>
        <li>
          You can ask us for a copy of your data, to correct it, or to delete it by emailing{" "}
          <a href={mailto("Privacy request")}>{site.contactEmail}</a>. Depending on where you live, you may have
          further rights under local law; we will honour them.
        </li>
      </ul>

      <h2 id="children">Children</h2>
      <p>
        Squad Six is not meant for children under {site.minimumAge}, and we do not knowingly collect their data.
        If you believe a child under {site.minimumAge} has an account, email us and we will delete it.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        When we change what the app collects or who can see it, we update this page and its effective date, and
        we tell you in the app before a significant change takes effect.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions or requests about privacy: <a href={mailto("Privacy question")}>{site.contactEmail}</a>. See also
        our <Link href="/terms">terms of use</Link> and <Link href="/support">support page</Link>.
      </p>
    </DocPage>
  );
}
