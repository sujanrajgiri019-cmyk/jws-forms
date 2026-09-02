import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icons";
import { Button, ConfirmModal, Empty, Spinner, useToast } from "../components/ui";
import * as api from "../lib/api";
import { useApp } from "../lib/store";
import type { ResponseTable } from "../types";

export default function Responses({ id }: { id: string }) {
  const { form, openForm, go, refreshForms } = useApp();
  const toast = useToast();

  const [table, setTable] = useState<ResponseTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTable(await api.getResponses(id));
    } catch (e) {
      toast(String(e), "bad");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void openForm(id);
    void load();
  }, [id, openForm, load]);

  const rows = useMemo(() => {
    if (!table) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return table.rows;
    return table.rows.filter((r) => r.some((c) => c.toLowerCase().includes(needle)));
  }, [table, q]);

  async function clearAll() {
    await api.clearResponses(id);
    await load();
    await refreshForms();
    toast("All responses cleared");
  }

  return (
    <>
      <div className="topbar">
        <Button icon="back" aria-label="Back to editing" onClick={() => go({ name: "builder", id })} />
        <h1 className="truncate" style={{ maxWidth: 320 }}>
          {form?.title ?? "Responses"}
        </h1>
        <span className="grow" />
        {table && table.rows.length > 0 && (
          <div>
            <input
              className="input"
              style={{ width: 220 }}
              placeholder="Search responses…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
        <Button icon="refresh" onClick={() => void load()} aria-label="Refresh" />
        <Button
          variant="primary"
          icon="excel"
          disabled={!table || table.rows.length === 0}
          onClick={() =>
            table &&
            void api
              .openPath(table.path)
              .catch((e) => toast(`Could not open the workbook. ${e}`, "bad"))
          }
        >
          Open in Excel
        </Button>
      </div>

      <div className="scroll">
        <div className="page">
          {loading ? (
            <div className="center-fill" style={{ height: 260 }}>
              <Spinner />
              Reading the workbook…
            </div>
          ) : !table || table.rows.length === 0 ? (
            <Empty
              icon="table"
              title="No responses yet"
              body="Once someone fills in this form — on this PC or over the school Wi-Fi — their answers appear here and in the Excel workbook."
              action={
                <Button variant="primary" icon="play" onClick={() => go({ name: "fill", id })}>
                  Fill it in now
                </Button>
              }
            />
          ) : (
            <>
              <div className="between" style={{ marginBottom: 16 }}>
                <div className="wrap-row">
                  <span className="pill">
                    <Icon name="table" size={12} />
                    {table.rows.length} response{table.rows.length === 1 ? "" : "s"}
                  </span>
                  {q && (
                    <span className="pill grey">
                      {rows.length} matching “{q}”
                    </span>
                  )}
                </div>
                <div className="wrap-row">
                  <Button
                    size="sm"
                    icon="folder"
                    onClick={() =>
                      void api
                        .revealPath(table.path)
                        // Never fail silently: a button that does nothing at all
                        // is the hardest kind of bug for someone to report.
                        .catch((e) => toast(`Could not open the folder. ${e}`, "bad"))
                    }
                  >
                    Show folder
                  </Button>
                  <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
                    Clear all
                  </Button>
                </div>
              </div>

              <div
                className="tablewrap"
                style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}
              >
                <table className="data selectable">
                  <thead>
                    <tr>
                      <th style={{ width: 46, textAlign: "right" }}>#</th>
                      {table.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                      <th style={{ width: 44 }} aria-label="Print" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--faint)", textAlign: "right" }}>{i + 1}</td>
                        {table.headers.map((_, c) => (
                          <td key={c} style={{ whiteSpace: "pre-wrap" }}>
                            {r[c] ?? ""}
                          </td>
                        ))}
                        <td style={{ textAlign: "right" }}>
                          {/* The row index here is the index in the *unfiltered*
                              table, so printing works while a search is active. */}
                          <Button
                            size="sm"
                            icon="file"
                            aria-label={`Print response ${i + 1}`}
                            title="Print this response"
                            onClick={() =>
                              go({ name: "print", id, row: table.rows.indexOf(r) })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="hint" style={{ marginTop: 14 }} title={table.path}>
                <Icon name="file" size={13} /> {table.path}
              </p>
            </>
          )}
        </div>
      </div>

      {confirmClear && (
        <ConfirmModal
          title="Clear all responses?"
          danger
          confirmLabel="Delete responses"
          onClose={() => setConfirmClear(false)}
          onConfirm={() => void clearAll()}
          body={
            <p>
              The Excel workbook for this form will be deleted and response collection starts from
              zero. The form itself is kept. This cannot be undone.
            </p>
          }
        />
      )}
    </>
  );
}
