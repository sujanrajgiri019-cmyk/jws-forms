import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Icon } from "../components/Icons";
import { Button, Menu, Spinner, useToast } from "../components/ui";
import { QuestionCard } from "../builder/QuestionCard";
import { TYPES, TYPE_GROUPS } from "../lib/questionTypes";
import { allHeaders } from "../lib/answers";
import { useApp } from "../lib/store";
import * as api from "../lib/api";
import type { FormStyle, QuestionType, TunnelStatus } from "../types";

export default function Builder({ id }: { id: string }) {
  const { form, openForm, patch, addQuestion, reorder, saving, dirty, go, selected } = useApp();
  const toast = useToast();

  useEffect(() => {
    void openForm(id);
  }, [id, openForm]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!form || form.id !== id) {
    return (
      <div className="center-fill">
        <Spinner />
        Opening form…
      </div>
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !form) return;
    const from = form.questions.findIndex((q) => q.id === active.id);
    const to = form.questions.findIndex((q) => q.id === over.id);
    if (from >= 0 && to >= 0) reorder(from, to);
  }

  const columns = allHeaders(form);

  return (
    <>
      <div className="topbar">
        <Button icon="back" aria-label="Back to my forms" onClick={() => go({ name: "home" })} />
        <h1 className="truncate" style={{ maxWidth: 380 }}>
          {form.title || "Untitled form"}
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--ink-3)", display: "flex", gap: 6, alignItems: "center" }}>
          {saving ? (
            <>
              <Spinner /> Saving…
            </>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            <>
              <Icon name="check" size={14} /> Saved
            </>
          )}
        </span>
        <span className="grow" />
        <Button icon="eye" onClick={() => go({ name: "preview", id })}>
          Preview
        </Button>
        <Button icon="play" onClick={() => go({ name: "fill", id })}>
          Fill in
        </Button>
        <Button variant="primary" icon="share" onClick={() => go({ name: "share", id })}>
          Share
        </Button>
      </div>

      <div className="scroll">
        <div className="page narrow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* ---- publish ---- */}
          <PublishPanel id={id} />

          {/* ---- form header ---- */}
          <div className="card" style={{ padding: "22px 24px" }}>
            <input
              className="bare h1"
              value={form.title}
              placeholder="Form title"
              onChange={(e) => patch({ title: e.target.value })}
            />
            <textarea
              className="bare muted"
              value={form.description}
              placeholder="Form description — shown to whoever fills it in"
              onChange={(e) => patch({ description: e.target.value })}
              rows={form.description.split("\n").length + 1}
              style={{ marginTop: 8, resize: "none", overflow: "hidden" }}
            />
          </div>

          {/* ---- questions ---- */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={form.questions.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {form.questions.map((q, i) => (
                  <QuestionCard key={q.id} q={q} index={i} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* ---- add ---- */}
          <div className="row" style={{ justifyContent: "center", gap: 10, paddingTop: 4 }}>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => addQuestion("short_text", selected ?? undefined)}
            >
              Add question
            </Button>

            <Menu
              align="left"
              trigger={(open) => (
                <Button variant="outline" icon="list" onClick={open}>
                  Add a specific type
                </Button>
              )}
            >
              {(close) => (
                <div style={{ maxHeight: 400, overflowY: "auto", minWidth: 218 }}>
                  {TYPE_GROUPS.map((g, gi) => (
                    <div key={g}>
                      {gi > 0 && <hr />}
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: ".09em",
                          textTransform: "uppercase",
                          color: "var(--faint)",
                          padding: "6px 10px 3px",
                          fontWeight: 700,
                        }}
                      >
                        {g}
                      </div>
                      {TYPES.filter((t) => t.group === g).map((t) => (
                        <button
                          key={t.type}
                          onClick={() => {
                            addQuestion(t.type as QuestionType, selected ?? undefined);
                            close();
                          }}
                        >
                          {t.icon}
                          {t.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Menu>
          </div>

          <hr className="divider" />

          {/* ---- style + settings ---- */}
          <StylePicker />
          <FormSettingsPanel />

          {/* ---- sheet preview ---- */}
          <div className="card pad">
            <div className="between" style={{ marginBottom: 10 }}>
              <div>
                <h3>Excel columns</h3>
                <p className="hint" style={{ marginTop: 2 }}>
                  This is the exact column layout responses are written into.
                </p>
              </div>
              <Button
                size="sm"
                icon="clipboard"
                onClick={() => {
                  void navigator.clipboard.writeText(columns.join("\t"));
                  toast("Column headers copied");
                }}
              >
                Copy headers
              </Button>
            </div>
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    {columns.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {columns.map((_, i) => (
                      <td key={i} style={{ color: "var(--faint)" }}>
                        —
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const STYLES: { id: FormStyle; name: string; note: string; thumb: JSX.Element }[] = [
  {
    id: "register",
    name: "Register",
    note: "Official and type-led. No boxes.",
    thumb: (
      <div className="th-reg">
        <i />
        <u />
        <span><b>01</b><s /></span>
        <span><b>02</b><s /></span>
        <span><b>03</b><s /></span>
      </div>
    ),
  },
  {
    id: "panel",
    name: "Panel",
    note: "Orange wall, sections, chips.",
    thumb: (
      <div className="th-pan">
        <div className="l" />
        <div className="r">
          <i style={{ width: "70%" }} />
          <em><s className="on" /><s /><s /></em>
          <i style={{ width: "55%" }} />
          <em><s /><s className="on" /></em>
        </div>
      </div>
    ),
  },
  {
    id: "focus",
    name: "Focus",
    note: "One question at a time. Best on phones.",
    thumb: (
      <div className="th-foc">
        <div className="bar"><i /></div>
        <u />
        <s />
        <s className="on" />
      </div>
    ),
  },
];

function StylePicker() {
  const { form, patchSettings, go } = useApp();
  if (!form) return null;
  return (
    <div className="card pad">
      <div className="between" style={{ marginBottom: 4, alignItems: "flex-start" }}>
        <div>
          <h3>Form style</h3>
          <p className="hint" style={{ marginTop: 3 }}>
            How this form looks to whoever fills it in. Changes apply everywhere —
            on this PC, on the Wi-Fi link and on the public link.
          </p>
        </div>
        <Button size="sm" icon="eye" onClick={() => go({ name: "preview", id: form.id })}>
          Preview
        </Button>
      </div>
      <div className="stylepick" style={{ marginTop: 16 }}>
        {STYLES.map((s) => (
          <button
            key={s.id}
            className={`styleopt${form.settings.style === s.id ? " on" : ""}`}
            onClick={() => patchSettings({ style: s.id })}
            aria-pressed={form.settings.style === s.id}
          >
            <div className="thumb">{s.thumb}</div>
            <div className="cap">
              <b>{s.name}</b>
              <s>{s.note}</s>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormSettingsPanel() {
  const { form, patchSettings } = useApp();
  if (!form) return null;
  const s = form.settings;

  return (
    <div className="card pad">
      <h3 style={{ marginBottom: 14 }}>Form settings</h3>
      <div className="stack">
        <div className="between">
          <div>
            <div style={{ fontWeight: 550 }}>Accepting responses</div>
            <p className="hint" style={{ marginTop: 0 }}>
              Turn off to close the form without deleting anything.
            </p>
          </div>
          <Toggle2 checked={s.acceptingResponses} onChange={(v) => patchSettings({ acceptingResponses: v })} />
        </div>

        <div className="between">
          <div>
            <div style={{ fontWeight: 550 }}>Record a timestamp</div>
            <p className="hint" style={{ marginTop: 0 }}>
              Adds a “Timestamp” column as the first column in the sheet.
            </p>
          </div>
          <Toggle2 checked={s.collectTimestamp} onChange={(v) => patchSettings({ collectTimestamp: v })} />
        </div>

        <div className="between">
          <div>
            <div style={{ fontWeight: 550 }}>Show progress</div>
            <p className="hint" style={{ marginTop: 0 }}>
              The bar on the Panel wall and along the top of Focus.
            </p>
          </div>
          <Toggle2 checked={s.showProgress} onChange={(v) => patchSettings({ showProgress: v })} />
        </div>

        <div className="between">
          <div>
            <div style={{ fontWeight: 550 }}>Allow another response</div>
            <p className="hint" style={{ marginTop: 0 }}>
              Shows a “Submit another response” link — ideal for a shared kiosk PC.
            </p>
          </div>
          <Toggle2 checked={s.allowMultiple} onChange={(v) => patchSettings({ allowMultiple: v })} />
        </div>

        <div>
          <label className="label">Confirmation message</label>
          <textarea
            className="input"
            style={{ minHeight: 70 }}
            value={s.confirmationMessage}
            onChange={(e) => patchSettings({ confirmationMessage: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

/** Local alias so the settings rows read cleanly. */
function Toggle2({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}


/* ==========================================================================
   The publish panel.
   It sits at the top of the editor because "how do I send this to people?" is
   the question everyone has, and burying it behind a hover or a side screen is
   how people fail to find it.
   ========================================================================== */

const PORT = 7788;

function PublishPanel({ id }: { id: string }) {
  const { go } = useApp();
  const toast = useToast();
  const [st, setSt] = useState<TunnelStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    try {
      setSt(await api.tunnelStatus());
    } catch {
      /* no desktop backend in a browser preview */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const moving = st?.state === "starting" || st?.state === "installing";
    clearInterval(poll.current);
    if (moving) poll.current = setInterval(() => void refresh(), 1200);
    return () => clearInterval(poll.current);
  }, [st?.state, refresh]);

  const live = st?.state === "live" && st.formId === id;
  const url = live ? st!.publicUrl || st!.localUrl : "";

  async function publish() {
    setBusy(true);
    try {
      await useApp.getState().save();
      if (!st?.helperInstalled) {
        toast("Downloading the sharing helper — this happens once");
        await api.tunnelInstall();
      }
      setSt(await api.tunnelStart(id, PORT));
      toast("Your form is live. Copy the link and send it out.");
    } catch (e) {
      toast(String(e), "bad");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      setSt(await api.tunnelStop());
      toast("Form taken offline — the link no longer works");
    } finally {
      setBusy(false);
    }
  }

  if (live) {
    return (
      <div className="publish">
        <div className="say">
          <span className="icon" style={{ background: "var(--ok)", boxShadow: "none" }}>
            <Icon name="checkCircle" />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 10 }}>
              <h3>This form is live</h3>
              <span className="pill ok">
                <span className="livedot" />
                Accepting answers
              </span>
            </div>
            <div className="linkrow" style={{ marginTop: 12 }}>
                <code>{url}</code>
              <Button
                variant="primary"
                size="sm"
                icon="clipboard"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast("Link copied — paste it into a message or email");
                }}
              >
                Copy link
              </Button>
            </div>
          </div>
        </div>
        <div className="acts">
          <Button variant="outline" icon="share" onClick={() => go({ name: "share", id })}>
            QR code
          </Button>
          <Button variant="danger" icon="stop" onClick={() => void unpublish()} disabled={busy}>
            Take offline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="publish">
      <div className="say">
        <span className="icon">
          <Icon name="share" />
        </span>
        <div className="grow">
          <h3>Ready to send this out?</h3>
          <p>
            Publish it and you get a web link and a QR code anyone can open — parents
            at home included. Answers land in your Excel file.
          </p>
        </div>
      </div>
      <div className="acts">
        <Button variant="outline" icon="eye" onClick={() => go({ name: "preview", id })}>
          Preview first
        </Button>
        <Button variant="primary" size="lg" icon="share" onClick={() => void publish()} disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? "Publishing…" : "Publish & get link"}
        </Button>
      </div>
    </div>
  );
}
