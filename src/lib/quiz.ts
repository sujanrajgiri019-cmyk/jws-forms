import type { Answers, AnswerValue, FormDef, Question } from "../types";

/**
 * Quiz marking.
 *
 * Deliberately simple and deliberately conservative: a question is marked only
 * when it has an answer key, comparison is case-insensitive and
 * whitespace-trimmed, and anything the key can't decide is left unmarked rather
 * than guessed. A form that quietly marks a right answer wrong is worse than
 * one that marks nothing, because a teacher only finds out from an upset
 * student.
 *
 * Paragraph answers are never auto-marked. Nobody should pretend a string
 * comparison is an opinion about an essay.
 *
 * The answer is flattened here rather than through `answers.ts` on purpose:
 * `answers.ts` needs this file to write the score columns, and importing it
 * back would make the pair circular.
 */

function flatten(v: AnswerValue): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return Object.values(v).map(String).join(", ");
  return String(v);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const MARKABLE: Question["type"][] = [
  "short_text",
  "number",
  "email",
  "phone",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "date",
  "time",
  "linear_scale",
  "rating",
];

export function isMarkable(q: Question): boolean {
  return MARKABLE.includes(q.type) && q.answerKey.length > 0;
}

export function pointsFor(q: Question): number {
  const n = Number(q.points);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** null when the question isn't marked at all. */
export function isCorrect(q: Question, answers: Answers): boolean | null {
  if (!isMarkable(q)) return null;
  const key = q.answerKey.map(norm).filter(Boolean);
  if (!key.length) return null;

  if (q.type === "checkboxes") {
    // Every right box and no wrong ones — a partially ticked answer is wrong.
    const given = ((answers[q.id] as string[]) ?? []).map(norm).filter(Boolean);
    if (given.length !== key.length) return false;
    const left = new Set(key);
    for (const g of given) {
      if (!left.delete(g)) return false;
    }
    return left.size === 0;
  }

  const given = norm(flatten(answers[q.id]));
  if (!given) return false;
  return key.includes(given);
}

export interface QuizResult {
  score: number;
  total: number;
  marked: { q: Question; correct: boolean; points: number }[];
}

export function markQuiz(
  form: FormDef,
  answers: Answers,
  hidden: Set<string> = new Set()
): QuizResult {
  let score = 0;
  let total = 0;
  const marked: QuizResult["marked"] = [];

  for (const q of form.questions) {
    // A question the respondent never saw cannot be marked against them.
    if (hidden.has(q.id) || !isMarkable(q)) continue;
    const pts = pointsFor(q);
    const ok = isCorrect(q, answers) === true;
    total += pts;
    if (ok) score += pts;
    marked.push({ q, correct: ok, points: pts });
  }
  return { score, total, marked };
}
