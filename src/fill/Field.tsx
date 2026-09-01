import { useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { shuffled } from "../lib/answers";
import { humanSize, pictureFromClipboard, pictureFromDrop, readPicture } from "../lib/image";
import type { AnswerValue, FormStyle, Question } from "../types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The respondent-facing control for one question.
 *
 * The same markup serves all three form styles — `form-styles.css` restyles
 * it — with one exception: Focus puts a letter key inside the choice marker so
 * the form can be answered from the keyboard, and Panel hides the marker
 * entirely because its choices are chips.
 */
export function Field({
  q,
  value,
  onChange,
  style,
  autoFocus,
}: {
  q: Question;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  style: FormStyle;
  autoFocus?: boolean;
}) {
  const str = typeof value === "string" ? value : "";

  switch (q.type) {
    case "paragraph":
      return (
        <textarea
          className="fs-textarea"
          value={str}
          placeholder={q.placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "short_text":
    case "number":
    case "email":
    case "phone":
    case "date":
    case "time": {
      const type =
        q.type === "number" ? "number"
        : q.type === "email" ? "email"
        : q.type === "phone" ? "tel"
        : q.type === "date" ? "date"
        : q.type === "time" ? "time"
        : "text";
      const narrow = q.type === "date" || q.type === "time";
      return (
        <input
          className={`fs-input${narrow ? " fs-narrow" : ""}`}
          type={type}
          value={str}
          placeholder={q.placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    case "dropdown":
      return (
        <select
          className="fs-select"
          value={str}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {shuffled(q.options, q.shuffle, q.id).map((o) => (
            <option key={o.id} value={o.label}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case "multiple_choice":
    case "checkboxes":
      return <Choices q={q} value={value} onChange={onChange} style={style} />;

    case "linear_scale": {
      const nums: number[] = [];
      for (let i = q.scale.min; i <= q.scale.max; i++) nums.push(i);
      return (
        <div>
          <div className="fs-scale">
            {nums.map((n) => (
              <label key={n} className={str === String(n) ? "on" : undefined}>
                {n}
                <input
                  type="radio"
                  name={q.id}
                  checked={str === String(n)}
                  onChange={() => onChange(String(n))}
                />
              </label>
            ))}
          </div>
          {(q.scale.minLabel || q.scale.maxLabel) && (
            <div className="fs-ends">
              <span>{q.scale.minLabel}</span>
              <span>{q.scale.maxLabel}</span>
            </div>
          )}
        </div>
      );
    }

    case "rating": {
      const n = Number(str) || 0;
      return (
        <div className="fs-stars">
          {Array.from({ length: q.ratingMax }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`fs-star${i < n ? " on" : ""}`}
              aria-label={`${i + 1} of ${q.ratingMax}`}
              onClick={() => onChange(i + 1 === n ? "" : String(i + 1))}
            >
              <Icon name="star" fill />
            </button>
          ))}
        </div>
      );
    }

    case "grid_choice":
    case "grid_checkbox":
      return <Grid q={q} value={value} onChange={onChange} />;

    case "photo":
      return <PhotoField value={str} onChange={onChange} />;

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ choices */

function Choices({
  q,
  value,
  onChange,
  style,
}: {
  q: Question;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  style: FormStyle;
}) {
  const multi = q.type === "checkboxes";
  const chosen: string[] = multi
    ? ((value as string[]) ?? [])
    : typeof value === "string" && value
    ? [value]
    : [];

  const opts = shuffled(q.options, q.shuffle, q.id);
  const known = new Set(q.options.map((o) => o.label));
  const otherText = chosen.find((c) => !known.has(c)) ?? "";
  const otherOn = otherText !== "";

  function pick(label: string, on: boolean) {
    if (!multi) {
      onChange(on ? label : "");
      return;
    }
    const set = new Set(chosen);
    if (on) set.add(label);
    else set.delete(label);
    onChange([...set]);
  }

  function setOther(text: string) {
    const rest = chosen.filter((c) => known.has(c));
    const label = text.trim() === "" ? "" : text;
    if (!multi) {
      onChange(label);
      return;
    }
    onChange(label ? [...rest, label] : rest);
  }

  const marker = (i: number, on: boolean) => {
    if (style === "panel") return null;
    if (style === "focus")
      return <span className="fs-mark">{LETTERS[i] ?? "•"}</span>;
    return <span className="fs-mark" aria-hidden="true" />;
    void on;
  };

  return (
    <div className="fs-choices" role={multi ? "group" : "radiogroup"}>
      {opts.map((o, i) => {
        const on = chosen.includes(o.label);
        return (
          <button
            key={o.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            className={`fs-choice${on ? " on" : ""}`}
            onClick={() => pick(o.label, !on)}
          >
            {marker(i, on)}
            <span className="fs-choice-txt">{o.label}</span>
          </button>
        );
      })}

      {q.hasOther && (
        <div
          className={`fs-choice other-chip${otherOn ? " on" : ""}`}
          onClick={(e) => {
            // Clicking the row (but not the text box) toggles "Other".
            if ((e.target as HTMLElement).tagName !== "INPUT" && !otherOn) setOther("Other");
          }}
        >
          {marker(opts.length, otherOn)}
          <span className="fs-other">
            Other:
            <input
              type="text"
              value={otherText}
              placeholder="Your answer"
              aria-label="Other answer"
              onChange={(e) => setOther(e.target.value)}
            />
          </span>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- grid */

function Grid({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const multi = q.type === "grid_checkbox";

  if (multi) {
    const m = ((value as Record<string, string[]>) ?? {}) as Record<string, string[]>;
    return (
      <div className="fs-gridwrap">
        <table className="fs-grid">
          <thead>
            <tr>
              <th />
              {q.columns.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                {q.columns.map((c) => (
                  <td key={c.id}>
                    <input
                      type="checkbox"
                      aria-label={`${r.label} — ${c.label}`}
                      checked={(m[r.id] ?? []).includes(c.label)}
                      onChange={(e) => {
                        const set = new Set(m[r.id] ?? []);
                        if (e.target.checked) set.add(c.label);
                        else set.delete(c.label);
                        onChange({ ...m, [r.id]: [...set] });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const m = ((value as Record<string, string>) ?? {}) as Record<string, string>;
  return (
    <div className="fs-gridwrap">
      <table className="fs-grid">
        <thead>
          <tr>
            <th />
            {q.columns.map((c) => (
              <th key={c.id}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {q.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.label}</td>
              {q.columns.map((c) => (
                <td key={c.id}>
                  <input
                    type="radio"
                    name={`${q.id}-${r.id}`}
                    aria-label={`${r.label} — ${c.label}`}
                    checked={m[r.id] === c.label}
                    onChange={() => onChange({ ...m, [r.id]: c.label })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* --------------------------------------------------------------- photo */

/**
 * A respondent's photo upload.
 *
 * On a phone this opens the camera directly, which is the whole point for
 * admission forms — a parent photographs the birth certificate on the spot.
 * The picture is held as a data URL while the form is being filled; the Rust
 * side writes it out as a real file beside the workbook on submit.
 */
function PhotoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: AnswerValue) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function take(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const pic = await readPicture(file);
      onChange(pic.dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That picture could not be added.");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="fs-shot">
        <img src={value} alt="The photo you attached" />
        <div className="meta">
          Attached · about {humanSize(value.length)}
          <br />
          <button type="button" onClick={() => onChange("")}>
            Remove and choose another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`fs-drop${over ? " over" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onPaste={(e) => {
          const f = pictureFromClipboard(e.nativeEvent as ClipboardEvent);
          if (f) {
            e.preventDefault();
            void take(f);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(pictureFromDrop(e));
        }}
      >
        <Icon name="camera" size={26} />
        <b>{busy ? "Adding…" : "Take a photo or choose a file"}</b>
        <s>Tap to open the camera, or drag a picture here</s>
      </div>
      {err && <p className="fs-err">{err}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void take(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}
