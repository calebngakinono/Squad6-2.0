import { inviteLink } from "./errors";

// Words for inviting people into a squad. Pure (no React Native), so they are unit-tested.

export const SQUAD_MAX = 6;
/** A squad is ranked once it has this many members (squad_standings). */
export const RANKED_AT = 4;

const people = (n: number) => `${n} more ${n === 1 ? "member" : "members"}`;

/**
 * The reason to invite, for a squad that still has room. Below four members it is about getting
 * ranked; from four up, about the seats left. Null when the squad is full.
 */
export function inviteReason(squadName: string, members: number): string | null {
  if (members >= SQUAD_MAX) return null;
  if (members < RANKED_AT) return `${people(RANKED_AT - members)} and ${squadName} gets ranked.`;
  const open = SQUAD_MAX - members;
  return `Room for ${open} more.`;
}

/** The text the share sheet sends. */
export function inviteMessage(squadName: string, code: string): string {
  return `Join my squad "${squadName}" on Squad Six. Code: ${code}\n${inviteLink(code)}`;
}
