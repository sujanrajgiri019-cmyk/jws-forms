import type { Answers, AnswerValue, FormDef, Question } from "../types";

/**
 * Column naming and answer flattening.
 *
 * This logic is mirrored byte-for-byte in `src-tauri/public_form.html` so that a
 * response submitted from a phone over the LAN lands in exactly the same columns
 * as one typed on the school PC. If you change a rule here, change it there too.
 */

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

/** The full row a submission turns into, in column order. */
export function buildRow(form: FormDef, answers: Answers) {
  const headers: string[] = [];
  const values: string[] = [];

  if (form.settings.collectTimestamp) {
    headers.push("Timestamp");
    values.push(new Date().toLocaleString());
  }
  for (const q of form.questions) {
    if (q.type === "section") continue;
    headers.push(...headersFor(q));
    values.push(...valuesFor(q, answers));
  }
  return { headers, values };
}

/** All column names a form would produce — used to preview the sheet layout. */
export function allHeaders(form: FormDef): string[] {
  const h: string[] = [];
  if (form.settings.collectTimestamp) h.push("Timestamp");
  for (const q of form.questions) {
    if (q.type === "section") continue;
    h.push(...headersFor(q));
  }
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
  if (q.type === "section") return "";
  if (q.required && !isAnswered(q, v)) {
    if (q.type === "grid_choice" || q.type === "grid_checkbox")
      return "Please answer every row.";
    return "This question is required.";
  }
  if (!isAnswered(q, v)) return "";

  const s = String(v);
  if (q.type === "email" && !EMAIL.test(s)) return "Enter a valid email address.";
  if (q.type === "phone" && !PHONE.test(s)) return "Enter a valid phone number.";
  if (q.type === "number" && Number.isNaN(Number(s))) return "Enter a number.";
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
export function completion(form: FormDef, answers: Answers): number {
  const qs = form.questions.filter((q) => q.type !== "section");
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
