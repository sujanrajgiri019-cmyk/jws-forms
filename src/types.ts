/** How a question's title and help text are styled. */
export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Relative size: -1 smaller, 0 normal, 1 larger, 2 largest. */
  size?: -1 | 0 | 1 | 2;
  /** A hex colour, or empty for the style's own ink. */
  color?: string;
  /** "display" uses the heading face, "body" the reading face, "mono" fixed. */
  font?: "" | "display" | "body" | "mono";
  align?: "" | "left" | "center" | "right";
}

/** What a file-upload question will take. */
export type UploadKind = "image" | "document" | "video" | "audio" | "any";

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
  | "photo"
  | "file";

export type { Institution } from "./lib/brand";

/** Which look a form wears. Set per form. */
export type FormStyle =
  | "register"
  | "panel"
  | "focus"
  | "letterhead"
  | "cards"
  | "cover"
  | "split"
  | "arena"
  | "prospectus"
  | "terminal"
  | "community";

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
  /**
   * Section routing, on a multiple-choice option. The id of a section block, or
   * `SUBMIT_SECTION` to finish the form. Empty means "carry straight on".
   */
  goTo?: string;
}

/** The sentinel a section destination uses to mean "submit the form here". */
export const SUBMIT_SECTION = "__submit__";

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

  /** Earliest / latest acceptable date, as yyyy-mm-dd. Empty = no limit. */
  minDate: string;
  maxDate: string;

  /** Styling for the question's own title and help text. */
  titleStyle?: TextStyle;
  helpStyle?: TextStyle;

  /** For a "photo"/"file" question: what may be attached, and how large. */
  uploadKinds: UploadKind[];
  /** Largest single file, in megabytes. Empty falls back to the app default. */
  maxFileMb: string;

  /* Response validation, the way Google Forms shapes it. Empty string means
     "no limit" rather than 0, so a blank box is never read as a rule. */
  /** Smallest acceptable number. */
  minNumber: string;
  /** Largest acceptable number. */
  maxNumber: string;
  /** Fewest characters for a text answer. */
  minLength: string;
  /** Most characters for a text answer. */
  maxLength: string;
  /** How many boxes must be ticked: "" | "at_least" | "at_most" | "exactly". */
  countRule: "" | "at_least" | "at_most" | "exactly";
  countValue: string;

  /* Quiz marking. Only read when the form is a quiz. */
  /** Marks this question is worth. */
  points: string;
  /** Accepted answers. For choice questions these are option labels. */
  answerKey: string[];
  /** Shown after submitting when the answer was right. */
  feedbackCorrect: string;
  /** Shown after submitting when it was wrong. */
  feedbackWrong: string;

  /** Show or hide this block depending on earlier answers. */
  conditions?: QuestionConditions;

  /**
   * On a "section" block: where to go once this section is finished. The id of
   * a later section, `SUBMIT_SECTION`, or empty for the next section in order.
   * A multiple-choice answer routing elsewhere overrides this.
   */
  nextSection?: string;
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
  /** Shuffle the questions inside each section, the way Google Forms can. */
  shuffleQuestions: boolean;
  /** Marks answers against the key and writes a score column. */
  quiz: boolean;
  /** A banner across the top of the form, as a data URL. */
  banner: string;
  /** How tall the banner is drawn. */
  bannerHeight: "short" | "medium" | "tall";
  /** Styling for the form's own title and description. */
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
  /** Show each respondent their score and feedback straight after submitting. */
  quizShowScore: boolean;
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
