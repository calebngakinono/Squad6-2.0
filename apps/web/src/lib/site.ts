/**
 * Facts the public website repeats on several pages. Change them here, nowhere else.
 */
export const site = {
  name: "Squad Six",
  /** Where people write for help, privacy requests and account questions. NEEDS CONFIRMATION by Caleb. */
  contactEmail: "support@squadsix.app",
  /** Effective date of the privacy policy and terms (ISO date and how it is printed). */
  policyEffectiveDate: "2026-11-17",
  policyEffectiveDateLabel: "November 17, 2026",
  /** Minimum age to create an account. NEEDS CONFIRMATION by Caleb (and the legal review). */
  minimumAge: 13,
  maxSquadSize: 6,
  rankedFromMembers: 4,
} as const;

export const navLinks = [
  { href: "/#how", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
] as const;

export const mailto = (subject?: string) =>
  `mailto:${site.contactEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
