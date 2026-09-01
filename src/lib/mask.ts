import type { MaskPreset } from "../types";

/**
 * Typing masks.
 *
 * A mask is punctuation plus three placeholders:
 *   9  a digit
 *   A  a letter
 *   *  either
 * Everything else is literal and is typed in for the person as they go.
 *
 * The mask shapes what is typed; it does not decide what is valid on its own.
 * A half-finished masked answer is caught by `maskComplete`, which is what the
 * validator asks.
 */

export const MASK_PRESETS: MaskPreset[] = [
  { id: "", label: "No mask", mask: "", hint: "Anything goes" },
  { id: "np-mobile", label: "Nepali mobile", mask: "9999999999", hint: "9744570500" },
  { id: "np-landline", label: "Landline", mask: "99-9999999", hint: "01-5910299" },
  { id: "np-mobile-spaced", label: "Mobile, spaced", mask: "9999 999 999", hint: "9744 570 500" },
  { id: "date-bs", label: "Date (BS)", mask: "9999-99-99", hint: "2083-04-21" },
  { id: "roll", label: "Roll / ID", mask: "AAA-9999", hint: "JWS-2083" },
  { id: "custom", label: "Custom…", mask: "", hint: "Write your own" },
];

const isDigit = (c: string) => c >= "0" && c <= "9";
const isLetter = (c: string) => /[a-z]/i.test(c);

function accepts(slot: string, ch: string): boolean {
  if (slot === "9") return isDigit(ch);
  if (slot === "A") return isLetter(ch);
  if (slot === "*") return isDigit(ch) || isLetter(ch);
  return false;
}

const isSlot = (c: string) => c === "9" || c === "A" || c === "*";

/**
 * Re-type `raw` through `mask`, dropping characters that don't fit and adding
 * the literals. Returns as much as fits; typing simply stops at the end.
 */
export function applyMask(raw: string, mask: string): string {
  if (!mask) return raw;
  const src = [...raw];
  let out = "";
  let i = 0;

  for (const slot of mask) {
    if (i >= src.length) break;
    if (isSlot(slot)) {
      // Skip anything the slot won't take — usually the literals the person
      // typed themselves, or a stray space from a paste.
      while (i < src.length && !accepts(slot, src[i])) i++;
      if (i >= src.length) break;
      out += src[i++];
    } else {
      out += slot;
      // If they typed the literal too, don't consume it twice.
      if (src[i] === slot) i++;
    }
  }
  return out;
}

/** True once every placeholder in the mask has been filled. */
export function maskComplete(value: string, mask: string): boolean {
  if (!mask) return true;
  if (!value) return false;
  return applyMask(value, mask).length === mask.length;
}

/** A greyed example of the finished shape, for placeholder text. */
export function maskExample(mask: string): string {
  return [...mask]
    .map((c) => (c === "9" ? "0" : c === "A" ? "X" : c === "*" ? "•" : c))
    .join("");
}

export function presetFor(mask: string): MaskPreset | undefined {
  return MASK_PRESETS.find((p) => p.mask && p.mask === mask);
}

/**
 * Compile a user-written pattern.
 *
 * Returns null for an unparseable one rather than throwing, so a typo in the
 * builder can never stop somebody submitting a form.
 */
export function compilePattern(pattern: string): RegExp | null {
  if (!pattern.trim()) return null;
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}
