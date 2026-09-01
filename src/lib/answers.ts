import { compilePattern, maskComplete, maskExample } from "./mask";
import { markQuiz } from "./quiz";
import type { Answers, AnswerValue, FormDef, Question } from "../types";

/**
 * Column naming and answer flattening.
 *
 * This logic is mirrored byte-for-byte in `src-tauri/public_form.html` so that a
 * response submitted from a phone over the LAN lands in exactly the same columns
 * as one typed on the school PC. If you change a rule here, change it there too.
 */

/** Blocks that show something instead of asking something — they own no column. */
export function isDisplayBlock(t: Question["type"]): boolean {
  return t === "section" || t === "image";
}

export function headersFor(q: Question): string[] {
  const t = (q.title || "Untitled question").trim();
  if (q.type === "grid_choice" || q.type === "grid_checkbox") {
    return q.rows.map((r) => `${t} [${r.label}]`);
  }
  return [t];
}

export function valuesFor(q: Question, a: Answers): string[] {
  const v = a[q.id];
  if (q.type === "grid_choice") {
    const m = (v as Record<string, string>) || {};
    return q.rows.map((r) => m[r.id] || "");
  }
  if (q.type === "grid_checkbox") {
    const m = (v as Record<string, string[]>) || {};
    return q.rows.map((r) => (m[r.id] || []).join(", "));
  }
  if (q.type === "checkboxes") return [((v as string[]) || []).join(", ")];
  return [v == null ? "" : String(v)];
}

/**
 * The full row a submission turns into, in column order.
 *
 * `hidden` holds the ids of questions a condition has taken off screen. Their
 * columns are still written — as blanks — so the sheet keeps one shape whether
 * or not a branch was taken. A filter written in week one still works in week
 * twenty.
 */
export function buildRow(
  form: FormDef,
  answers: Answers,
  hidden: Set<string> = new Set()
) {
  const headers: string[] = [];
  const values: string[] = [];

  if (form.settings.collectTimestamp) {
    headers.push("Timestamp");
    values.push(new Date().toLocaleString());
  }
  for (const q of form.questions) {
    if (isDisplayBlock(q.type)) continue;
    const cols = headersFor(q);
    headers.push(...cols);
    if (hidden.has(q.id)) values.push(...cols.map(() => ""));
    else values.push(...valuesFor(q, answers));
  }

  // A quiz carries its marks in the last two columns, so a teacher can sort by
  // score without hunting for them among thirty answers.
  if (form.settings.quiz) {
    const { score, total } = markQuiz(form, answers, hidden);
    headers.push("Score", "Out of");
    values.push(String(score), String(total));
  }
  return { headers, values };
}

/**
 * All column names a form would produce — used to preview the sheet layout.
 * Conditional questions are included: their columns always exist.
 */
export function allHeaders(form: FormDef): string[] {
  const h: string[] = [];
  if (form.settings.collectTimestamp) h.push("Timestamp");
  for (const q of form.questions) {
    if (isDisplayBlock(q.type)) continue;
    h.push(...headersFor(q));
  }
  if (form.settings.quiz) h.push("Score", "Out of");
  return h;
}

export function isAnswered(q: Question, v: AnswerValue): boolean {
  if (q.type === "checkboxes") return ((v as string[]) || []).length > 0;
  if (q.type === "grid_choice") {
    const m = (v as Record<string, string>) || {};
    return q.rows.length > 0 && q.rows.every((r) => !!m[r.id]);
  }
  if (q.type === "grid_checkbox") {
    const m = (v as Record<string, string[]>) || {};
    return q.rows.length > 0 && q.rows.every((r) => (m[r.id] || []).length > 0);
  }
  return v !== undefined && v !== null && String(v).trim() !== "";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-\s()]{6,}$/;

/** "" when the answer is acceptable, otherwise the message to show. */
export function validate(q: Question, v: AnswerValue): string {
  if (isDisplayBlock(q.type)) return "";
  if (q.required && !isAnswered(q, v)) {
    if (q.type === "grid_choice" || q.type === "grid_checkbox")
      return "Please answer every row.";
    return "This question is required.";
  }
  if (!isAnswered(q, v)) return "";

  // Checkbox counts are about the collection, not the text, so they come first.
  if (q.type === "checkboxes" && q.countRule) {
    const n = ((v as string[]) || []).length;
    const want = Number(q.countValue);
    if (Number.isFinite(want) && want > 0) {
      if (q.countRule === "at_least" && n < want)
        return `Choose at least ${want} option${want === 1 ? "" : "s"}.`;
      if (q.countRule === "at_most" && n > want)
        return `Choose no more than ${want} option${want === 1 ? "" : "s"}.`;
      if (q.countRule === "exactly" && n !== want)
        return `Choose exactly ${want} option${want === 1 ? "" : "s"}.`;
    }
  }

  const s = String(v);
  if (q.type === "email" && !EMAIL.test(s)) return "Enter a valid email address.";
  if (q.type === "phone" && !q.mask && !PHONE.test(s)) return "Enter a valid phone number.";
  if (q.type === "number" && !q.mask && Number.isNaN(Number(s)))
    return "Enter a number.";

  // A mask decides its own completeness — "9744" against 9999999999 is a
  // half-typed number, not a wrong one, so say so plainly.
  if (q.mask && !maskComplete(s, q.mask)) {
    return `Finish this — it should look like ${maskExample(q.mask)}.`;
  }

  if (q.type === "number") {
    const n = Number(s);
    const lo = q.minNumber === "" ? null : Number(q.minNumber);
    const hi = q.maxNumber === "" ? null : Number(q.maxNumber);
    if (lo !== null && Number.isFinite(lo) && n < lo) return `Enter ${lo} or more.`;
    if (hi !== null && Number.isFinite(hi) && n > hi) return `Enter ${hi} or less.`;
  }

  if (q.type === "short_text" || q.type === "paragraph") {
    const lo = q.minLength === "" ? null : Number(q.minLength);
    const hi = q.maxLength === "" ? null : Number(q.maxLength);
    if (lo !== null && Number.isFinite(lo) && s.length < lo)
      return `Write at least ${lo} characters — that is ${s.length} so far.`;
    if (hi !== null && Number.isFinite(hi) && s.length > hi)
      return `Keep it to ${hi} characters — that is ${s.length}.`;
  }

  const re = compilePattern(q.pattern);
  if (re && !re.test(s)) {
    return q.patternMessage.trim() || "That does not look right.";
  }
  return "";
}

export function validateAll(form: FormDef, answers: Answers): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const q of form.questions) {
    const m = validate(q, answers[q.id]);
    if (m) errs[q.id] = m;
  }
  return errs;
}

/** Fraction of answerable questions that have an answer, for the progress bar. */
export function completion(
  form: FormDef,
  answers: Answers,
  hidden: Set<string> = new Set()
): number {
  const qs = form.questions.filter(
    (q) => !isDisplayBlock(q.type) && !hidden.has(q.id)
  );
  if (!qs.length) return 0;
  const done = qs.filter((q) => isAnswered(q, answers[q.id])).length;
  return done / qs.length;
}

/** Deterministic-per-session shuffle so options don't jump while answering. */
export function shuffled<T>(arr: T[], enabled: boolean, seed: string): T[] {
  if (!enabled) return arr;
  const out = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
