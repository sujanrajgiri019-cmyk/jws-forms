import { useEffect, useState } from "react";
import { Logo } from "./components/Logo";
import { Icon } from "./components/Icons";
import { ToastHost, Button } from "./components/ui";
import { useApp } from "./lib/store";
import * as api from "./lib/api";

import Home from "./screens/Home";
import Builder from "./screens/Builder";
import Fill from "./screens/Fill";
import Preview from "./screens/Preview";
import Responses from "./screens/Responses";
import Share from "./screens/Share";
import Print from "./screens/Print";
import Settings from "./screens/Settings";

/** One icon in the left rail, with a hover label. */
function RailBtn({
  icon,
  label,
  on,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`railbtn${on ? " on" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={on ? "page" : undefined}
    >
      <Icon name={icon} />
      <span className="tip">{label}</span>
    </button>
  );
}

function Rail() {
  const { view, go, form, closeForm } = useApp();
  const name = view.name;
  const id = form?.id;
  const inForm = !!form && ["builder", "fill", "preview", "responses", "share"].includes(name);

  return (
    <nav className="rail" aria-label="Main">
      <span className="mark">
        <Logo institution="school" height={40} plate />
      </span>

      <RailBtn
        icon="home"
        label="My forms"
        on={name === "home"}
        onClick={() => {
          closeForm();
          go({ name: "home" });
        }}
      />

      {inForm && (
        <>
          <hr />
          <RailBtn icon="pencil" label="Edit form" on={name === "builder"} onClick={() => go({ name: "builder", id: id! })} />
          <RailBtn icon="eye" label="Preview" on={name === "preview"} onClick={() => go({ name: "preview", id: id! })} />
          <RailBtn icon="play" label="Fill in on this PC" on={name === "fill"} onClick={() => go({ name: "fill", id: id! })} />
          <RailBtn icon="table" label="Responses" on={name === "responses"} onClick={() => go({ name: "responses", id: id! })} />
          <RailBtn icon="share" label="Share" on={name === "share"} onClick={() => go({ name: "share", id: id! })} />
        </>
      )}

      <span className="gap" />

      <RailBtn icon="settings" label="Settings" on={name === "settings"} onClick={() => go({ name: "settings" })} />
    </nav>
  );
}

/** Non-blocking banner offering an update when one is published on GitHub. */
function UpdateBanner() {
  const [info, setInfo] = useState<api.UpdateInfo | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!api.isDesktop) return;
    const t = setTimeout(() => {
      api.checkForUpdate().then((i) => i.available && setInfo(i)).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  if (!info || dismissed) return null;

  return (
    <div
      className="row"
      style={{
        background: "var(--o-50)",
        borderBottom: "1px solid var(--o-100)",
        padding: "10px 24px",
        gap: 14,
      }}
    >
      <Icon name="sparkle" size={18} />
      <span className="grow" style={{ fontSize: 14 }}>
        <b>Version {info.version}</b> is ready to install.
      </span>
      {pct === null ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Later
          </Button>
          <Button size="sm" variant="primary" onClick={() => { setPct(0); void api.installUpdate(setPct); }}>
            Update and restart
          </Button>
        </>
      ) : (
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Downloading… {pct}%</span>
      )}
    </div>
  );
}

export default function App() {
  const { view, refreshForms } = useApp();

  useEffect(() => {
    void refreshForms();
  }, [refreshForms]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void useApp.getState().save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <ToastHost>
      <div className="shell">
        <Rail />
        <div className="main">
          <UpdateBanner />
          {view.name === "home" && <Home />}
          {view.name === "builder" && <Builder id={view.id} />}
          {view.name === "preview" && <Preview id={view.id} />}
          {view.name === "fill" && <Fill id={view.id} />}
          {view.name === "responses" && <Responses id={view.id} />}
          {view.name === "share" && <Share id={view.id} />}
          {view.name === "print" && <Print id={view.id} />}
          {view.name === "settings" && <Settings />}
        </div>
      </div>
    </ToastHost>
  );
}
