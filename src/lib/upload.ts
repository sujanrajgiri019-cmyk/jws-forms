import type { Question, UploadKind } from "../types";
import { readPicture } from "./image";

/**
 * Attachments.
 *
 * A photo goes through the canvas so a 7 MB camera shot becomes a few hundred
 * kilobytes. Everything else — a PDF, a recording, a video — cannot be
 * usefully shrunk in the browser, so it is carried as-is and the size cap is
 * the only thing standing between a form and a workbook folder full of
 * half-gigabyte clips.
 *
 * Whatever arrives is written to disk beside the workbook by the Rust side; the
 * cell holds the file name.
 */

export const KIND_LABEL: Record<UploadKind, string> = {
  image: "Pictures",
  document: "Documents (PDF, Word, Excel)",
  video: "Video",
  audio: "Audio",
  any: "Any file",
};

const ACCEPT: Record<UploadKind, string> = {
  image: "image/*",
  document:
    ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf," +
    "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
    "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  video: "video/*",
  audio: "audio/*",
  any: "",
};

/** The default ceiling when a question doesn't set its own. */
export const DEFAULT_MAX_MB = 25;
/** The hard ceiling, whatever a question asks for. */
export const ABSOLUTE_MAX_MB = 200;

export function kindsOf(q: Question): UploadKind[] {
  const k = q.uploadKinds?.length ? q.uploadKinds : q.type === "photo" ? ["image"] : ["any"];
  return k as UploadKind[];
}

export function maxBytes(q: Question): number {
  const n = Number(q.maxFileMb);
  const mb = Number.isFinite(n) && n > 0 ? Math.min(n, ABSOLUTE_MAX_MB) : DEFAULT_MAX_MB;
  return mb * 1024 * 1024;
}

export function maxMb(q: Question): number {
  return Math.round(maxBytes(q) / (1024 * 1024));
}

/** The `accept` attribute for the file input. Empty means anything. */
export function acceptFor(q: Question): string {
  const kinds = kindsOf(q);
  if (kinds.includes("any")) return "";
  return kinds.map((k) => ACCEPT[k]).filter(Boolean).join(",");
}

function matchesKind(file: File, kind: UploadKind): boolean {
  const t = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  switch (kind) {
    case "any":
      return true;
    case "image":
      return t.startsWith("image/");
    case "video":
      return t.startsWith("video/");
    case "audio":
      return t.startsWith("audio/");
    case "document":
      return (
        t === "application/pdf" ||
        t.includes("word") ||
        t.includes("excel") ||
        t.includes("spreadsheet") ||
        t.includes("presentation") ||
        t.startsWith("text/") ||
        /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/.test(name)
      );
    default:
      return false;
  }
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface Attachment {
  /** data:<mime>;base64,… — what gets submitted. */
  dataUrl: string;
  name: string;
  bytes: number;
  kind: UploadKind;
}

function detectKind(file: File): UploadKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

/** Read a file for submission, checking type and size first. */
export function readAttachment(q: Question, file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const kinds = kindsOf(q);
    if (!kinds.some((k) => matchesKind(file, k))) {
      reject(
        new Error(
          `That file type isn't accepted here. Allowed: ${kinds
            .map((k) => KIND_LABEL[k])
            .join(", ")}.`
        )
      );
      return;
    }
    if (file.size > maxBytes(q)) {
      reject(
        new Error(
          `That file is ${humanBytes(file.size)} — the limit here is ${maxMb(q)} MB.`
        )
      );
      return;
    }

    const kind = detectKind(file);

    // Pictures are worth shrinking; nothing else can be, in a browser.
    if (kind === "image") {
      readPicture(file)
        .then((pic) =>
          resolve({ dataUrl: pic.dataUrl, name: file.name, bytes: pic.bytes, kind })
        )
        .catch(reject);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const url = String(reader.result || "");
      resolve({ dataUrl: url, name: file.name, bytes: url.length, kind });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * How an attachment is carried in an answer.
 *
 * The file name is prefixed so the Rust side can name the saved file the way
 * the person named it, rather than inventing one. A bare data URL still works —
 * that is what an older form submits.
 */
export function packAttachment(a: Attachment): string {
  return `name=${encodeURIComponent(a.name)}|${a.dataUrl}`;
}

export function unpackAttachment(v: string): { name: string; dataUrl: string } {
  const m = /^name=([^|]*)\|(.*)$/s.exec(v);
  if (!m) return { name: "", dataUrl: v };
  return { name: decodeURIComponent(m[1]), dataUrl: m[2] };
}
