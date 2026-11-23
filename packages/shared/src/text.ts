// Small text helpers shared by the app and the web.

/**
 * The separator between parts of one line ("Las Vegas, Nevada ∙ 1 of 6 members").
 *
 * It is U+2219 (∙), not the usual middle dot U+00B7 (·). Overpass, the app's reading face, classes
 * U+00B7 as a mark glyph with no width, so the dot sat inside the space after it and stuck to the
 * next word ("Nevada ·1"). U+2219 is drawn the same size (450 units wide) and takes its own space.
 */
export const SEP = " ∙ ";

/** Joins the parts that exist with SEP, skipping empty ones. */
export function joinParts(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(SEP);
}
