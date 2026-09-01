import type { Colorway, FormSettings, Institution } from "../types";

/**
 * Accent colourways.
 *
 * The school's white-and-orange is the default and stays the default. The other
 * three exist for one practical reason: when School, +2 and College are all
 * collecting at three desks in the same hall, a parent needs to see at a glance
 * that they are at the right one. The mark, the address and the layout never
 * change — only the accent does.
 *
 * "auto" reads the accent off whichever letterhead the form carries.
 */

const BY_INSTITUTION: Record<Institution, Exclude<Colorway, "brand" | "auto">> = {
  school: "royal",
  plus2: "amber",
  college: "navy",
};

export function resolveColorway(settings: {
  colorway?: Colorway;
  institution: Institution;
}): Colorway {
  const c = settings.colorway ?? "brand";
  if (c !== "auto") return c;
  return BY_INSTITUTION[settings.institution] ?? "royal";
}

/** The class the form root wears. "brand" adds nothing — it is the base sheet. */
export function colorwayClass(settings: Pick<FormSettings, "colorway" | "institution">): string {
  const c = resolveColorway(settings);
  return c === "brand" ? "" : `cw-${c}`;
}

export const COLORWAYS: { id: Colorway; label: string; note: string; swatch: string }[] = [
  { id: "brand", label: "School orange", note: "The default. White and orange.", swatch: "#F06522" },
  { id: "auto", label: "Match the letterhead", note: "Royal for School, amber for +2, navy for College.", swatch: "linear-gradient(120deg,#2455C4 0 33%,#D9820A 33% 66%,#1B3A63 66%)" },
  { id: "royal", label: "Royal blue", note: "Steady and formal.", swatch: "#2455C4" },
  { id: "amber", label: "Warm amber", note: "Bright without shouting.", swatch: "#D9820A" },
  { id: "navy", label: "Deep navy", note: "Quiet and academic.", swatch: "#1B3A63" },
];
