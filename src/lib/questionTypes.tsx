import type { JSX } from "react";
import type { Question, QuestionType } from "../types";
import { Icon } from "../components/Icons";

export interface TypeMeta {
  type: QuestionType;
  label: string;
  group: string;
  icon: JSX.Element;
  /** Fields the editor should expose for this type. */
  hasOptions?: boolean;
  hasGrid?: boolean;
  hasScale?: boolean;
  hasRating?: boolean;
  hasPlaceholder?: boolean;
}

export const TYPES: TypeMeta[] = [
  { type: "short_text", label: "Short answer", group: "Text", icon: <Icon name="text" />, hasPlaceholder: true },
  { type: "paragraph", label: "Paragraph", group: "Text", icon: <Icon name="paragraph" />, hasPlaceholder: true },
  { type: "number", label: "Number", group: "Text", icon: <Icon name="hash" />, hasPlaceholder: true },
  { type: "email", label: "Email", group: "Text", icon: <Icon name="mail" />, hasPlaceholder: true },
  { type: "phone", label: "Phone", group: "Text", icon: <Icon name="phone" />, hasPlaceholder: true },

  { type: "multiple_choice", label: "Multiple choice", group: "Choice", icon: <Icon name="radio" />, hasOptions: true },
  { type: "checkboxes", label: "Checkboxes", group: "Choice", icon: <Icon name="checkSquare" />, hasOptions: true },
  { type: "dropdown", label: "Dropdown", group: "Choice", icon: <Icon name="chevronDownCircle" />, hasOptions: true },

  { type: "linear_scale", label: "Linear scale", group: "Scale", icon: <Icon name="scale" />, hasScale: true },
  { type: "rating", label: "Star rating", group: "Scale", icon: <Icon name="star" />, hasRating: true },

  { type: "grid_choice", label: "Multiple-choice grid", group: "Grid", icon: <Icon name="grid" />, hasGrid: true },
  { type: "grid_checkbox", label: "Checkbox grid", group: "Grid", icon: <Icon name="gridCheck" />, hasGrid: true },

  { type: "date", label: "Date", group: "Date & time", icon: <Icon name="calendar" /> },
  { type: "time", label: "Time", group: "Date & time", icon: <Icon name="clock" /> },

  { type: "section", label: "Section heading", group: "Layout", icon: <Icon name="section" /> },
];

export const TYPE_MAP: Record<QuestionType, TypeMeta> = Object.fromEntries(
  TYPES.map((t) => [t.type, t])
) as Record<QuestionType, TypeMeta>;

export const TYPE_GROUPS = [...new Set(TYPES.map((t) => t.group))];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newQuestion(type: QuestionType = "short_text"): Question {
  const meta = TYPE_MAP[type];
  return {
    id: uid(),
    type,
    title: type === "section" ? "" : "",
    description: "",
    required: false,
    placeholder: "",
    options: meta.hasOptions ? [{ id: uid(), label: "Option 1" }] : [],
    rows: meta.hasGrid ? [{ id: uid(), label: "Row 1" }, { id: uid(), label: "Row 2" }] : [],
    columns: meta.hasGrid ? [{ id: uid(), label: "Column 1" }, { id: uid(), label: "Column 2" }] : [],
    hasOther: false,
    shuffle: false,
    scale: { min: 1, max: 5, minLabel: "", maxLabel: "" },
    ratingMax: 5,
  };
}

/** Keep a question coherent when its type changes. */
export function morphQuestion(q: Question, type: QuestionType): Question {
  const meta = TYPE_MAP[type];
  const fresh = newQuestion(type);
  return {
    ...q,
    type,
    options: meta.hasOptions ? (q.options.length ? q.options : fresh.options) : [],
    rows: meta.hasGrid ? (q.rows.length ? q.rows : fresh.rows) : [],
    columns: meta.hasGrid ? (q.columns.length ? q.columns : fresh.columns) : [],
    hasOther: meta.hasOptions ? q.hasOther : false,
    placeholder: meta.hasPlaceholder ? q.placeholder : "",
    required: type === "section" ? false : q.required,
  };
}

export function newForm(): import("../types").FormDef {
  const now = new Date().toISOString();
  return {
    id: uid() + uid(),
    title: "Untitled form",
    description: "",
    questions: [newQuestion("short_text")],
    settings: {
      style: "panel",
      confirmationMessage: "Your response has been recorded. Thank you!",
      allowMultiple: true,
      showProgress: true,
      collectTimestamp: true,
      accent: "#F06522",
      acceptingResponses: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}
