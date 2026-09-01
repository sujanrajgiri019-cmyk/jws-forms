import type {
  AnswerValue,
  Answers,
  ConditionOperator,
  ConditionRule,
  FormDef,
  Question,
} from "../types";

/**
 * Conditional visibility.
 *
 * Rules are evaluated against the answers as they stand right now, so a form
 * reshapes itself while somebody is filling it in. Two deliberate decisions:
 *
 *   1. A hidden question KEEPS its answer. Tick "Yes", fill in the follow-up,
 *      change your mind to "No", change it back — the follow-up is still there.
 *      Wiping it would punish people for exploring, and it is the single most
 *      common complaint about skip logic elsewhere.
 *   2. A hidden question is nonetheless submitted as an EMPTY cell, and its
 *      column still exists. The sheet keeps one shape for the whole term, so a
 *      filter or a formula written in week one still works in week twenty.
 *
 * This file is mirrored in `src-tauri/public_form.html` so a phone evaluates
 * the same rules as the desktop app. Change one, change the other.
 */

/** The plain-text form of an answer, for comparing against a rule's value. */
function asText(v: AnswerValue): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") {
    return Object.values(v)
      .map((x) => (Array.isArray(x) ? x.join(", ") : String(x ?? "")))
      .join(", ");
  }
  return String(v);
}

/** Every value an answer holds, for "equals" against a multi-select. */
function asList(v: AnswerValue): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "object") {
    return Object.values(v).flatMap((x) =>
      Array.isArray(x) ? x.map(String) : [String(x ?? "")]
    );
  }
  const s = String(v);
  return s === "" ? [] : [s];
}

function wanted(rule: ConditionRule): string[] {
  return (Array.isArray(rule.value) ? rule.value : [rule.value])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s !== "");
}

export function evaluateRule(rule: ConditionRule, answers: Answers): boolean {
  const raw = answers[rule.fieldId];
  const text = asText(raw).trim();
  const list = asList(raw).map((s) => s.trim());
  const want = wanted(rule);

  const op: ConditionOperator = rule.operator;
  switch (op) {
    case "is_empty":
      return text === "";
    case "is_not_empty":
      return text !== "";
    case "equals":
      // A checkbox answer matches if any chosen option is one of the wanted
      // values — "equals" reads naturally that way in the builder.
      return want.length === 0
        ? text === ""
        : list.some((v) => want.some((w) => v.toLowerCase() === w.toLowerCase()));
    case "not_equals":
      return want.length === 0
        ? text !== ""
        : !list.some((v) => want.some((w) => v.toLowerCase() === w.toLowerCase()));
    case "contains":
      return want.some((w) => text.toLowerCase().includes(w.toLowerCase()));
    default:
      return true;
  }
}

/**
 * Is this question on screen?
 *
 * A rule pointing at a question that is itself hidden is treated as unmet —
 * otherwise a two-level branch would light up from an answer nobody can see.
 */
export function isVisible(
  q: Question,
  answers: Answers,
  hiddenSoFar: Set<string> = new Set()
): boolean {
  const c = q.conditions;
  if (!c || !c.rules?.length) return true;

  const results = c.rules.map((r) =>
    hiddenSoFar.has(r.fieldId) ? false : evaluateRule(r, answers)
  );
  const matched = c.match === "any" ? results.some(Boolean) : results.every(Boolean);
  return c.action === "hide" ? !matched : matched;
}

/**
 * The ids of every block currently hidden.
 *
 * Questions are walked in document order, so a rule can depend on an earlier
 * branch and get the right answer. A rule pointing forwards still works, it
 * just settles on the next keystroke.
 */
export function hiddenIds(form: FormDef, answers: Answers): Set<string> {
  const hidden = new Set<string>();
  for (const q of form.questions) {
    if (!isVisible(q, answers, hidden)) hidden.add(q.id);
  }
  return hidden;
}

/** Questions that reference this one — used to warn before deleting. */
export function dependentsOf(form: FormDef, questionId: string): Question[] {
  return form.questions.filter((q) =>
    (q.conditions?.rules ?? []).some((r) => r.fieldId === questionId)
  );
}

/** Questions that may be referenced by `questionId`'s rules — the earlier ones. */
export function candidateSources(form: FormDef, questionId: string): Question[] {
  const out: Question[] = [];
  for (const q of form.questions) {
    if (q.id === questionId) break;
    if (q.type === "section" || q.type === "image") continue;
    out.push(q);
  }
  return out;
}

export const OPERATOR_LABEL: Record<ConditionOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "has any answer",
};

export const OPERATORS_NEEDING_VALUE: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
];

/** One line of plain English describing a question's rules. */
export function describeConditions(form: FormDef, q: Question): string {
  const c = q.conditions;
  if (!c || !c.rules.length) return "Always shown.";
  const join = c.match === "any" ? " or " : " and ";
  const parts = c.rules.map((r) => {
    const src = form.questions.find((x) => x.id === r.fieldId);
    const name = src?.title?.trim() || "a deleted question";
    const op = OPERATOR_LABEL[r.operator];
    if (!OPERATORS_NEEDING_VALUE.includes(r.operator)) return `“${name}” ${op}`;
    const v = wanted(r).join(" / ");
    return `“${name}” ${op} “${v || "…"}”`;
  });
  const verb = c.action === "hide" ? "Hidden" : "Shown";
  return `${verb} when ${parts.join(join)}.`;
}
