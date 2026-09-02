import { useEffect } from "react";
import { useApp } from "./store";

/**
 * Editor keyboard shortcuts.
 *
 * Two rules keep these out of the way:
 *   1. Nothing fires while the caret is in a text box, except the ones that
 *      carry a modifier. Typing "d" in a question title must never duplicate it.
 *   2. Every shortcut has a visible equivalent. Hidden-only bindings are a
 *      feature nobody in an office ever discovers.
 */

export interface Shortcut {
  keys: string;
  what: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl + Z", what: "Undo" },
  { keys: "Ctrl + Y  /  Ctrl + Shift + Z", what: "Redo" },
  { keys: "Ctrl + S", what: "Save now" },
  { keys: "Ctrl + Enter", what: "Add a question below this one" },
  { keys: "Ctrl + D", what: "Duplicate the selected question" },
  { keys: "Ctrl + Delete", what: "Delete the selected question" },
  { keys: "Alt + ↑  /  Alt + ↓", what: "Move the selected question up or down" },
  { keys: "Ctrl + P", what: "Preview the form" },
  { keys: "Esc", what: "Deselect" },
  { keys: "?", what: "Show this list" },
];

function typing(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    n.isContentEditable === true
  );
}

export function useEditorShortcuts(onHelp: () => void, onPreview: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      const inText = typing(e.target);

      // Un-modified keys are ignored while typing, so the editor never eats a
      // letter somebody meant to write.
      if (!mod && !e.altKey) {
        if (inText) return;
        if (e.key === "?") {
          e.preventDefault();
          onHelp();
          return;
        }
        if (e.key === "Escape") {
          s.select(null);
          return;
        }
        return;
      }

      const id = s.selected;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        s.undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void s.save();
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        s.addQuestion("short_text", id ?? undefined);
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && id) {
        e.preventDefault();
        s.duplicateQuestion(id);
        return;
      }
      if (mod && e.key === "Delete" && id) {
        e.preventDefault();
        s.removeQuestion(id);
        return;
      }
      if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        onPreview();
        return;
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && id) {
        const qs = s.form?.questions ?? [];
        const i = qs.findIndex((q) => q.id === id);
        const to = e.key === "ArrowUp" ? i - 1 : i + 1;
        if (i >= 0 && to >= 0 && to < qs.length) {
          e.preventDefault();
          s.reorder(i, to);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onHelp, onPreview]);
}
