import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/site/doc-page";
import { mailto, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using Squad Six: eligibility, fair play, squads, points, and your account.",
};

const contents = [
  { id: "agreement", label: "Agreement" },
  { id: "eligibility", label: "Who can use Squad Six" },
  { id: "account", label: "Your account" },
  { id: "fair-play", label: "Fair play" },
  { id: "squads", label: "Squads and conduct" },
  { id: "points", label: "Points and standings" },
  { id: "health", label: "Your health" },
  { id: "service", label: "The service" },
  { id: "liability", label: "Liability" },
  { id: "ending", label: "Ending your account" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  return (
    <DocPage
      title="Terms of use"
      intro={<p>The rules for using the Squad Six app and this website, in plain language.</p>}
      updated={site.policyEffectiveDateLabel}
      contents={contents}
    >
      <h2 id="agreement">Agreement</h2>
      <p>
        By creating an account or using Squad Six, you agree to these terms and to our{" "}
        <Link href="/privacy">privacy policy</Link>. If you do not agree, please do not use the app.
      </p>

      <h2 id="eligibility">Who can use Squad Six</h2>
      <ul>
        <li>
          You must be at least {site.minimumAge} years old, and old enough where you live to agree to these terms
          yourself or with a parent&rsquo;s or guardian&rsquo;s permission.
        </li>
        <li>You need a supported iPhone. Other platforms are not available yet.</li>
        <li>One person, one account. Accounts may not be shared, sold or transferred.</li>
      </ul>

      <h2 id="account">Your account</h2>
      <ul>
        <li>Give accurate sign-up details and keep your password to yourself.</li>
        <li>You are responsible for what happens under your account. Tell us at once if you think someone else has used it.</li>
        <li>
          Your display name and city are visible to other users. Do not use a name that impersonates someone or is
          offensive.
        </li>
      </ul>

      <h2 id="fair-play">Fair play</h2>
      <p>Standings only mean something if every workout is real. So:</p>
      <ul>
        <li>Record only workouts you actually did, while you do them.</li>
        <li>
          Do not fake evidence: no mock-location apps, borrowed devices, workouts recorded by someone else,
          hand-entered health records presented as recorded ones, or modified versions of the app.
        </li>
        <li>Do not split one workout into several, or try to get points twice for the same activity.</li>
        <li>Do not interfere with the service, other users&rsquo; accounts or our systems.</li>
      </ul>
      <p>
        Workouts that look unusual may be flagged and reviewed. A flagged workout earns no points until it is
        reviewed. If we find that a workout was not genuine, we may remove its points, correct the standings, and
        suspend or close the account. Corrections are recorded with a reason, and you can see the decision on your
        workout.
      </p>

      <h2 id="squads">Squads and conduct</h2>
      <ul>
        <li>A squad has at most {site.maxSquadSize} members, and you can be in one squad at a time.</li>
        <li>
          Each squad has a captain, who approves join requests and can remove members or hand over the captaincy.
        </li>
        <li>
          Be respectful. No harassment, hate, threats, sexual content, spam or sharing other people&rsquo;s
          private information, including in squad names and descriptions.
        </li>
        <li>We may rename, remove or close squads and accounts that break these rules.</li>
      </ul>

      <h2 id="points">Points and standings</h2>
      <ul>
        <li>
          Points are calculated by our server under published scoring rules. Your phone never decides your points.
          We may change the rules between versions; each award records the version it used.
        </li>
        <li>
          Points stay with the squad you were in when you earned them. They are not moved if you leave or switch
          squads.
        </li>
        <li>
          Squads are ranked by the plain total of their points in their city, their country and the world, once
          they have {site.rankedFromMembers} members. A season runs from January 1 to December 31.
        </li>
        <li>
          <strong>Points have no cash value.</strong> They cannot be bought, sold, transferred or exchanged for
          money, goods or services.
        </li>
        <li>
          <strong>No prizes are offered.</strong> Squad Six does not currently offer prizes, rewards or drawings. If
          we offer any in the future, they will come with their own official rules, and nothing in the app or on
          this website promises one.
        </li>
        <li>
          Paid subscriptions are not available yet. If they launch, they will never change points, eligibility or
          rankings.
        </li>
      </ul>

      <h2 id="health">Your health</h2>
      <p>
        Squad Six is a fitness accountability app, not medical advice. Talk to a doctor before starting a new
        exercise programme if you have any health concerns, stop if you feel pain or unwell, and exercise
        within your limits. Do not use the app in ways that put you or others at risk, for example looking at your
        phone while cycling in traffic. Points are capped so that longer or harder is not always better.
      </p>

      <h2 id="service">The service</h2>
      <ul>
        <li>
          Squad Six is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. It is new software in active
          development, and features may change, be added or be removed.
        </li>
        <li>
          Measurements depend on your phone, its sensors and its settings. GPS, step counts and Apple Health data
          can be missing or inaccurate, and a workout may earn fewer points than you expect as a result.
        </li>
        <li>We may pause or stop the service, in whole or in part, and will give notice in the app where we can.</li>
        <li>
          The Squad Six name, app and website belong to us. City names come from GeoNames, licensed under CC BY 4.0.
        </li>
      </ul>

      <h2 id="liability">Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, for lost points or
        standings, or for injury that results from exercise you choose to do. Nothing in these terms limits rights
        you have under consumer law that cannot be waived.
      </p>

      <h2 id="ending">Ending your account</h2>
      <p>
        You can stop using Squad Six and delete your account at any time in the app, under Settings, then Delete
        account, or by emailing us. Deletion removes your personal data as described in the{" "}
        <Link href="/privacy#keep">privacy policy</Link>; points already counted for a squad stay with that squad
        without your name. We may suspend or close an account that breaks these terms.
      </p>

      <h2 id="changes">Changes to these terms</h2>
      <p>
        We may update these terms. We will change the effective date above and tell you in the app before a
        significant change takes effect. Continuing to use Squad Six after that means you accept the new terms.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these terms: <a href={mailto("Terms question")}>{site.contactEmail}</a>. For help with the
        app, see the <Link href="/support">support page</Link>.
      </p>
    </DocPage>
  );
}
