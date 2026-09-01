export type QuestionType =
  | "short_text"
  | "paragraph"
  | "number"
  | "email"
  | "phone"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "linear_scale"
  | "rating"
  | "grid_choice"
  | "grid_checkbox"
  | "date"
  | "time"
  | "section"
  | "image"
  | "photo";

export type { Institution } from "./lib/brand";

/** Which look a form wears. Set per form. */
export type FormStyle =
  | "register"
  | "panel"
  | "focus"
  | "letterhead"
  | "cards"
  | "cover"
  | "split";

/**
 * The colourway a form wears on top of its style.
 *
 * "brand" is the white-and-orange the school uses everywhere. "auto" lets each
 * letterhead carry its own accent — royal blue for the School, warm amber for
 * +2, deep navy for the College — which helps when three departments are
 * collecting at three desks in the same hall.
 */
export type Colorway = "brand" | "auto" | "royal" | "amber" | "navy";

export interface Choice {
  id: string;
  label: string;
}

export interface Scale {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

/* ------------------------------------------------------------------ logic */

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "is_empty"
  | "is_not_empty";

export interface ConditionRule {
  /** The id of the question being tested. */
  fieldId: string;
  operator: ConditionOperator;
  /** Ignored by is_empty / is_not_empty. */
  value: string | string[];
}

export interface QuestionConditions {
  /** What happens when the rules match. */
  action: "show" | "hide";
  match: "all" | "any";
  rules: ConditionRule[];
}

/* ------------------------------------------------------------- validation */

/**
 * A typing mask. `9` is a digit, `A` a letter, `*` either; every other
 * character is punctuation the app inserts for you.
 *
 *   "9999999999"        → 9744570500
 *   "99-9999999"        → 01-5910299
 *   "AAA-9999"          → JWS-2083
 */
export interface MaskPreset {
  id: string;
  label: string;
  mask: string;
  hint: string;
}

/* ----------------------------------------------------------------- blocks */

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  placeholder: string;
  options: Choice[];
  rows: Choice[];
  columns: Choice[];
  hasOther: boolean;
  shuffle: boolean;
  scale: Scale;
  ratingMax: number;
  /** For an "image" block: the picture itself, stored as a data URL. */
  image: string;
  /** Caption under an image block. */
  imageCaption: string;
  /** How wide an image block is drawn. */
  imageWidth: "small" | "medium" | "full";

  /** Typing mask for phone / number / short answer. Empty = no mask. */
  mask: string;
  /** Extra check run after the built-in one. Empty = no extra check. */
  pattern: string;
  /** What to say when `pattern` fails. */
  patternMessage: string;

  /** Show or hide this block depending on earlier answers. */
  conditions?: QuestionConditions;
}

/* --------------------------------------------------------------- receipts */

export interface ReceiptSettings {
  enabled: boolean;
  /** Heading on the slip. Empty falls back to the form's title. */
  title: string;
  /** Question ids to print, in order. */
  fields: string[];
  /** Print a sequential token number — the queue number at a counter. */
  showToken: boolean;
  /** Letters in front of the number, e.g. "ADM-" gives ADM-0042. */
  tokenPrefix: string;
  /** A line of small print at the foot of the slip. */
  note: string;
}

export interface FormSettings {
  style: FormStyle;
  /** Which institution's letterhead this form carries. */
  institution: import("./lib/brand").Institution;
  /** Where this form's Excel workbook is written. Empty = the app default. */
  dataFolder: string;
  confirmationMessage: string;
  allowMultiple: boolean;
  showProgress: boolean;
  collectTimestamp: boolean;
  accent: string;
  acceptingResponses: boolean;

  /** Accent colourway layered on top of the chosen style. */
  colorway: Colorway;
  /** High-contrast dark mode, for an unattended counter laptop. */
  kiosk: boolean;
  receipt: ReceiptSettings;
  /**
   * Optional endpoint POSTed after a response is safely on disk. Fired on a
   * background thread — a slow or unreachable endpoint never delays or fails a
   * submission.
   */
  webhookUrl: string;
}

export interface FormDef {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  settings: FormSettings;
  createdAt: string;
  updatedAt: string;
}

export interface FormSummary {
  id: string;
  title: string;
  style: FormStyle;
  institution: string;
  description: string;
  questionCount: number;
  responseCount: number;
  updatedAt: string;
  createdAt: string;
  acceptingResponses: boolean;
  excelPath: string;
}

export interface ResponseTable {
  headers: string[];
  rows: string[][];
  path: string;
}

export interface ServerStatus {
  running: boolean;
  formId: string;
  formTitle: string;
  url: string;
  port: number;
  qrSvg: string;
}

/** A respondent's in-progress answers, keyed by question id. */
export type AnswerValue =
  | string
  | string[]
  | Record<string, string>
  | Record<string, string[]>
  | undefined;

export type Answers = Record<string, AnswerValue>;

export interface TunnelStatus {
  /** "off" | "starting" | "live" | "installing" | "error" */
  state: string;
  publicUrl: string;
  localUrl: string;
  formId: string;
  formTitle: string;
  qrSvg: string;
  message: string;
  helperInstalled: boolean;
}
