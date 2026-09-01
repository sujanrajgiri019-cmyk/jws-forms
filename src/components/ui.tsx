import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./Icons";

/* ---------------------------------------------------------------- Button */

export function Button({
  variant = "ghost",
  size,
  icon,
  children,
  className = "",
  ...rest
}: {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "lg";
  icon?: string;
  children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const only = !children ? " icon" : "";
  return (
    <button
      {...rest}
      className={`btn ${variant}${size ? ` ${size}` : ""}${only} ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Toggle */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {label && <span className="txt">{label}</span>}
    </label>
  );
}

/* ----------------------------------------------------------------- Modal */

export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mhead">
          <h2>{title}</h2>
        </div>
        <div className="mbody">{children}</div>
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Menu */

export function Menu({
  trigger,
  children,
  align = "right",
}: {
  trigger: (open: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
    };
  }, [open]);

  return (
    <div ref={wrap} style={{ position: "relative", display: "inline-flex" }}>
      {trigger(() => setOpen((v) => !v))}
      {open && (
        <div className="menu" style={{ top: "100%", [align]: 0, marginTop: 4 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Toasts */

type Toast = { id: number; msg: string; kind: "good" | "bad" };
const ToastCtx = createContext<(msg: string, kind?: "good" | "bad") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((msg: string, kind: "good" | "bad" = "good") => {
    const id = Date.now() + Math.random();
    setItems((v) => [...v, { id, msg, kind }]);
    setTimeout(() => setItems((v) => v.filter((t) => t.id !== id)), kind === "bad" ? 7000 : 3200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => setItems((v) => v.filter((x) => x.id !== t.id))}>
            <Icon name={t.kind === "bad" ? "alert" : "checkCircle"} />
            <span style={{ whiteSpace: "pre-wrap" }}>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------ Empty state */

export function Empty({
  icon = "file",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} className="art" size={84} />
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------- small utilities */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return <span className="spin" />;
}

export function relativeTime(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}
