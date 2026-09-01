import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../components/Icons";
import { Button, Menu, Toggle } from "../components/ui";
import { TYPES, TYPE_GROUPS, TYPE_MAP } from "../lib/questionTypes";
import { useApp } from "../lib/store";
import { OptionList } from "./OptionList";
import type { Question, QuestionType } from "../types";

export function QuestionCard({ q, index }: { q: Question; index: number }) {
  const { selected, select, patchQuestion, changeType, removeQuestion, duplicateQuestion } =
    useApp();
  const isSel = selected === q.id;
  const meta = TYPE_MAP[q.type];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
  });

  const patch = (p: Partial<Question>) => patchQuestion(q.id, p);

  return (
    <div
      ref={setNodeRef}
      className={`qcard ${isSel ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 5 : undefined,
      }}
      onMouseDown={() => !isSel && select(q.id)}
    >
      <span
        className="drag"
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        aria-label={`Reorder question ${index + 1}`}
      >
        <Icon name="drag" size={17} />
      </span>

      {q.type === "section" ? (
        <div style={{ paddingTop: 6 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="pill grey">Section</span>
          </div>
          <input
            className="bare h2"
            value={q.title}
            placeholder="Section heading"
            onChange={(e) => patch({ title: e.target.value })}
          />
          <input
            className="bare muted"
            value={q.description}
            placeholder="Description (optional)"
            onChange={(e) => patch({ description: e.target.value })}
            style={{ marginTop: 6 }}
          />
        </div>
      ) : (
        <>
          <div
            className="row"
            style={{ alignItems: "flex-start", gap: 16, paddingTop: 6 }}
          >
            <div className="grow">
              <input
                className="bare h2"
                value={q.title}
                placeholder={`Question ${index + 1}`}
                onChange={(e) => patch({ title: e.target.value })}
              />
              {(isSel || q.description) && (
                <input
                  className="bare muted"
                  value={q.description}
                  placeholder="Help text (optional)"
                  onChange={(e) => patch({ description: e.target.value })}
                  style={{ marginTop: 4 }}
                />
              )}
            </div>

            {isSel && (
              <TypePicker value={q.type} onChange={(t) => changeType(q.id, t)} />
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <Body q={q} isSel={isSel} patch={patch} />
          </div>
        </>
      )}

      {isSel && (
        <div className="qfoot">
          <Button size="sm" icon="copy" onClick={() => duplicateQuestion(q.id)}>
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon="trash"
            onClick={() => removeQuestion(q.id)}
          >
            Delete
          </Button>
          {q.type !== "section" && (
            <>
              <span className="sep" />
              <Toggle
                checked={q.required}
                onChange={(v) => patch({ required: v })}
                label="Required"
              />
              <Menu
                trigger={(open) => <Button size="sm" icon="more" onClick={open} aria-label="More options" />}
              >
                {() => (
                  <>
                    {meta.hasOptions && (
                      <>
                        <button onClick={() => patch({ hasOther: !q.hasOther })}>
                          <Icon name={q.hasOther ? "check" : "plus"} />
                          {q.hasOther ? "Remove “Other”" : "Add an “Other” option"}
                        </button>
                        <button onClick={() => patch({ shuffle: !q.shuffle })}>
                          <Icon name={q.shuffle ? "check" : "refresh"} />
                          Shuffle option order
                        </button>
                        <hr />
                      </>
                    )}
                    <button onClick={() => patch({ description: q.description || " " })}>
                      <Icon name="text" /> Show help text
                    </button>
                  </>
                )}
              </Menu>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ type picker */

function TypePicker({
  value,
  onChange,
}: {
  value: QuestionType;
  onChange: (t: QuestionType) => void;
}) {
  const meta = TYPE_MAP[value];
  return (
    <Menu
      trigger={(open) => (
        <button className="btn outline sm" onClick={open} style={{ minWidth: 186, justifyContent: "flex-start" }}>
          {meta.icon}
          <span className="grow truncate" style={{ textAlign: "left" }}>
            {meta.label}
          </span>
          <Icon name="chevronDown" size={15} />
        </button>
      )}
    >
      {(close) => (
        <div style={{ maxHeight: 380, overflowY: "auto", minWidth: 218 }}>
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
                    onChange(t.type);
                    close();
                  }}
                  style={t.type === value ? { background: "var(--o-50)", color: "var(--o-700)" } : undefined}
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
  );
}

/* ------------------------------------------------------------------ body */

function Body({
  q,
  isSel,
  patch,
}: {
  q: Question;
  isSel: boolean;
  patch: (p: Partial<Question>) => void;
}) {
  const meta = TYPE_MAP[q.type];

  if (meta.hasOptions) {
    if (!isSel) return <OptionsPreview q={q} />;
    return (
      <>
        <OptionList
          items={q.options}
          onChange={(options) => patch({ options })}
          marker={
            q.type === "checkboxes" ? "checkbox" : q.type === "dropdown" ? "number" : "radio"
          }
          addLabel="Option"
          namePrefix={q.id}
        />
        {q.hasOther && (
          <div className="optrow" style={{ paddingLeft: 26, color: "var(--ink-3)" }}>
            {q.type === "checkboxes" ? (
              <input type="checkbox" disabled readOnly />
            ) : (
              <input type="radio" disabled readOnly />
            )}
            <span style={{ fontSize: 14 }}>Other…</span>
            <Button size="sm" icon="x" aria-label="Remove other" onClick={() => patch({ hasOther: false })} />
          </div>
        )}
      </>
    );
  }

  if (meta.hasGrid) {
    if (!isSel) return <GridPreview q={q} />;
    return (
      <div className="row" style={{ alignItems: "flex-start", gap: 26 }}>
        <div className="grow">
          <label className="label">Rows</label>
          <OptionList
            items={q.rows}
            onChange={(rows) => patch({ rows })}
            marker="number"
            addLabel="Row"
            namePrefix={`${q.id}-r`}
          />
        </div>
        <div className="grow">
          <label className="label">Columns</label>
          <OptionList
            items={q.columns}
            onChange={(columns) => patch({ columns })}
            marker={q.type === "grid_checkbox" ? "checkbox" : "radio"}
            addLabel="Column"
            namePrefix={`${q.id}-c`}
          />
        </div>
      </div>
    );
  }

  if (meta.hasScale) {
    if (!isSel) return <ScalePreview q={q} />;
    return (
      <div className="stack">
        <div className="wrap-row">
          <select
            className="select"
            style={{ width: 78 }}
            value={q.scale.min}
            onChange={(e) => patch({ scale: { ...q.scale, min: Number(e.target.value) } })}
          >
            {[0, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span style={{ color: "var(--ink-3)" }}>to</span>
          <select
            className="select"
            style={{ width: 78 }}
            value={q.scale.max}
            onChange={(e) => patch({ scale: { ...q.scale, max: Number(e.target.value) } })}
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ width: 26, color: "var(--ink-3)" }}>{q.scale.min}</span>
          <input
            className="input grow"
            placeholder="Label (optional) — e.g. Poor"
            value={q.scale.minLabel}
            onChange={(e) => patch({ scale: { ...q.scale, minLabel: e.target.value } })}
          />
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ width: 26, color: "var(--ink-3)" }}>{q.scale.max}</span>
          <input
            className="input grow"
            placeholder="Label (optional) — e.g. Excellent"
            value={q.scale.maxLabel}
            onChange={(e) => patch({ scale: { ...q.scale, maxLabel: e.target.value } })}
          />
        </div>
      </div>
    );
  }

  if (meta.hasRating) {
    if (!isSel) return <ScalePreview q={q} />;
    return (
      <div className="wrap-row">
        <label className="label" style={{ margin: 0 }}>
          Stars
        </label>
        <select
          className="select"
          style={{ width: 84 }}
          value={q.ratingMax}
          onChange={(e) => patch({ ratingMax: Number(e.target.value) })}
        >
          {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="stars" style={{ marginLeft: 8 }}>
          {Array.from({ length: q.ratingMax }, (_, i) => (
            <span key={i} className="star on" style={{ cursor: "default" }}>
              <Icon name="star" fill />
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Plain inputs: show the control the respondent will see, disabled.
  const type =
    q.type === "date" ? "date" : q.type === "time" ? "time" : q.type === "number" ? "number" : "text";

  return (
    <div className="stack">
      {q.type === "paragraph" ? (
        <textarea
          className="input"
          disabled
          placeholder={q.placeholder || "Long answer text"}
          style={{ minHeight: 70 }}
        />
      ) : (
        <input
          className="input"
          disabled
          type={type}
          placeholder={q.placeholder || defaultPlaceholder(q.type)}
          style={{ maxWidth: q.type === "date" || q.type === "time" ? 200 : 420 }}
        />
      )}
      {isSel && TYPE_MAP[q.type].hasPlaceholder && (
        <div style={{ maxWidth: 420 }}>
          <label className="label">Grey hint text inside the box</label>
          <input
            className="input"
            placeholder="Optional — e.g. Asha Shrestha"
            value={q.placeholder}
            onChange={(e) => patch({ placeholder: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function defaultPlaceholder(t: QuestionType) {
  switch (t) {
    case "email":
      return "name@example.com";
    case "phone":
      return "98XXXXXXXX";
    case "number":
      return "0";
    default:
      return "Short answer text";
  }
}

/* -------------------------------------------------------------- previews */

function OptionsPreview({ q }: { q: Question }) {
  const opts = q.hasOther ? [...q.options, { id: "__o", label: "Other…" }] : q.options;
  if (q.type === "dropdown") {
    return (
      <select className="select" disabled style={{ maxWidth: 320 }}>
        <option>{opts[0]?.label ?? "Choose…"}</option>
      </select>
    );
  }
  return (
    <div>
      {opts.slice(0, 6).map((o) => (
        <div key={o.id} className="opt" style={{ cursor: "default", padding: "6px 0" }}>
          <input type={q.type === "checkboxes" ? "checkbox" : "radio"} disabled readOnly />
          <span className="txt" style={{ color: o.label ? undefined : "var(--faint)" }}>
            {o.label || "Empty option"}
          </span>
        </div>
      ))}
      {opts.length > 6 && (
        <p className="hint" style={{ marginLeft: 28 }}>+ {opts.length - 6} more</p>
      )}
    </div>
  );
}

function GridPreview({ q }: { q: Question }) {
  return (
    <div className="tablewrap">
      <table className="data grid">
        <thead>
          <tr>
            <th />
            {q.columns.map((c) => (
              <th key={c.id}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {q.rows.slice(0, 4).map((r) => (
            <tr key={r.id}>
              <td>{r.label}</td>
              {q.columns.map((c) => (
                <td key={c.id}>
                  <input
                    type={q.type === "grid_checkbox" ? "checkbox" : "radio"}
                    disabled
                    readOnly
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

function ScalePreview({ q }: { q: Question }) {
  if (q.type === "rating") {
    return (
      <div className="stars">
        {Array.from({ length: q.ratingMax }, (_, i) => (
          <span key={i} className="star" style={{ cursor: "default" }}>
            <Icon name="star" fill />
          </span>
        ))}
      </div>
    );
  }
  const nums: number[] = [];
  for (let i = q.scale.min; i <= q.scale.max; i++) nums.push(i);
  return (
    <div>
      <div className="scalerow">
        {nums.map((n) => (
          <label key={n}>
            {n}
            <input type="radio" disabled readOnly />
          </label>
        ))}
      </div>
      {(q.scale.minLabel || q.scale.maxLabel) && (
        <div className="scale-ends">
          <span>{q.scale.minLabel}</span>
          <span>{q.scale.maxLabel}</span>
        </div>
      )}
    </div>
  );
}
