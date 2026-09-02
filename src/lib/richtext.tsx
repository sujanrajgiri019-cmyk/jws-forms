import type { CSSProperties } from "react";
import type { TextStyle } from "../types";

/**
 * Text styling for question titles and help text.
 *
 * Deliberately a small set of switches rather than a rich-text editor storing
 * HTML. A form definition is a JSON file that gets read by the desktop app, by
 * a page served to phones, and by an Excel column header — pasted markup would
 * have to be sanitised in three places and would still end up in a spreadsheet
 * cell one day. Bold, italic, underline, size, colour, face and alignment cover
 * what a school actually needs, and every one of them is a value, not markup.
 */

const SIZES: Record<number, string> = {
  [-1]: "0.86em",
  0: "1em",
  1: "1.22em",
  2: "1.5em",
};

const FONTS: Record<string, string> = {
  display: "var(--display)",
  body: "var(--body)",
  mono: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
};

/** A safe hex colour, or "" — anything else is dropped rather than trusted. */
export function safeColor(c: string | undefined): string {
  if (!c) return "";
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.trim()) ? c.trim() : "";
}

export function styleToCss(t: TextStyle | undefined): CSSProperties {
  if (!t) return {};
  const css: CSSProperties = {};
  if (t.bold) css.fontWeight = 800;
  if (t.italic) css.fontStyle = "italic";
  if (t.underline) css.textDecoration = "underline";
  if (t.size) css.fontSize = SIZES[t.size] ?? "1em";
  const c = safeColor(t.color);
  if (c) css.color = c;
  if (t.font && FONTS[t.font]) css.fontFamily = FONTS[t.font];
  if (t.align) css.textAlign = t.align;
  return css;
}

/** The same, as an inline style string — used by the page served to phones. */
export function styleToInline(t: TextStyle | undefined): string {
  const css = styleToCss(t);
  return Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
    .join(";");
}

export function isStyled(t: TextStyle | undefined): boolean {
  if (!t) return false;
  return !!(t.bold || t.italic || t.underline || t.size || safeColor(t.color) || t.font || t.align);
}

/** The palette offered in the editor — the school's own, plus useful neutrals. */
export const TEXT_COLORS: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "School orange", value: "#F06522" },
  { label: "Deep orange", value: "#A83C0A" },
  { label: "Ink", value: "#201D1B" },
  { label: "Grey", value: "#6B625D" },
  { label: "Royal blue", value: "#2455C4" },
  { label: "Navy", value: "#1B3A63" },
  { label: "Green", value: "#2E7D53" },
  { label: "Red", value: "#C23D0C" },
];
