"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LitFrame } from "./landing-visuals";

export type Step = { title: string; body: string; visual: ReactNode };

// Pinned only on a wide, tall-enough screen with motion allowed; everywhere else the steps stand as rows.
const LIVE_QUERY = "(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(LIVE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getLive = () => window.matchMedia(LIVE_QUERY).matches;
const getLiveOnServer = () => false;

/**
 * "Pinned chapters": the section holds on screen for one screen of scroll while its steps open one at
 * a time on the left and the frame on the right changes to that step's picture. Native scrolling
 * (position: sticky); nothing else on the page moves with the scroll.
 */
export function HowItWorks({
  id,
  heading,
  intro,
  steps,
}: {
  id: string;
  heading: string;
  intro: string;
  steps: Step[];
}) {
  const live = useSyncExternalStore(subscribe, getLive, getLiveOnServer);
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!live) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = el.offsetHeight - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      setActive(Math.min(steps.length - 1, Math.floor(p * steps.length)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [live, steps.length]);

  const head = (
    <div className="max-w-xl">
      <h2 className="text-[1.875rem] leading-[1.1] font-medium tracking-[-0.025em] sm:text-[2.5rem] lg:text-5xl">
        {heading}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>
    </div>
  );

  if (!live) {
    return (
      <section id={id} ref={ref} className="py-24 sm:py-28 lg:py-32">
        <div className="wrap">
          {head}
          <ol className="mt-12 grid gap-12 sm:mt-14">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="grid gap-6 border-t border-border pt-8 md:grid-cols-2 md:items-center md:gap-12"
              >
                <div>
                  <p className="font-mono text-sm text-brand">Step {i + 1}</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
                <LitFrame className="p-5 sm:p-8">
                  <div className="mx-auto max-w-sm">{s.visual}</div>
                </LitFrame>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section id={id} ref={ref} className="relative h-[200svh]" data-moment="pinned-chapters">
      <div className="sticky top-0 flex h-svh items-center pt-[var(--nav-h)]">
        <div className="wrap grid grid-cols-12 items-center gap-6">
          <div className="col-span-5">
            {head}
            <ol className="mt-10 grid gap-1">
              {steps.map((s, i) => {
                const on = i === active;
                return (
                  <li
                    key={s.title}
                    aria-current={on ? "step" : undefined}
                    className={`border-l-2 py-3 pl-5 transition-colors duration-300 ${on ? "border-brand" : "border-border"}`}
                  >
                    <h3
                      className={`text-xl font-medium tracking-[-0.01em] transition-colors duration-300 ${on ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <span className="mr-2 font-mono text-sm text-brand">{i + 1}</span>
                      {s.title}
                    </h3>
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <p className="min-h-0 overflow-hidden pt-1.5 leading-relaxed text-muted-foreground">
                        {s.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <LitFrame className="col-span-6 col-start-7 aspect-[5/6] max-h-[calc(100svh-var(--nav-h)-96px)] w-full">
            {steps.map((s, i) => (
              <div
                key={s.title}
                aria-hidden={i !== active}
                className={`absolute inset-0 grid place-items-center p-10 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${
                  i === active ? "z-10 scale-100 opacity-100" : "scale-[1.03] opacity-0"
                }`}
              >
                <div className="w-full max-w-sm">{s.visual}</div>
              </div>
            ))}
          </LitFrame>
        </div>
      </div>
    </section>
  );
}
