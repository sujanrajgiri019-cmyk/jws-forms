import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { Button, Menu, Toggle, useToast } from "../components/ui";
import { TYPES, TYPE_GROUPS, TYPE_MAP, isDisplay } from "../lib/questionTypes";
import { humanSize, pictureFromClipboard, pictureFromDrop, readPicture } from "../lib/image";
import {
  OPERATORS_NEEDING_VALUE,
  OPERATOR_LABEL,
  candidateSources,
  describeConditions,
} from "../lib/logic";
import { MASK_PRESETS, maskExample, presetFor } from "../lib/mask";
import { useApp } from "../lib/store";
import { OptionList } from "./OptionList";
import type { ConditionRule, Question, QuestionConditions, QuestionType } from "../types";

export function QuestionCard({ q, index }: { q: Question; index: number }) {
  const { form, selected, select, patchQuestion, changeType, removeQuestion, duplicateQuestion } =
    useApp();
  const isSel = selected === q.id;
  const meta = TYPE_MAP[q.type];
  const [panel, setPanel] = useState<"none" | "logic" | "checks">("none");
  const ruleCount = q.conditions?.rules.length ?? 0;
  const hasChecks = !!(q.mask || q.pattern);

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
                placeholder={
                  q.type === "image"
                    ? "Caption above the picture (optional)"
                    : `Question ${index + 1}`
                }
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

          {/* A rule is worth seeing at a glance even when the card is closed —
              a question that vanishes for no visible reason is confusing. */}
          {ruleCount > 0 && panel !== "logic" && (
            <button
              className="rulechip"
              onClick={(e) => {
                e.stopPropagation();
                select(q.id);
                setPanel("logic");
              }}
            >
              <Icon name="sparkle" size={13} />
              {form ? describeConditions(form, q) : "Conditional"}
            </button>
          )}

          {isSel && panel === "logic" && <LogicPanel q={q} />}
          {isSel && panel === "checks" && (
            <div className="logicbox">
              <ValidationPanel q={q} patch={patch} />
            </div>
          )}
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
          {!isDisplay(q.type) && (
            <>
              <span className="sep" />
              <Toggle
                checked={q.required}
                onChange={(v) => patch({ required: v })}
                label="Required"
              />
              <Button
                size="sm"
                icon="sparkle"
                variant={panel === "logic" ? "primary" : undefined}
                onClick={() => setPanel(panel === "logic" ? "none" : "logic")}
              >
                Logic{ruleCount ? ` (${ruleCount})` : ""}
              </Button>
              {TYPE_MAP[q.type].hasPlaceholder && (
                <Button
                  size="sm"
                  icon="check"
                  variant={panel === "checks" ? "primary" : undefined}
                  onClick={() => setPanel(panel === "checks" ? "none" : "checks")}
                >
                  Format{hasChecks ? " ·" : ""}
                </Button>
              )}
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

  if (q.type === "image") return <PictureEditor q={q} isSel={isSel} patch={patch} />;
  if (q.type === "photo") return <PhotoPreview />;

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

/* ------------------------------------------------------------- pictures */

/**
 * The editor for a picture block.
 *
 * Three ways in, because people reach for different ones: press Ctrl+V with
 * something on the clipboard, drag a file onto the card, or click and browse.
 * Whichever is used, `readPicture` downscales it before it is kept, so a form
 * file never balloons because someone dropped in a camera photo.
 */
function PictureEditor({
  q,
  isSel,
  patch,
}: {
  q: Question;
  isSel: boolean;
  patch: (p: Partial<Question>) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function take(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const pic = await readPicture(file);
      patch({ image: pic.dataUrl });
    } catch (e) {
      toast(e instanceof Error ? e.message : "That picture could not be added.");
    } finally {
      setBusy(false);
    }
  }

  if (q.image) {
    return (
      <div
        className="picwrap"
        onPaste={(e) => {
          const f = pictureFromClipboard(e.nativeEvent as ClipboardEvent);
          if (f) {
            e.preventDefault();
            void take(f);
          }
        }}
        tabIndex={isSel ? 0 : -1}
      >
        <figure className={`picshow ${q.imageWidth}`}>
          <img src={q.image} alt={q.imageCaption || q.title || "Picture"} />
        </figure>

        {isSel && (
          <div className="stack" style={{ marginTop: 12 }}>
            <div className="wrap-row">
              <label className="label" style={{ margin: 0 }}>
                Size
              </label>
              <div className="seg">
                {(["small", "medium", "full"] as const).map((w) => (
                  <button
                    key={w}
                    className={q.imageWidth === w ? "on" : ""}
                    onClick={() => patch({ imageWidth: w })}
                  >
                    {w === "small" ? "Small" : w === "medium" ? "Medium" : "Full width"}
                  </button>
                ))}
              </div>
              <span className="grow" />
              <Button size="sm" icon="upload" onClick={() => input.current?.click()}>
                Replace
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon="trash"
                onClick={() => patch({ image: "", imageCaption: "" })}
              >
                Remove
              </Button>
            </div>
            <div>
              <label className="label">Caption under the picture</label>
              <input
                className="input"
                placeholder="Optional — e.g. Route map to the school gate"
                value={q.imageCaption}
                onChange={(e) => patch({ imageCaption: e.target.value })}
              />
            </div>
            <p className="hint">
              About {humanSize(q.image.length)}. Large pictures are shrunk automatically so
              the form stays quick to open on a phone.
            </p>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void take(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={`picdrop${over ? " over" : ""}`}
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
        <Icon name="image" size={30} />
        <b>{busy ? "Adding the picture…" : "Add a picture"}</b>
        <s>
          Click to browse, drag a file here, or click this box and press{" "}
          <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste one
        </s>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void take(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** What a respondent will see for a photo-upload question. */
function PhotoPreview() {
  return (
    <div className="picdrop still">
      <Icon name="camera" size={28} />
      <b>The person filling the form uploads a photo here</b>
      <s>Saved beside the Excel file, with the file name written into the sheet</s>
    </div>
  );
}

/* ---------------------------------------------------------------- logic */

/**
 * The rule builder.
 *
 * Only questions *above* this one can be referenced. That constraint is what
 * keeps the logic understandable: rules read top to bottom, the same direction
 * the form is filled in, and a circular pair is impossible by construction.
 */
export function LogicPanel({ q }: { q: Question }) {
  const { form, patchQuestion } = useApp();
  if (!form) return null;

  const sources = candidateSources(form, q.id);
  const c = q.conditions;

  function setConditions(next: QuestionConditions | undefined) {
    patchQuestion(q.id, { conditions: next });
  }

  function addRule() {
    const first = sources[0];
    if (!first) return;
    const rule: ConditionRule = {
      fieldId: first.id,
      operator: "equals",
      value: first.options[0]?.label ?? "",
    };
    setConditions({
      action: c?.action ?? "show",
      match: c?.match ?? "all",
      rules: [...(c?.rules ?? []), rule],
    });
  }

  function patchRule(i: number, p: Partial<ConditionRule>) {
    if (!c) return;
    const rules = c.rules.map((r, n) => (n === i ? { ...r, ...p } : r));
    setConditions({ ...c, rules });
  }

  function removeRule(i: number) {
    if (!c) return;
    const rules = c.rules.filter((_, n) => n !== i);
    setConditions(rules.length ? { ...c, rules } : undefined);
  }

  if (!sources.length) {
    return (
      <div className="logicbox">
        <p className="hint" style={{ margin: 0 }}>
          Rules compare this question against an <b>earlier</b> one, so the first
          question on a form can't have any. Move this one further down, or add a
          question above it.
        </p>
      </div>
    );
  }

  return (
    <div className="logicbox">
      {!c || !c.rules.length ? (
        <div className="between">
          <p className="hint" style={{ margin: 0 }}>
            Always shown. Add a rule to show or hide it depending on an earlier
            answer.
          </p>
          <Button size="sm" icon="plus" onClick={addRule}>
            Add a rule
          </Button>
        </div>
      ) : (
        <>
          <div className="wrap-row" style={{ marginBottom: 12 }}>
            <select
              className="select"
              style={{ width: 92 }}
              value={c.action}
              onChange={(e) => setConditions({ ...c, action: e.target.value as "show" | "hide" })}
            >
              <option value="show">Show</option>
              <option value="hide">Hide</option>
            </select>
            <span style={{ color: "var(--ink-3)", fontSize: 14 }}>this question when</span>
            <select
              className="select"
              style={{ width: 108 }}
              value={c.match}
              onChange={(e) => setConditions({ ...c, match: e.target.value as "all" | "any" })}
            >
              <option value="all">all rules</option>
              <option value="any">any rule</option>
            </select>
            <span style={{ color: "var(--ink-3)", fontSize: 14 }}>match:</span>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {c.rules.map((r, i) => {
              const src = form.questions.find((x) => x.id === r.fieldId);
              const needsValue = OPERATORS_NEEDING_VALUE.includes(r.operator);
              const choices = src?.options ?? [];
              return (
                <div className="rulerow" key={i}>
                  <select
                    className="select"
                    value={r.fieldId}
                    onChange={(e) => patchRule(i, { fieldId: e.target.value, value: "" })}
                  >
                    {sources.map((s, n) => (
                      <option key={s.id} value={s.id}>
                        {n + 1}. {s.title.trim() || "Untitled question"}
                      </option>
                    ))}
                    {!sources.some((s) => s.id === r.fieldId) && (
                      <option value={r.fieldId}>(deleted question)</option>
                    )}
                  </select>

                  <select
                    className="select"
                    value={r.operator}
                    onChange={(e) =>
                      patchRule(i, { operator: e.target.value as ConditionRule["operator"] })
                    }
                  >
                    {(Object.keys(OPERATOR_LABEL) as (keyof typeof OPERATOR_LABEL)[]).map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABEL[op]}
                      </option>
                    ))}
                  </select>

                  {needsValue ? (
                    choices.length ? (
                      <select
                        className="select"
                        value={typeof r.value === "string" ? r.value : r.value[0] ?? ""}
                        onChange={(e) => patchRule(i, { value: e.target.value })}
                      >
                        <option value="">Choose an option…</option>
                        {choices.map((o) => (
                          <option key={o.id} value={o.label}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input"
                        placeholder="Value"
                        value={typeof r.value === "string" ? r.value : r.value.join(", ")}
                        onChange={(e) => patchRule(i, { value: e.target.value })}
                      />
                    )
                  ) : (
                    <span className="rulespacer" />
                  )}

                  <Button
                    size="sm"
                    icon="x"
                    aria-label="Remove this rule"
                    onClick={() => removeRule(i)}
                  />
                </div>
              );
            })}
          </div>

          <div className="between" style={{ marginTop: 12 }}>
            <p className="hint" style={{ margin: 0 }}>{describeConditions(form, q)}</p>
            <div className="wrap-row">
              <Button size="sm" icon="plus" onClick={addRule}>
                Add a rule
              </Button>
              <Button size="sm" variant="danger" icon="trash" onClick={() => setConditions(undefined)}>
                Clear
              </Button>
            </div>
          </div>

          <p className="hint" style={{ marginTop: 10 }}>
            A hidden question keeps whatever was typed into it — change the answer
            back and it returns filled in. Its Excel column is always written, blank
            when the question was skipped, so the sheet keeps one shape.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- masks & patterns */

export function ValidationPanel({
  q,
  patch,
}: {
  q: Question;
  patch: (p: Partial<Question>) => void;
}) {
  const preset = presetFor(q.mask);
  const custom = !!q.mask && !preset;
  const [showCustom, setShowCustom] = useState(custom);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <label className="label">Typing format</label>
        <div className="wrap-row">
          <select
            className="select"
            style={{ maxWidth: 220 }}
            value={showCustom ? "custom" : preset?.id ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id === "custom") {
                setShowCustom(true);
                return;
              }
              setShowCustom(false);
              patch({ mask: MASK_PRESETS.find((p) => p.id === id)?.mask ?? "" });
            }}
          >
            {MASK_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {showCustom && (
            <input
              className="input"
              style={{ maxWidth: 190 }}
              placeholder="e.g. AAA-9999"
              value={q.mask}
              onChange={(e) => patch({ mask: e.target.value })}
            />
          )}
          {q.mask && (
            <span className="pill">
              Looks like {maskExample(q.mask)}
            </span>
          )}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          <b>9</b> is a digit, <b>A</b> a letter, <b>*</b> either. Anything else is
          punctuation the form types in as they go.
        </p>
      </div>

      <div>
        <label className="label">Extra check (optional)</label>
        <input
          className="input"
          placeholder="A pattern, e.g.  ^9[78][0-9]{8}$"
          value={q.pattern}
          onChange={(e) => patch({ pattern: e.target.value })}
        />
        <input
          className="input"
          style={{ marginTop: 8 }}
          placeholder="What to say when it fails — e.g. Mobile numbers start 97 or 98"
          value={q.patternMessage}
          onChange={(e) => patch({ patternMessage: e.target.value })}
        />
        <p className="hint" style={{ marginTop: 8 }}>
          Runs after the built-in check. A pattern the app can't read is ignored
          rather than blocking anyone.
        </p>
      </div>
    </div>
  );
}
