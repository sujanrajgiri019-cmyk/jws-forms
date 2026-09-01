import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { Button, Spinner, useToast } from "../components/ui";
import * as api from "../lib/api";
import { useApp } from "../lib/store";
import type { TunnelStatus } from "../types";

const PORT = 7788;

const OFF: TunnelStatus = {
  state: "off", publicUrl: "", localUrl: "", formId: "", formTitle: "",
  qrSvg: "", message: "", helperInstalled: false,
};

/**
 * Two ways out of this PC:
 *   Wi-Fi link  — the local server, instant, school network only.
 *   Public link — a Cloudflare quick tunnel over the top of it, so a parent at
 *                 home can open the same form.
 */
export default function Share({ id }: { id: string }) {
  const { form, openForm, go } = useApp();
  const toast = useToast();

  const [st, setSt] = useState<TunnelStatus>(OFF);
  const [busy, setBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    try {
      setSt(await api.tunnelStatus());
    } catch {
      /* the desktop backend isn't there; leave the last known state */
    }
  }, []);

  useEffect(() => {
    void openForm(id);
    void refresh();
  }, [id, openForm, refresh]);

  // While something is in flight, keep asking until it settles.
  useEffect(() => {
    const moving = st.state === "starting" || st.state === "installing";
    clearInterval(poll.current);
    if (moving) poll.current = setInterval(() => void refresh(), 1200);
    return () => clearInterval(poll.current);
  }, [st.state, refresh]);

  const liveHere = st.state === "live" && st.formId === id;
  const liveElsewhere = st.state === "live" && st.formId !== id;
  const url = st.publicUrl || st.localUrl;

  async function install() {
    setBusy(true);
    setSt((s) => ({ ...s, state: "installing", message: "Starting the download…" }));
    try {
      await api.tunnelInstall();
      await refresh();
      toast("Sharing helper installed — you can go public now");
    } catch (e) {
      toast(String(e), "bad");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function goLive() {
    setBusy(true);
    try {
      await useApp.getState().save();
      setSt(await api.tunnelStart(id, PORT));
    } catch (e) {
      toast(String(e), "bad");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      setSt(await api.tunnelStop());
      toast("Sharing stopped — the link no longer works");
    } finally {
      setBusy(false);
    }
  }

  function printQr() {
    if (!st.qrSvg) return;
    const w = window.open("", "_blank", "width=760,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><title>${form?.title ?? "JWS form"}</title>
      <style>
        @page { margin: 18mm; }
        body { font-family: "Segoe UI", system-ui, sans-serif; text-align: center; color: #191008; }
        h1 { font-size: 30px; margin: 0 0 6px; }
        p { color: #806E60; margin: 0 0 28px; }
        .qr { display: inline-block; padding: 20px; border: 3px solid #F06522; }
        .qr svg { width: 340px; height: 340px; display: block; }
        code { display: block; margin-top: 20px; font-size: 15px; color: #A83C0A; word-break: break-all; }
      </style>
      <h1>${(form?.title ?? "JWS form").replace(/</g, "&lt;")}</h1>
      <p>Scan with a phone camera to open this form</p>
      <div class="qr">${st.qrSvg}</div>
      <code>${url}</code>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <>
      <div className="topbar">
        <Button icon="back" aria-label="Back to editing" onClick={() => go({ name: "builder", id })} />
        <h1>Share this form</h1>
        {liveHere && (
          <span className="pill ok">
            <span className="livedot" />
            {st.publicUrl ? "Live on the internet" : "Live on Wi-Fi"}
          </span>
        )}
        <span className="grow" />
        {liveHere && (
          <Button variant="danger" icon="stop" onClick={() => void stop()} disabled={busy}>
            Stop sharing
          </Button>
        )}
      </div>

      <div className="scroll">
        <div className="page narrow stack">
          {liveElsewhere && (
            <div className="card pad row" style={{ gap: 12, borderLeft: "4px solid var(--o-500)" }}>
              <Icon name="alert" size={20} />
              <span className="grow">
                <b>{st.formTitle}</b> is the form currently being shared. Starting here
                will take it offline.
              </span>
            </div>
          )}

          {/* ---------------------------------------------------- live ---- */}
          {liveHere ? (
            <div className="card pad stack">
              <div className="row" style={{ gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div
                  className="qrbox"
                  dangerouslySetInnerHTML={{ __html: st.qrSvg }}
                  aria-label="QR code for this form"
                />
                <div className="grow stack" style={{ minWidth: 280 }}>
                  <div>
                    <span className="lbl" style={{ color: "var(--o-600)" }}>
                      {st.publicUrl ? "Anyone, anywhere" : "Anyone on the school Wi-Fi"}
                    </span>
                    <div className="urlbox" style={{ marginTop: 8 }}>{url}</div>
                  </div>
                  <div className="wrap-row">
                    <Button
                      variant="primary"
                      icon="clipboard"
                      onClick={() => { void navigator.clipboard.writeText(url); toast("Link copied"); }}
                    >
                      Copy link
                    </Button>
                    <Button variant="outline" icon="file" onClick={printQr}>
                      Print QR poster
                    </Button>
                    <Button icon="table" onClick={() => go({ name: "responses", id })}>
                      Watch responses
                    </Button>
                  </div>

                  {st.publicUrl && st.localUrl && (
                    <p className="hint">
                      On the school network people can also use{" "}
                      <code style={{ userSelect: "text" }}>{st.localUrl}</code>, which is faster.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ------------------------------------------------ not live ---- */
            <div className="card pad stack">
              <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
                <span
                  style={{
                    background: "var(--o-50)", color: "var(--o-600)",
                    borderRadius: "var(--r)", padding: 11, lineHeight: 0,
                  }}
                >
                  <Icon name="share" size={22} />
                </span>
                <div className="grow">
                  <h2>Put this form online</h2>
                  <p style={{ color: "var(--ink-3)", marginTop: 8 }}>
                    This PC serves the form and Cloudflare gives it a public web address, so
                    a parent at home can open it on their phone. Answers land in the same
                    Excel workbook. No account, nothing to pay.
                  </p>
                </div>
              </div>

              {st.state === "error" && st.message && (
                <p className="error">
                  <Icon name="alert" size={15} />
                  {st.message}
                </p>
              )}

              {!st.helperInstalled ? (
                <>
                  <div
                    className="card pad flat"
                    style={{ borderLeft: "4px solid var(--o-500)" }}
                  >
                    <b>One-time setup</b>
                    <p className="hint" style={{ marginTop: 6 }}>
                      Public sharing uses Cloudflare's small helper program (about 25 MB).
                      It downloads once and is reused every time after that. This PC needs
                      an internet connection for the download.
                    </p>
                  </div>
                  <div className="wrap-row">
                    <Button
                      variant="primary"
                      size="lg"
                      icon="download"
                      onClick={() => void install()}
                      disabled={busy || st.state === "installing"}
                    >
                      {st.state === "installing" ? <Spinner /> : null}
                      {st.state === "installing" ? "Downloading…" : "Download the helper"}
                    </Button>
                  </div>
                  {st.state === "installing" && st.message && (
                    <p className="hint">{st.message}</p>
                  )}
                </>
              ) : (
                <div className="wrap-row">
                  <Button
                    variant="primary"
                    size="lg"
                    icon="play"
                    onClick={() => void goLive()}
                    disabled={busy || st.state === "starting"}
                  >
                    {st.state === "starting" ? <Spinner /> : null}
                    {st.state === "starting" ? "Getting an address…" : "Go live"}
                  </Button>
                  {st.state === "starting" && (
                    <span className="hint" style={{ marginTop: 0 }}>
                      This usually takes five to ten seconds.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------- the rules ---- */}
          <div className="card pad">
            <h3>Worth knowing</h3>
            <ul style={{ color: "var(--ink-3)", margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.85 }}>
              <li>
                <b>The link lives as long as the app does.</b> Close JWS Forms, or let this
                PC sleep, and the form goes offline. Reopening gives you a{" "}
                <i>new</i> address, so send the link out fresh each time.
              </li>
              <li>
                Windows may ask to allow <b>JWS Forms</b> through the firewall the first
                time — choose <b>Private networks</b> and allow.
              </li>
              <li>
                Anyone with the link can submit. Treat it like a public web address: don't
                collect anything you wouldn't put on a noticeboard, and switch{" "}
                <b>Accepting responses</b> off in the form settings when you're done.
              </li>
              <li>
                For a permanent address that survives restarts —{" "}
                <code>forms.jws.edu.np</code> — you'd need a domain and always-on hosting.
                Say the word and that can be the next step.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
