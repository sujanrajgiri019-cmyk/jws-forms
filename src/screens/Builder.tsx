import { useCallback, useEffect, useRef, useState, type JSX } from "react";
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
import { Letterhead } from "../components/Logo";
import { Button, Menu, Spinner, Toggle, useToast } from "../components/ui";
import { QuestionCard } from "../builder/QuestionCard";
import { TYPES, TYPE_GROUPS, isDisplay } from "../lib/questionTypes";
import { allHeaders } from "../lib/answers";
import { INSTITUTION_LIST } from "../lib/brand";
import { COLORWAYS } from "../lib/colorway";
import { useApp } from "../lib/store";
import * as api from "../lib/api";
import type { FormStyle, QuestionType, TunnelStatus } from "../types";

type Tab = "questions" | "design" | "settings";

export default function Builder({ id }: { id: string }) {
  const { form, openForm, patch, addQuestion, reorder, saving, dirty, go, selected } = useApp();
  const [tab, setTab] = useState<Tab>("questions");

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

  const askCount = form.questions.filter((q) => !isDisplay(q.type)).length;

  return (
    <>
      <div className="topbar">
        <Button icon="back" aria-label="Back to my forms" onClick={() => go({ name: "home" })} />
        <h1 className="truncate" style={{ maxWidth: 340 }}>
          {form.title || "Untitled form"}
        </h1>
        <span
          style={{ fontSize: 12.5, color: "var(--ink-3)", display: "flex", gap: 6, alignItems: "center" }}
        >
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

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "questions"}
          className={`tab${tab === "questions" ? " on" : ""}`}
          onClick={() => setTab("questions")}
        >
          <Icon name="list" />
          Questions
          <span className="badge">{askCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "design"}
          className={`tab${tab === "design" ? " on" : ""}`}
          onClick={() => setTab("design")}
        >
          <Icon name="palette" />
          Design
        </button>
        <button
          role="tab"
          aria-selected={tab === "settings"}
          className={`tab${tab === "settings" ? " on" : ""}`}
          onClick={() => setTab("settings")}
        >
          <Icon name="settings" />
          Settings
        </button>
      </nav>

      <div className="scroll">
        <div className="page narrow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PublishPanel id={id} />

          {tab === "questions" && (
            <>
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
                    <div style={{ maxHeight: 420, overflowY: "auto", minWidth: 224 }}>
                      {TYPE_GROUPS.map((g, gi) => (
                        <div key={g}>
                          {gi > 0 && <hr />}
                          <div className="grouphead">{g}</div>
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
            </>
          )}

          {tab === "design" && (
            <>
              <InstitutionPanel />
              <StylePicker />
              <ColorwayPanel />
            </>
          )}

          {tab === "settings" && (
            <>
              <FormSettingsPanel />
              <QuizPanel />
              <ReceiptPanel />
              <DataFolderPanel />
              <WebhookPanel />
              <ColumnsPanel columns={allHeaders(form)} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ==========================================================================
   DESIGN TAB
   ========================================================================== */

function InstitutionPanel() {
  const { form, patchSettings } = useApp();
  if (!form) return null;
  return (
    <div className="card pad">
      <h3>Whose letterhead?</h3>
      <p className="hint" style={{ marginTop: 3 }}>
        The mark, the name and the wording change. Address and phone numbers are the
        same for all three.
      </p>
      <div className="instpick" style={{ marginTop: 16 }}>
        {INSTITUTION_LIST.map((inst) => (
          <button
            key={inst.id}
            className={`instopt${form.settings.institution === inst.id ? " on" : ""}`}
            onClick={() => patchSettings({ institution: inst.id })}
            aria-pressed={form.settings.institution === inst.id}
          >
            <img
              src={inst.logo}
              alt=""
              style={{ height: 46, width: 46 * inst.aspect, objectFit: "contain" }}
            />
            <span>
              <b>{inst.label}</b>
              <s>{inst.name}</s>
            </span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--hair)" }}>
        <label className="label">This is how it will head the form</label>
        <div
          style={{
            border: "1px solid var(--hair)",
            borderRadius: "var(--r)",
            padding: "22px 24px",
            background: "#fff",
          }}
        >
          <Letterhead institution={form.settings.institution} height={54} />
        </div>
      </div>
    </div>
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
  {
    id: "letterhead",
    name: "Letterhead",
    note: "Looks like official school stationery.",
    thumb: (
      <div className="th-let">
        <div className="hd"><i /><em /></div>
        <s /><s /><s style={{ width: "60%" }} />
        <div className="ft" />
      </div>
    ),
  },
  {
    id: "cards",
    name: "Cards",
    note: "Each question floats on its own card.",
    thumb: (
      <div className="th-crd">
        <div className="c"><i /><s /></div>
        <div className="c on"><i /><s /></div>
        <div className="c"><i /></div>
      </div>
    ),
  },
  {
    id: "cover",
    name: "Cover",
    note: "A full orange cover, then the questions.",
    thumb: (
      <div className="th-cov">
        <div className="top"><i /><em /></div>
        <div className="bot"><s /><s style={{ width: "70%" }} /></div>
      </div>
    ),
  },
  {
    id: "split",
    name: "Split screen",
    note: "A poster that stays put beside the questions. Built for a kiosk.",
    thumb: (
      <div className="th-spl">
        <div className="l"><i /><em /></div>
        <div className="r"><s /><u /><s style={{ width: "70%" }} /><u /></div>
      </div>
    ),
  },
  {
    id: "arena",
    name: "Arena",
    note: "Loud and athletic. Near-black, sharp corners, floodlit orange.",
    thumb: (
      <div className="th-arn">
        <div className="hz" />
        <div className="rw"><b>01</b><s /></div>
        <div className="rw"><b>02</b><s style={{ width: "50%" }} /></div>
        <div className="btn" />
      </div>
    ),
  },
  {
    id: "prospectus",
    name: "Prospectus",
    note: "Prestigious. A sticky programme panel and serif headings.",
    thumb: (
      <div className="th-pro">
        <div className="l"><i /><em /></div>
        <div className="r"><s /><u /><s style={{ width: "62%" }} /><u /></div>
      </div>
    ),
  },
  {
    id: "terminal",
    name: "Terminal",
    note: "Dense and monospaced. For an office clerk typing all morning.",
    thumb: (
      <div className="th-trm">
        <em>&gt; form</em>
        <div className="ln"><b>01</b><s /></div>
        <div className="ln"><b>02</b><s style={{ width: "44%" }} /></div>
        <div className="ln"><b>03</b><s style={{ width: "62%" }} /></div>
        <div className="ln"><b>04</b><s style={{ width: "38%" }} /></div>
      </div>
    ),
  },
  {
    id: "community",
    name: "Community",
    note: "Warm and conversational. Questions arrive as soft bubbles.",
    thumb: (
      <div className="th-cmy">
        <div className="bub"><i /><s /></div>
        <div className="bub"><i /><s style={{ width: "56%" }} /></div>
      </div>
    ),
  },
];

function StylePicker() {
  const { form, patchSettings, go } = useApp();
  if (!form) return null;
  return (
    <div className="card pad">
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div>
          <h3>Form style</h3>
          <p className="hint" style={{ marginTop: 3 }}>
            How the form looks to whoever fills it in — on this PC, on the Wi-Fi link
            and on the public link.
          </p>
        </div>
        <Button size="sm" icon="eye" onClick={() => go({ name: "preview", id: form.id })}>
          Preview
        </Button>
      </div>
      <div className="stylepick" style={{ marginTop: 18 }}>
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

/* ==========================================================================
   SETTINGS TAB
   ========================================================================== */

function Row({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="between">
      <div>
        <div style={{ fontWeight: 550 }}>{title}</div>
        <p className="hint" style={{ marginTop: 0 }}>{note}</p>
      </div>
      {children}
    </div>
  );
}

function FormSettingsPanel() {
  const { form, patchSettings } = useApp();
  if (!form) return null;
  const s = form.settings;

  return (
    <div className="card pad">
      <h3 style={{ marginBottom: 16 }}>Form settings</h3>
      <div className="stack">
        <Row title="Accepting responses" note="Turn off to close the form without deleting anything.">
          <Toggle checked={s.acceptingResponses} onChange={(v) => patchSettings({ acceptingResponses: v })} />
        </Row>
        <Row title="Record a timestamp" note="Adds a “Timestamp” column as the first column in the sheet.">
          <Toggle checked={s.collectTimestamp} onChange={(v) => patchSettings({ collectTimestamp: v })} />
        </Row>
        <Row
          title="Shuffle question order"
          note="Mixes the questions within each section, never across one — a section heading is a promise about what follows it. Useful for a test."
        >
          <Toggle
            checked={!!s.shuffleQuestions}
            onChange={(v) => patchSettings({ shuffleQuestions: v })}
          />
        </Row>
        <Row title="Show progress" note="The bar on the Panel wall and along the top of Focus.">
          <Toggle checked={s.showProgress} onChange={(v) => patchSettings({ showProgress: v })} />
        </Row>
        <Row title="Allow another response" note="Shows a “Submit another response” link — ideal for a shared kiosk PC.">
          <Toggle checked={s.allowMultiple} onChange={(v) => patchSettings({ allowMultiple: v })} />
        </Row>
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

function DataFolderPanel() {
  const { form, patchSettings } = useApp();
  const toast = useToast();
  const [appDefault, setAppDefault] = useState("");

  useEffect(() => {
    void api.dataDir().then(setAppDefault);
  }, []);

  if (!form) return null;
  const custom = form.settings.dataFolder;

  async function choose() {
    const picked = await api.pickFolder(custom || appDefault);
    if (!picked) return;
    patchSettings({ dataFolder: picked });
    toast("This form's responses will be saved there from now on");
  }

  return (
    <div className="card pad">
      <h3>Where this form's answers are saved</h3>
      <p className="hint" style={{ marginTop: 3 }}>
        Each form writes one Excel workbook. Point this at a shared drive or OneDrive
        folder and the office gets the responses without touching this PC.
      </p>
      <div className="urlbox" style={{ marginTop: 14, fontSize: 13.5 }}>
        {custom || `${appDefault}\\responses`}
        {!custom && <span style={{ color: "var(--ink-3)" }}> (app default)</span>}
      </div>
      <div className="wrap-row" style={{ marginTop: 12 }}>
        <Button variant="outline" icon="folder" onClick={() => void choose()}>
          Choose a folder
        </Button>
        <Button icon="folder" onClick={() => void api.openPath(custom || appDefault)}>
          Open it
        </Button>
        {custom && (
          <Button
            variant="ghost"
            icon="refresh"
            onClick={() => {
              patchSettings({ dataFolder: "" });
              toast("Back to the app's default folder");
            }}
          >
            Use the default
          </Button>
        )}
      </div>
    </div>
  );
}

function ColumnsPanel({ columns }: { columns: string[] }) {
  const toast = useToast();
  return (
    <div className="card pad">
      <div className="between" style={{ marginBottom: 12 }}>
        <div>
          <h3>Excel columns</h3>
          <p className="hint" style={{ marginTop: 2 }}>
            The exact column layout responses are written into.
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
            <tr>{columns.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr>{columns.map((_, i) => <td key={i} style={{ color: "var(--faint)" }}>—</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================================
   PUBLISH — the editor's call to action, above the tabs' content
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
            Publish it and you get a web link and a QR code anyone can open — parents at
            home included. Answers land in your Excel file.
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


/* ==========================================================================
   COLOURWAY + KIOSK
   ========================================================================== */

function ColorwayPanel() {
  const { form, patchSettings } = useApp();
  if (!form) return null;
  const current = form.settings.colorway ?? "brand";
  return (
    <div className="card pad">
      <h3>Accent colour</h3>
      <p className="hint" style={{ marginTop: 3 }}>
        The mark, the address and the layout never change — only the accent. It
        helps when School, +2 and College are collecting at three desks in the
        same hall.
      </p>
      <div className="cwpick" style={{ marginTop: 16 }}>
        {COLORWAYS.map((c) => (
          <button
            key={c.id}
            className={`cwopt${current === c.id ? " on" : ""}`}
            onClick={() => patchSettings({ colorway: c.id })}
            aria-pressed={current === c.id}
          >
            <span className="dot" style={{ background: c.swatch }} />
            <span>
              <b>{c.label}</b>
              <s>{c.note}</s>
            </span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--hair)" }}>
        <Row
          title="High-contrast kiosk mode"
          note="A dark, high-contrast form for an unattended counter laptop under strip lights. Only the form changes — the app stays as it is."
        >
          <Toggle
            checked={!!form.settings.kiosk}
            onChange={(v) => patchSettings({ kiosk: v })}
            label=""
          />
        </Row>
      </div>
    </div>
  );
}

/* ==========================================================================
   PRINTABLE SLIP
   ========================================================================== */

function ReceiptPanel() {
  const { form, patchSettings } = useApp();
  if (!form) return null;
  const r = form.settings.receipt;
  const askable = form.questions.filter((q) => !isDisplay(q.type));

  const setR = (p: Partial<typeof r>) => patchSettings({ receipt: { ...r, ...p } });

  function toggleField(id: string) {
    setR({
      fields: r.fields.includes(id)
        ? r.fields.filter((f) => f !== id)
        : [...r.fields, id],
    });
  }

  return (
    <div className="card pad">
      <Row
        title="Printable slip after submitting"
        note="Hands the person a numbered acknowledgement they can print or save as a PDF. Useful at an admission counter."
      >
        <Toggle checked={r.enabled} onChange={(v) => setR({ enabled: v })} label="" />
      </Row>

      {r.enabled && (
        <div className="stack" style={{ marginTop: 18, gap: 18 }}>
          <div>
            <label className="label">Heading on the slip</label>
            <input
              className="input"
              placeholder={form.title || "Acknowledgement"}
              value={r.title}
              onChange={(e) => setR({ title: e.target.value })}
            />
          </div>

          <Row
            title="Print a token number"
            note="The row number in the workbook — so token 0040 is row 40, and the office can find it instantly."
          >
            <Toggle checked={r.showToken} onChange={(v) => setR({ showToken: v })} label="" />
          </Row>

          {r.showToken && (
            <div style={{ maxWidth: 240 }}>
              <label className="label">Letters in front of the number</label>
              <input
                className="input"
                placeholder="e.g. ADM-"
                value={r.tokenPrefix}
                onChange={(e) => setR({ tokenPrefix: e.target.value })}
              />
              <p className="hint" style={{ marginTop: 6 }}>
                Gives {r.tokenPrefix || ""}0042
              </p>
            </div>
          )}

          <div>
            <label className="label">Which answers to print</label>
            {askable.length === 0 ? (
              <p className="hint">Add a question first.</p>
            ) : (
              <div className="slipfields">
                {askable.map((q) => (
                  <label
                    key={q.id}
                    className={`slipfield${r.fields.includes(q.id) ? " on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={r.fields.includes(q.id)}
                      onChange={() => toggleField(q.id)}
                    />
                    <span className="truncate">{q.title.trim() || "Untitled question"}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="hint" style={{ marginTop: 8 }}>
              Keep it short — a name, a contact number and what they applied for is
              usually the whole slip. An answer left blank is left off.
            </p>
          </div>

          <div>
            <label className="label">Small print at the foot</label>
            <input
              className="input"
              value={r.note}
              onChange={(e) => setR({ note: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   WEBHOOK
   ========================================================================== */

function WebhookPanel() {
  const { form, patchSettings } = useApp();
  const [touched, setTouched] = useState(false);
  if (!form) return null;
  const url = form.settings.webhookUrl ?? "";
  const bad = touched && url.trim() !== "" && !/^https?:\/\/\S+$/i.test(url.trim());

  return (
    <div className="card pad">
      <h3>Send a copy somewhere else (optional)</h3>
      <p className="hint" style={{ marginTop: 3 }}>
        Every response is POSTed as JSON to this address as well as being written
        to Excel. Use it to feed a Google Sheet, a school portal or a messaging
        bot.
      </p>
      <input
        className="input"
        style={{ marginTop: 14 }}
        placeholder="https://…"
        value={url}
        onBlur={() => setTouched(true)}
        onChange={(e) => patchSettings({ webhookUrl: e.target.value })}
      />
      {bad && (
        <p className="error" style={{ marginTop: 8 }}>
          <Icon name="alert" size={15} />
          That should start with https:// — leave it empty to switch this off.
        </p>
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        The Excel file is written first and the POST happens afterwards, in the
        background. A slow, blocked or offline endpoint never delays a person at
        the counter and never fails their submission — the response is safely on
        disk either way.
      </p>
    </div>
  );
}


/* ==========================================================================
   QUIZ
   ========================================================================== */

function QuizPanel() {
  const { form, patchSettings } = useApp();
  if (!form) return null;
  const marked = form.questions.filter((q) => q.answerKey?.length);
  const total = marked.reduce((n, q) => n + (Number(q.points) || 0), 0);

  return (
    <div className="card pad">
      <Row
        title="Mark this form as a quiz"
        note="Set a correct answer and marks on each question. Every response is scored automatically and the score lands in the workbook."
      >
        <Toggle
          checked={!!form.settings.quiz}
          onChange={(v) => patchSettings({ quiz: v })}
          label=""
        />
      </Row>

      {form.settings.quiz && (
        <div className="stack" style={{ marginTop: 18, gap: 16 }}>
          <Row
            title="Show the score when they submit"
            note="Turn this off for an entrance test you want to mark before anyone sees a result."
          >
            <Toggle
              checked={form.settings.quizShowScore !== false}
              onChange={(v) => patchSettings({ quizShowScore: v })}
              label=""
            />
          </Row>

          <div className="card pad flat" style={{ borderLeft: "3px solid var(--o-500)" }}>
            {marked.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                No answer keys set yet. Open a question and use its{" "}
                <b>Answer key</b> button.
              </p>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                <b>
                  {marked.length} question{marked.length === 1 ? "" : "s"} marked, {total}{" "}
                  mark{total === 1 ? "" : "s"} in total.
                </b>{" "}
                Two extra columns — <b>Score</b> and <b>Out of</b> — are added to the
                Excel file. A question somebody never saw, because a branch skipped
                it, is left out of their total rather than counted wrong.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
