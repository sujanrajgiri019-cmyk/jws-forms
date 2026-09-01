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
  | "cover";

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
