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
  | { name: "print"; id: string }
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

  /* Undo history. Snapshots of the whole form, which is small enough that
     nothing cleverer is worth the bugs. */
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** How many steps back you can go. Twenty is more than anyone reaches for. */
const HISTORY_LIMIT = 20;
/**
 * Typing produces an edit per keystroke. Anything landing within this many
 * milliseconds of the last one joins it rather than becoming its own step, so
 * one Ctrl+Z undoes a word, not a letter.
 */
const COALESCE_MS = 600;

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let past: FormDef[] = [];
let future: FormDef[] = [];
let lastPush = 0;
let savePending = false;

export const useApp = create<State>((set, get) => {
  /** Mark dirty and schedule an autosave a beat after typing stops. */
  const touch = () => {
    set({ dirty: true });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().save(), 700);
  };

  /**
   * Apply an edit, remembering the state before it.
   *
   * `structural` forces its own history entry — adding, deleting, reordering or
   * changing a question's type is a discrete act, and folding it into the
   * keystroke before it would make undo unpredictable.
   */
  const editForm = (fn: (f: FormDef) => FormDef, structural = false) => {
    const f = get().form;
    if (!f) return;
    const now = Date.now();
    if (structural || now - lastPush > COALESCE_MS) {
      past.push(f);
      if (past.length > HISTORY_LIMIT) past.shift();
      future = [];
    }
    lastPush = now;
    set({ form: fn(f), canUndo: past.length > 0, canRedo: false });
    touch();
  };

  const editQuestions = (fn: (q: Question[]) => Question[], structural = false) =>
    editForm((f) => ({ ...f, questions: fn(f.questions) }), structural);

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
    canUndo: false,
    canRedo: false,

    go: (v) => set({ view: v }),

    undo() {
      const f = get().form;
      if (!f || !past.length) return;
      const prev = past.pop()!;
      future.push(f);
      lastPush = 0; // the next edit starts a fresh step
      set({ form: prev, canUndo: past.length > 0, canRedo: true, dirty: true });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void get().save(), 700);
    },

    redo() {
      const f = get().form;
      if (!f || !future.length) return;
      const next = future.pop()!;
      past.push(f);
      lastPush = 0;
      set({ form: next, canUndo: true, canRedo: future.length > 0, dirty: true });
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void get().save(), 700);
    },

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
      // History belongs to one form; carrying it across would let Ctrl+Z paste
      // one form's questions into another.
      past = [];
      future = [];
      lastPush = 0;
      set({
        canUndo: false,
        canRedo: false,
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
      }, true);
      set({ selected: q.id });
    },

    patchQuestion: (id, p) =>
      editQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...p } : q))),

    changeType: (id, type) =>
      editQuestions((qs) => qs.map((q) => (q.id === id ? morphQuestion(q, type) : q)), true),

    removeQuestion(id) {
      const qs = get().form?.questions ?? [];
      const i = qs.findIndex((q) => q.id === id);
      editQuestions((list) => list.filter((q) => q.id !== id), true);
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
      }, true);
      set({ selected: copy.id });
    },

    reorder(from, to) {
      editQuestions((qs) => {
        const next = [...qs];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }, true);
    },

    /**
     * Write the form to disk.
     *
     * Two things this has to get right, and the first version got both wrong:
     *
     *   1. A save requested while one is already running must not be dropped.
     *      It queues instead, so the last thing you typed always lands.
     *   2. "Saved" is only claimed for the exact content that was written. If
     *      you kept typing during the write, the form is still dirty afterwards
     *      and another save follows. Clearing the flag on a snapshot that is
     *      already stale is how edits silently disappear.
     */
    async save() {
      const f = get().form;
      if (!f) return;
      if (get().saving) {
        savePending = true;
        return;
      }
      clearTimeout(saveTimer);
      set({ saving: true });

      const snapshot = JSON.stringify(f);
      try {
        const stamped = { ...f, updatedAt: new Date().toISOString() };
        await api.saveForm(stamped);

        const now = get().form;
        const unchanged = now?.id === f.id && JSON.stringify(now) === snapshot;
        set({
          form: now?.id === f.id ? { ...now, updatedAt: stamped.updatedAt } : now,
          dirty: unchanged ? false : true,
          lastSaved: stamped.updatedAt,
          error: null,
        });
      } catch (e) {
        // Leave `dirty` alone — the content is still only in memory, and the
        // top bar must keep saying so.
        set({ error: String(e) });
      } finally {
        set({ saving: false });
      }

      if (savePending || get().dirty) {
        savePending = false;
        await get().save();
      }
    },
  };
});
