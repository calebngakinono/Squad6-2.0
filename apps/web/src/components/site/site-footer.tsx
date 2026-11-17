import Link from "next/link";
import { cacheLife } from "next/cache";
import { mailto, site } from "@/lib/site";
import { Logo } from "./logo";

const footerLinks = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/support", label: "Support" },
] as const;

// Cached so the page can still be prerendered (Cache Components treats the clock as dynamic).
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="wrap grid gap-10 py-14 md:grid-cols-12 md:gap-6 md:py-16">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-muted-foreground">
            Fitness accountability in squads of up to six. Coming to iPhone.
          </p>
        </div>
        <nav aria-label="Footer" className="md:col-span-3 md:col-start-7">
          <h2 className="text-sm font-medium text-muted-foreground">Squad Six</h2>
          <ul className="mt-3 grid gap-1">
            {footerLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="link inline-flex min-h-11 items-center">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-3 md:col-start-10">
          <h2 className="text-sm font-medium text-muted-foreground">Contact</h2>
          <p className="mt-3">
            <a href={mailto()} className="link inline-flex min-h-11 items-center">
              {site.contactEmail}
            </a>
          </p>
        </div>
      </div>
      <div className="wrap flex flex-col gap-2 border-t border-border py-6 text-sm text-muted-foreground md:flex-row md:justify-between">
        <p>
          © <CurrentYear /> {site.name}
        </p>
        <p>
          City data ©{" "}
          <a href="https://www.geonames.org/" className="link-underlined" rel="noopener">
            GeoNames (geonames.org)
          </a>
          ,{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="link-underlined"
            rel="noopener license"
          >
            CC BY 4.0
          </a>
        </p>
      </div>
    </footer>
  );
}
