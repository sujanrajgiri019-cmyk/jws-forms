import { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { Logo } from "../components/Logo";
import { Button, Spinner, useToast } from "../components/ui";
import * as api from "../lib/api";

export default function Settings() {
  const toast = useToast();
  const [dir, setDir] = useState("");
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<api.UpdateInfo | null>(null);
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    void api.dataDir().then(setDir);
  }, []);

  async function changeFolder() {
    const picked = await api.pickFolder(dir);
    if (!picked) return;
    await api.setDataDir(picked);
    setDir(await api.dataDir());
    toast("Data folder changed. Existing forms stay where they were.");
  }

  async function check() {
    setChecking(true);
    try {
      const info = await api.checkForUpdate();
      setUpdate(info);
      if (!info.available) toast("You're on the latest version");
    } catch (e) {
      toast(`Could not check for updates: ${e}`, "bad");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Settings</h1>
      </div>

      <div className="scroll">
        <div className="page narrow stack">
          <div className="card pad">
            <h3>Where responses are saved</h3>
            <p className="hint" style={{ marginTop: 4 }}>
              Each form gets its own Excel workbook inside the <b>responses</b> folder here.
            </p>
            <div className="row" style={{ marginTop: 14, gap: 10 }}>
              <div className="urlbox grow" style={{ fontSize: 13.5 }}>
                {dir || "…"}
              </div>
            </div>
            <div className="wrap-row" style={{ marginTop: 12 }}>
              <Button icon="folder" onClick={() => void api.openPath(dir)}>
                Open folder
              </Button>
              <Button variant="outline" icon="pencil" onClick={() => void changeFolder()}>
                Change folder
              </Button>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              Tip: pointing this at a OneDrive or shared-drive folder gives you an automatic
              off-site backup of every response.
            </p>
          </div>

          <div className="card pad">
            <h3>Updates</h3>
            <p className="hint" style={{ marginTop: 4 }}>
              New versions are published on GitHub and install with one click.
            </p>
            <div className="wrap-row" style={{ marginTop: 14 }}>
              <Button variant="outline" icon="refresh" onClick={() => void check()} disabled={checking}>
                {checking ? <Spinner /> : null}
                Check for updates
              </Button>
              {update?.available && pct === null && (
                <Button variant="primary" icon="download" onClick={() => { setPct(0); void api.installUpdate(setPct); }}>
                  Install {update.version} and restart
                </Button>
              )}
              {pct !== null && <span style={{ color: "var(--ink-3)" }}>Downloading… {pct}%</span>}
            </div>
            {update?.available && update.notes && (
              <div
                className="card pad"
                style={{ marginTop: 14, background: "var(--sunken)", whiteSpace: "pre-wrap", fontSize: 13.5 }}
              >
                {update.notes}
              </div>
            )}
          </div>

          <div className="card pad">
            <h3>Recovering a lost response</h3>
            <p style={{ color: "var(--ink-3)", marginTop: 6 }}>
              Every submission is also appended to a plain-text log before the workbook is
              rewritten, so nothing is lost if Excel had the file locked at the wrong moment. You
              will find it in <b>responses\.recovery</b> inside the data folder above.
            </p>
          </div>

          <div className="card pad row" style={{ gap: 16 }}>
            <Logo institution="school" height={54} />
            <div className="grow">
              <h3>JWS Forms</h3>
              <p className="hint" style={{ marginTop: 2 }}>
                Version 0.1.0 · Built for JWS · Runs entirely offline
              </p>
            </div>
            <span className="pill">
              <Icon name="sparkle" size={12} />
              Made for our school
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
