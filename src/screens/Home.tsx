import { useMemo, useState } from "react";
import { Icon } from "../components/Icons";
import { Button, ConfirmModal, Empty, Menu, Modal, relativeTime, useToast } from "../components/ui";
import { useApp } from "../lib/store";
import * as api from "../lib/api";
import { newForm } from "../lib/questionTypes";
import { INSTITUTION_LIST } from "../lib/brand";
import type { FormStyle, FormSummary, Institution } from "../types";

const STYLE_LABEL: Record<FormStyle, string> = {
  register: "Register",
  panel: "Panel",
  focus: "Focus",
  letterhead: "Letterhead",
  cards: "Cards",
  cover: "Cover",
};

export default function Home() {
  const { forms, loadingForms, refreshForms, go } = useApp();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<FormSummary | null>(null);
  const [picking, setPicking] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return forms;
    return forms.filter(
      (f) =>
        f.title.toLowerCase().includes(needle) ||
        f.description.toLowerCase().includes(needle)
    );
  }, [forms, q]);

  const totalResponses = forms.reduce((n, f) => n + f.responseCount, 0);

  async function create(institution: Institution) {
    setPicking(false);
    const f = newForm(institution);
    await api.saveForm(f);
    await refreshForms();
    await useApp.getState().openForm(f.id);
    go({ name: "builder", id: f.id });
  }

  async function open(id: string, to: "builder" | "fill" | "responses" | "preview" | "share" = "builder") {
    await useApp.getState().openForm(id);
    go({ name: to, id });
  }

  async function remove(f: FormSummary, alsoResponses: boolean) {
    await api.deleteForm(f.id, alsoResponses);
    await refreshForms();
    toast(
      alsoResponses
        ? `Deleted “${f.title}” and its responses`
        : `Deleted “${f.title}” — the Excel file was kept`
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>My forms</h1>
        {forms.length > 0 && (
          <span className="pill grey">
            {forms.length} form{forms.length === 1 ? "" : "s"} · {totalResponses} response
            {totalResponses === 1 ? "" : "s"}
          </span>
        )}
        <span className="grow" />
        {forms.length > 0 && (
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Search forms…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
        <Button variant="primary" icon="plus" onClick={() => setPicking(true)}>
          New form
        </Button>
      </div>

      <div className="scroll">
        <div className="page">
          {loadingForms && forms.length === 0 ? (
            <div className="center-fill" style={{ height: 280 }}>Loading…</div>
          ) : list.length === 0 ? (
            <Empty
              icon={q ? "search" : "file"}
              title={q ? "Nothing matches that search" : "No forms yet"}
              body={
                q
                  ? "Try a different word, or clear the search box."
                  : "Build one for admissions, an event, feedback, a trip. Pick one of three looks, share it with a link, and every answer lands in an Excel file on this PC."
              }
              action={
                q ? undefined : (
                  <Button variant="primary" size="lg" icon="plus" onClick={() => setPicking(true)}>
                    Create your first form
                  </Button>
                )
              }
            />
          ) : (
            <div className="ledger">
              {list.map((f, i) => (
                <div
                  key={f.id}
                  className="row-form"
                  onClick={() => void open(f.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && void open(f.id)}
                >
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>

                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <h3 className="truncate">{f.title}</h3>
                      <span className="pill">{STYLE_LABEL[f.style] ?? f.style}</span>
                      {!f.acceptingResponses && <span className="pill grey">Closed</span>}
                    </div>
                    <p className="sub truncate">
                      {f.description || `${f.questionCount} question${f.questionCount === 1 ? "" : "s"}`}
                    </p>
                    <p className="meta" style={{ marginTop: 6 }}>
                      <span>{f.questionCount} questions</span>
                      <span className="dot" />
                      <span>Edited {relativeTime(f.updatedAt)}</span>
                    </p>
                  </div>

                  <div className="count" style={{ color: f.responseCount ? "var(--ink)" : "var(--faint)" }}>
                    {f.responseCount}
                    <s className="lbl" style={{ color: "var(--ink-3)", fontSize: 9.5 }}>
                      response{f.responseCount === 1 ? "" : "s"}
                    </s>
                  </div>

                  <div className="acts" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="share"
                      onClick={() => void open(f.id, "share")}
                    >
                      Share
                    </Button>
                    <Button size="sm" icon="eye" aria-label="Preview" onClick={() => void open(f.id, "preview")} />
                    <Button size="sm" icon="play" aria-label="Fill in" onClick={() => void open(f.id, "fill")} />
                    <Button
                      size="sm"
                      icon="table"
                      aria-label="Responses"
                      onClick={() => void open(f.id, "responses")}
                    />
                    <Menu
                      trigger={(openMenu) => (
                        <Button size="sm" icon="more" aria-label="More" onClick={openMenu} />
                      )}
                    >
                      {(close) => (
                        <>
                          <button onClick={() => { close(); void open(f.id); }}>
                            <Icon name="pencil" /> Edit
                          </button>
                          <button
                            onClick={async () => {
                              close();
                              const copy = await api.duplicateForm(f.id);
                              await refreshForms();
                              toast(`Copied to “${copy.title}”`);
                            }}
                          >
                            <Icon name="copy" /> Make a copy
                          </button>
                          <button
                            disabled={f.responseCount === 0}
                            onClick={() => { close(); void api.openPath(f.excelPath); }}
                          >
                            <Icon name="excel" /> Open Excel file
                          </button>
                          <hr />
                          <button className="danger" onClick={() => { close(); setConfirm(f); }}>
                            <Icon name="trash" /> Delete
                          </button>
                        </>
                      )}
                    </Menu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {picking && (
        <Modal title="Which one is this form for?" onClose={() => setPicking(false)}>
          <p style={{ marginBottom: 18 }}>
            This decides the logo and the name printed at the top of the form. The
            address and phone numbers are the same either way, and you can change this
            later under Design.
          </p>
          <div className="instpick">
            {INSTITUTION_LIST.map((inst) => (
              <button key={inst.id} className="instopt" onClick={() => void create(inst.id)}>
                <img
                  src={inst.logo}
                  alt=""
                  style={{ height: 52, width: 52 * inst.aspect, objectFit: "contain" }}
                />
                <span>
                  <b>{inst.label}</b>
                  <s>{inst.name}</s>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {confirm && (
        <DeleteModal
          form={confirm}
          onClose={() => setConfirm(null)}
          onDelete={(alsoResponses) => void remove(confirm, alsoResponses)}
        />
      )}
    </>
  );
}

function DeleteModal({
  form,
  onClose,
  onDelete,
}: {
  form: FormSummary;
  onClose: () => void;
  onDelete: (alsoResponses: boolean) => void;
}) {
  const [alsoResponses, setAlso] = useState(false);
  return (
    <ConfirmModal
      title={`Delete “${form.title}”?`}
      danger
      confirmLabel="Delete form"
      onClose={onClose}
      onConfirm={() => onDelete(alsoResponses)}
      body={
        <div className="stack">
          <p>The form and its questions are removed. This cannot be undone.</p>
          {form.responseCount > 0 && (
            <label
              className="row"
              style={{ border: "1px solid var(--hair)", borderRadius: "var(--r)", padding: "12px 14px", alignItems: "flex-start", gap: 12 }}
            >
              <input
                type="checkbox"
                checked={alsoResponses}
                onChange={(e) => setAlso(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <b>Also delete the {form.responseCount} collected responses</b>
                <br />
                <span style={{ color: "var(--ink-3)", fontSize: 13 }}>
                  Leave this unticked to keep the Excel workbook on disk.
                </span>
              </span>
            </label>
          )}
        </div>
      }
    />
  );
}
