import { create } from "zustand";
import * as api from "./api";
import { morphQuestion, newQuestion, normalizeForm, uid } from "./questionTypes";
import type { FormDef, FormSummary, Question, QuestionType } from "../types";

export type View =
  | { name: "home" }
  | { name: "builder"; id: string }
  | { name: "fill"; id: string }
  | { name: "preview"; id: string }
  | { name: "responses"; id: string }
  | { name: "share"; id: string }
  | { name: "settings" };

interface State {
  view: View;
  forms: FormSummary[];
  loadingForms: boolean;

  form: FormDef | null;
  selected: string | null;
  dirty: boolean;
  saving: boolean;
  lastSaved: string | null;
  error: string | null;

  go: (v: View) => void;
  refreshForms: () => Promise<void>;
  openForm: (id: string) => Promise<void>;
  closeForm: () => void;

  patch: (p: Partial<FormDef>) => void;
  patchSettings: (p: Partial<FormDef["settings"]>) => void;
  select: (id: string | null) => void;

  addQuestion: (type?: QuestionType, afterId?: string) => void;
  patchQuestion: (id: string, p: Partial<Question>) => void;
  changeType: (id: string, type: QuestionType) => void;
  removeQuestion: (id: string) => void;
  duplicateQuestion: (id: string) => void;
  reorder: (from: number, to: number) => void;

  save: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<State>((set, get) => {
  /** Mark dirty and schedule an autosave a beat after typing stops. */
  const touch = () => {
    set({ dirty: true });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().save(), 700);
  };

  const editForm = (fn: (f: FormDef) => FormDef) => {
    const f = get().form;
    if (!f) return;
    set({ form: fn(f) });
    touch();
  };

  const editQuestions = (fn: (q: Question[]) => Question[]) =>
    editForm((f) => ({ ...f, questions: fn(f.questions) }));

  return {
    view: { name: "home" },
    forms: [],
    loadingForms: false,
    form: null,
    selected: null,
    dirty: false,
    saving: false,
    lastSaved: null,
    error: null,

    go: (v) => set({ view: v }),

    async refreshForms() {
      set({ loadingForms: true });
      try {
        set({ forms: await api.listForms(), error: null });
      } catch (e) {
        set({ error: String(e) });
      } finally {
        set({ loadingForms: false });
      }
    },

    async openForm(id) {
      // Don't lose an in-flight edit when navigating between screens.
      if (get().dirty) await get().save();
      if (get().form?.id === id) return;
      const form = normalizeForm(await api.getForm(id));
      set({
        form,
        selected: form.questions[0]?.id ?? null,
        dirty: false,
        lastSaved: null,
      });
    },

    closeForm: () => set({ form: null, selected: null, dirty: false }),

    patch: (p) => editForm((f) => ({ ...f, ...p })),
    patchSettings: (p) => editForm((f) => ({ ...f, settings: { ...f.settings, ...p } })),
    select: (id) => set({ selected: id }),

    addQuestion(type = "short_text", afterId) {
      const q = newQuestion(type);
      editQuestions((qs) => {
        const i = afterId ? qs.findIndex((x) => x.id === afterId) : qs.length - 1;
        const at = i < 0 ? qs.length : i + 1;
        return [...qs.slice(0, at), q, ...qs.slice(at)];
      });
      set({ selected: q.id });
    },

    patchQuestion: (id, p) =>
      editQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...p } : q))),

    changeType: (id, type) =>
      editQuestions((qs) => qs.map((q) => (q.id === id ? morphQuestion(q, type) : q))),

    removeQuestion(id) {
      const qs = get().form?.questions ?? [];
      const i = qs.findIndex((q) => q.id === id);
      editQuestions((list) => list.filter((q) => q.id !== id));
      const next = qs[i + 1]?.id ?? qs[i - 1]?.id ?? null;
      set({ selected: next });
    },

    duplicateQuestion(id) {
      const src = get().form?.questions.find((q) => q.id === id);
      if (!src) return;
      const copy: Question = {
        ...structuredClone(src),
        id: uid(),
        options: src.options.map((o) => ({ ...o, id: uid() })),
        rows: src.rows.map((o) => ({ ...o, id: uid() })),
        columns: src.columns.map((o) => ({ ...o, id: uid() })),
      };
      editQuestions((qs) => {
        const i = qs.findIndex((q) => q.id === id);
        return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
      });
      set({ selected: copy.id });
    },

    reorder(from, to) {
      editQuestions((qs) => {
        const next = [...qs];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },

    async save() {
      const f = get().form;
      if (!f || get().saving) return;
      clearTimeout(saveTimer);
      set({ saving: true });
      try {
        const stamped = { ...f, updatedAt: new Date().toISOString() };
        await api.saveForm(stamped);
        set({
          form: get().form?.id === f.id ? { ...get().form!, updatedAt: stamped.updatedAt } : get().form,
          dirty: false,
          lastSaved: stamped.updatedAt,
          error: null,
        });
      } catch (e) {
        set({ error: String(e) });
      } finally {
        set({ saving: false });
      }
    },
  };
});
