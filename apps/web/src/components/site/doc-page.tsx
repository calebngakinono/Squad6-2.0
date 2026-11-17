import type { ReactNode } from "react";

/** A long-form page (privacy policy, terms, support): title block, optional contents list, body. */
export function DocPage({
  title,
  intro,
  updated,
  contents,
  children,
}: {
  title: string;
  intro: ReactNode;
  updated?: string;
  contents?: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <main className="flex-1">
      <div className="border-b border-border bg-surface">
        <div className="wrap py-16 sm:py-20">
          <h1 className="enter max-w-3xl text-[2.5rem] leading-[1.05] font-medium tracking-[-0.035em] sm:text-[3.5rem]">
            {title}
          </h1>
          <div
            className="enter mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground"
            style={{ ["--i" as string]: 1 }}
          >
            {intro}
          </div>
          {updated ? (
            <p className="enter mt-6 text-sm text-muted-foreground" style={{ ["--i" as string]: 2 }}>
              Effective {updated}
            </p>
          ) : null}
        </div>
      </div>
      <div className="wrap grid gap-10 py-14 sm:py-16 lg:grid-cols-12 lg:gap-6">
        {contents ? (
          <nav aria-label="On this page" className="lg:col-span-3">
            <div className="lg:sticky lg:top-[calc(var(--nav-h)+32px)]">
              <h2 className="text-sm font-medium text-muted-foreground">On this page</h2>
              <ol className="mt-3 grid gap-0.5 text-[0.9375rem]">
                {contents.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="link inline-flex min-h-10 items-center">
                      {c.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        ) : null}
        <article className={`prose-site min-w-0 ${contents ? "lg:col-span-8 lg:col-start-5" : "lg:col-span-8"} [&>*:first-child]:mt-0`}>
          {children}
        </article>
      </div>
    </main>
  );
}
