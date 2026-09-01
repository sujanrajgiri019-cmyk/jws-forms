import { useCallback, useMemo } from "react";
import { hiddenIds } from "./logic";
import { buildRow, completion, isDisplayBlock, validate } from "./answers";
import type { Answers, AnswerValue, FormDef, Question } from "../types";

export interface FormLogic {
  /** Ids of every block currently hidden by a rule. */
  hidden: Set<string>;
  isHidden: (id: string) => boolean;
  /** Blocks on screen right now, in order — sections and pictures included. */
  visible: Question[];
  /** Visible blocks that actually ask something. */
  answerable: Question[];
  /** 1-based number shown beside a visible question, skipping hidden ones. */
  numberOf: (id: string) => number;
  /** How far through the visible questions the person is, 0–1. */
  progress: number;
  /** Errors for visible questions only. A hidden question is never required. */
  validateAll: () => Record<string, string>;
  /** The row to submit: hidden answers blank, every column still present. */
  row: () => { headers: string[]; values: string[] };
}

/**
 * Conditional logic, evaluated live.
 *
 * The hook derives everything from the answers it is handed and stores no state
 * of its own — which is precisely why a hidden question keeps its answer. There
 * is nowhere for that answer to be thrown away, so changing a branch back
 * restores what was typed.
 */
export function useFormLogic(form: FormDef | null, answers: Answers): FormLogic {
  const hidden = useMemo(
    () => (form ? hiddenIds(form, answers) : new Set<string>()),
    [form, answers]
  );

  const visible = useMemo(
    () => (form ? form.questions.filter((q) => !hidden.has(q.id)) : []),
    [form, hidden]
  );

  const answerable = useMemo(
    () => visible.filter((q) => !isDisplayBlock(q.type)),
    [visible]
  );

  const numbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const q of answerable) map[q.id] = ++n;
    return map;
  }, [answerable]);

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden]);
  const numberOf = useCallback((id: string) => numbers[id] ?? 0, [numbers]);

  const progress = useMemo(() => {
    if (!form) return 0;
    return completion(form, answers, hidden);
  }, [form, answers, hidden]);

  const validateAllFn = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!form) return errs;
    for (const q of form.questions) {
      if (hidden.has(q.id)) continue;
      const m = validate(q, answers[q.id]);
      if (m) errs[q.id] = m;
    }
    return errs;
  }, [form, answers, hidden]);

  const rowFn = useCallback(() => {
    if (!form) return { headers: [], values: [] };
    return buildRow(form, answers, hidden);
  }, [form, answers, hidden]);

  return {
    hidden,
    isHidden,
    visible,
    answerable,
    numberOf,
    progress,
    validateAll: validateAllFn,
    row: rowFn,
  };
}

/** Convenience for callers that only need to know whether an answer counts. */
export function visibleAnswers(
  form: FormDef,
  answers: Answers,
  hidden: Set<string>
): Answers {
  const out: Answers = {};
  for (const q of form.questions) {
    if (hidden.has(q.id)) continue;
    const v: AnswerValue = answers[q.id];
    if (v !== undefined) out[q.id] = v;
  }
  return out;
}
