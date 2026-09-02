import { invoke } from "@tauri-apps/api/core";
import type { FormDef, FormSummary, ResponseTable, ServerStatus, TunnelStatus } from "../types";

/**
 * Every call into Rust goes through here. When the UI is opened in a plain
 * browser (`npm run dev` without Tauri) there is no backend, so we fall back to
 * localStorage — that keeps the design work fast to iterate on.
 */
const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/* ------------------------------------------------------- browser fallback */

const LS = "jws-forms-dev";
type DevDb = { forms: Record<string, FormDef>; responses: Record<string, string[][]>; headers: Record<string, string[]> };

function devDb(): DevDb {
  try {
    return JSON.parse(localStorage.getItem(LS) || "") as DevDb;
  } catch {
    return { forms: {}, responses: {}, headers: {} };
  }
}
function saveDev(db: DevDb) {
  localStorage.setItem(LS, JSON.stringify(db));
}

/* ------------------------------------------------------------------ forms */

export async function listForms(): Promise<FormSummary[]> {
  if (!inTauri) {
    const db = devDb();
    return Object.values(db.forms)
      .map((f) => ({
        id: f.id,
        title: f.title || "Untitled form",
        description: f.description,
        style: f.settings.style,
        institution: f.settings.institution,
        questionCount: f.questions.filter((q) => q.type !== "section").length,
        responseCount: (db.responses[f.id] || []).length,
        updatedAt: f.updatedAt,
        createdAt: f.createdAt,
        acceptingResponses: f.settings.acceptingResponses,
        excelPath: `(dev) ${f.title}.xlsx`,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return invoke<FormSummary[]>("list_forms");
}

export async function getForm(id: string): Promise<FormDef> {
  if (!inTauri) {
    const f = devDb().forms[id];
    if (!f) throw new Error("Form not found");
    return f;
  }
  return invoke<FormDef>("get_form", { id });
}

export async function saveForm(form: FormDef): Promise<void> {
  if (!inTauri) {
    const db = devDb();
    db.forms[form.id] = form;
    saveDev(db);
    return;
  }
  await invoke("save_form", { form });
}

export async function deleteForm(id: string, deleteResponses: boolean): Promise<void> {
  if (!inTauri) {
    const db = devDb();
    delete db.forms[id];
    if (deleteResponses) delete db.responses[id];
    saveDev(db);
    return;
  }
  await invoke("delete_form", { id, deleteResponses });
}

export async function duplicateForm(id: string): Promise<FormDef> {
  if (!inTauri) {
    const db = devDb();
    const src = db.forms[id];
    const copy: FormDef = {
      ...src,
      id: Math.random().toString(36).slice(2),
      title: `${src.title} (copy)`,
      updatedAt: new Date().toISOString(),
    };
    db.forms[copy.id] = copy;
    saveDev(db);
    return copy;
  }
  return invoke<FormDef>("duplicate_form", { id });
}

/* -------------------------------------------------------------- responses */

export async function submitResponse(
  formId: string,
  headers: string[],
  values: string[]
): Promise<number> {
  if (!inTauri) {
    const db = devDb();
    db.headers[formId] = headers;
    db.responses[formId] = [...(db.responses[formId] || []), values];
    saveDev(db);
    return db.responses[formId].length;
  }
  return invoke<number>("submit_response", { formId, headers, values });
}

export async function getResponses(formId: string): Promise<ResponseTable> {
  if (!inTauri) {
    const db = devDb();
    return { headers: db.headers[formId] || [], rows: db.responses[formId] || [], path: "(dev)" };
  }
  return invoke<ResponseTable>("get_responses", { formId });
}

export async function clearResponses(formId: string): Promise<void> {
  if (!inTauri) {
    const db = devDb();
    delete db.responses[formId];
    saveDev(db);
    return;
  }
  await invoke("clear_responses", { formId });
}

/* ------------------------------------------------------------------- disk */

export async function dataDir(): Promise<string> {
  if (!inTauri) return "(browser preview — data is kept in this browser only)";
  return invoke<string>("data_dir");
}

export async function setDataDir(path: string): Promise<void> {
  if (!inTauri) return;
  await invoke("set_data_dir", { path });
}

export async function pathExists(path: string): Promise<boolean> {
  if (!inTauri) return false;
  return invoke<boolean>("path_exists", { path });
}

/** Open a file or folder with whatever Windows uses for it (Excel, Explorer…). */
export async function openPath(path: string): Promise<void> {
  if (!inTauri) {
    alert(`Would open:\n${path}`);
    return;
  }
  const { openPath: op } = await import("@tauri-apps/plugin-opener");
  await op(path);
}

/**
 * Show a file in Explorer with the file itself highlighted.
 *
 * This is what "Show folder" should always have used. Handing a *directory* to
 * `openPath` works on some Windows setups and quietly does nothing on others,
 * depending on what is registered for the folder verb; `revealItemInDir` is the
 * API built for the job. If it is unavailable, opening the containing folder is
 * the fallback rather than nothing happening.
 */
export async function revealPath(path: string): Promise<void> {
  if (!inTauri) {
    alert(`Would show in Explorer:\n${path}`);
    return;
  }
  const opener = await import("@tauri-apps/plugin-opener");
  const reveal = (opener as { revealItemInDir?: (p: string) => Promise<void> }).revealItemInDir;
  if (reveal) {
    await reveal(path);
    return;
  }
  await opener.openPath(path.replace(/[\\/][^\\/]+$/, ""));
}

export async function pickFolder(current: string): Promise<string | null> {
  if (!inTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, defaultPath: current });
  return typeof picked === "string" ? picked : null;
}

/* ----------------------------------------------------------------- server */

export async function serverStart(formId: string, port: number): Promise<ServerStatus> {
  if (!inTauri) throw new Error("Sharing needs the desktop app.");
  return invoke<ServerStatus>("server_start", { formId, port });
}

export async function serverStop(): Promise<ServerStatus> {
  if (!inTauri) return { running: false, formId: "", formTitle: "", url: "", port: 0, qrSvg: "" };
  return invoke<ServerStatus>("server_stop");
}

export async function serverStatus(): Promise<ServerStatus> {
  if (!inTauri) return { running: false, formId: "", formTitle: "", url: "", port: 0, qrSvg: "" };
  return invoke<ServerStatus>("server_status");
}

/* ----------------------------------------------------------------- public */

const OFF: TunnelStatus = {
  state: "off", publicUrl: "", localUrl: "", formId: "", formTitle: "",
  qrSvg: "", message: "", helperInstalled: false,
};

export async function tunnelStatus(): Promise<TunnelStatus> {
  if (!inTauri) return OFF;
  return invoke<TunnelStatus>("tunnel_status");
}

/** One-time download of the sharing helper (~25 MB). */
export async function tunnelInstall(): Promise<TunnelStatus> {
  if (!inTauri) throw new Error("Sharing needs the desktop app.");
  return invoke<TunnelStatus>("tunnel_install");
}

export async function tunnelStart(formId: string, port: number): Promise<TunnelStatus> {
  if (!inTauri) throw new Error("Sharing needs the desktop app.");
  return invoke<TunnelStatus>("tunnel_start", { formId, port });
}

export async function tunnelStop(): Promise<TunnelStatus> {
  if (!inTauri) return OFF;
  return invoke<TunnelStatus>("tunnel_stop");
}

/* ---------------------------------------------------------------- updates */

export interface UpdateInfo {
  available: boolean;
  version: string;
  notes: string;
}

/**
 * Ask GitHub whether there is a newer signed build.
 *
 * The failures here are all ordinary and all look identical to a user staring
 * at a red toast, so each one is translated into something they can act on.
 * The most common by far is the first: the very first release has not been
 * published yet, and GitHub answers the "latest release" URL with a 404.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  if (!inTauri) return { available: false, version: "", notes: "" };
  const { check } = await import("@tauri-apps/plugin-updater");
  try {
    const up = await check();
    if (!up) return { available: false, version: "", notes: "" };
    return { available: true, version: up.version, notes: up.body ?? "" };
  } catch (e) {
    throw new Error(updateErrorText(e));
  }
}

function updateErrorText(e: unknown): string {
  const raw = String((e as { message?: string })?.message ?? e);
  const low = raw.toLowerCase();

  // The updater fetches latest.json anonymously, so a private repository looks
  // exactly like a missing one. Both land here, and both are fixed on GitHub
  // rather than in the app, so say what to go and do.
  if (
    low.includes("404") ||
    low.includes("not found") ||
    low.includes("valid release json") ||
    low.includes("release json")
  ) {
    return (
      "GitHub did not return a release file. Two things cause this: " +
      "no version has been published yet, or the repository is private — the updater " +
      "downloads without signing in, so a private repo looks empty to it. " +
      "Check that the Releases page lists a version and that the repository is public."
    );
  }
  if (low.includes("signature") || low.includes("minisign") || low.includes("verify")) {
    return "That update was not signed with this school's key, so it was refused. Rebuild the release with the JWS signing key.";
  }
  if (
    low.includes("network") ||
    low.includes("dns") ||
    low.includes("timed out") ||
    low.includes("timeout") ||
    low.includes("connect") ||
    low.includes("sending request")
  ) {
    return "Could not reach GitHub. This PC needs an internet connection to check for updates — everything else in JWS Forms works offline.";
  }
  return `Could not check for updates. ${raw}`;
}

export async function installUpdate(onProgress?: (pct: number) => void): Promise<void> {
  if (!inTauri) return;
  const { check } = await import("@tauri-apps/plugin-updater");
  const { relaunch } = await import("@tauri-apps/plugin-process");
  let up;
  try {
    up = await check();
  } catch (e) {
    throw new Error(updateErrorText(e));
  }
  if (!up) return;

  let total = 0;
  let done = 0;
  await up.downloadAndInstall((e) => {
    if (e.event === "Started") total = e.data.contentLength ?? 0;
    else if (e.event === "Progress") {
      done += e.data.chunkLength;
      if (total) onProgress?.(Math.round((done / total) * 100));
    } else if (e.event === "Finished") onProgress?.(100);
  });
  await relaunch();
}

export const isDesktop = inTauri;
