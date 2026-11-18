import Link from "next/link";

/** The name with a small "6" tile. Replaced by the real logo once it exists. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex min-h-11 items-center gap-2.5 text-[1.0625rem] font-medium tracking-[-0.01em] ${className}`}
      aria-label="Squad Six home"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[10px] bg-brand text-[0.9375rem] font-semibold text-primary-foreground transition-transform duration-200 group-hover:-translate-y-px"
      >
        6
      </span>
      <span>Squad Six</span>
    </Link>
  );
}
