import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { Letterhead } from "../components/Logo";
import { institutionOf } from "../lib/brand";
import { isDisplayBlock, validate } from "../lib/answers";
import { useFormLogic } from "../lib/useFormLogic";
import { colorwayClass } from "../lib/colorway";
import { Field } from "./Field";
import { Receipt } from "./Receipt";
import type { Answers, AnswerValue, FormDef, Question } from "../types";

/**
 * Renders a form in whichever of the three styles it is set to.
 *
 * Register and Panel show the whole form at once. Focus walks one question at
 * a time and validates as it goes, so this component owns the error state and
 * the step cursor; the screen around it only supplies answers and a submit.
 */
export function FormRenderer({
  form,
  answers,
  onChange,
  onSubmit,
  onClear,
  onAnother,
  sending = false,
  done = false,
  preview = false,
  token = "",
}: {
  form: FormDef;
  answers: Answers;
  onChange: (id: string, v: AnswerValue) => void;
  onSubmit: () => void;
  onClear?: () => void;
  onAnother?: () => void;
  sending?: boolean;
  done?: boolean;
  preview?: boolean;
  /** Queue number for the printable slip, from the submission. */
  token?: string;
}) {
  const style = form.settings.style;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  // Conditional logic. Everything downstream — numbering, progress, validation,
  // the submitted row — reads from this rather than from form.questions.
  const logic = useFormLogic(form, answers);
  const answerable = logic.answerable;

  // Focus mode walks every visible block, sections included — a section becomes
  // its own "here comes the next part" screen. Hidden blocks are skipped, so a
  // branch nobody took never costs a keystroke.
  const pages = logic.visible;
  useEffect(() => {
    setStep(0);
    setErrors({});
  }, [form.id, style]);

  const change = useCallback(
    (id: string, v: AnswerValue) => {
      onChange(id, v);
      setErrors((e) => {
        if (!e[id]) return e;
        const n = { ...e };
        delete n[id];
        return n;
      });
    },
    [onChange]
  );

  function submitAll() {
    const errs = logic.validateAll();
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = form.questions.find((q) => errs[q.id]);
      root.current
        ?.querySelector(`[data-q="${first?.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit();
  }

  function advance() {
    const q = pages[step];
    if (q && !isDisplayBlock(q.type)) {
      const m = validate(q, answers[q.id]);
      if (m) {
        setErrors({ [q.id]: m });
        return;
      }
    }
    if (step < pages.length - 1) setStep(step + 1);
    else submitAll();
  }

  const pct = Math.round(logic.progress * 100);
  const closed = !form.settings.acceptingResponses;
  const cls = [
    "fs",
    `fs-${style}`,
    colorwayClass(form.settings),
    form.settings.kiosk ? "fs-kiosk" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* ------------------------------------------------------------ done state */

  if (done) {
    const slip = form.settings.receipt.enabled;
    const body = (
      <div className="fs-done">
        <span className="tick">
          <Icon name="checkCircle" size={60} />
        </span>
        <h2 className="dsp">Response recorded</h2>
        <p>{form.settings.confirmationMessage}</p>

        {slip && (
          <>
            <Receipt form={form} answers={answers} token={token} hidden={logic.hidden} />
            <div className="fs-slipacts">
              <button className="fs-submit" onClick={() => window.print()}>
                <Icon name="file" size={17} /> Print / Save as PDF
              </button>
              {form.settings.allowMultiple && onAnother && (
                <button className="fs-clear" onClick={onAnother}>
                  Next person
                </button>
              )}
            </div>
          </>
        )}

        {!slip && form.settings.allowMultiple && onAnother && (
          <button className="fs-submit" onClick={onAnother} style={{ marginTop: 14 }}>
            Submit another response
          </button>
        )}
      </div>
    );
    return (
      <div className={cls} ref={root}>
        {(style === "panel" || style === "split") && (
          <PanelSide form={form} answers={answers} pct={100} logicHidden={logic.hidden} />
        )}
        <div className="fs-main">{body}</div>
      </div>
    );
  }

  /* ------------------------------------------------------------ 03 — FOCUS */

  if (style === "focus") {
    return (
      <FocusFlow
        form={form}
        pages={pages}
        numberOf={logic.numberOf}
        total={answerable.length}
        answers={answers}
        onChange={change}
        errors={errors}
        step={step}
        setStep={setStep}
        advance={advance}
        sending={sending}
        preview={preview}
        closed={closed}
        pct={pct}
        cls={cls}
      />
    );
  }

  /* ------------------------------------------- 01 — REGISTER / 02 — PANEL */

  return (
    <div className={cls} ref={root}>
      {(style === "panel" || style === "split") && (
        <PanelSide form={form} answers={answers} pct={pct} logicHidden={logic.hidden} />
      )}

      <div className="fs-main">
        {style !== "panel" && style !== "split" && (
          <header className="fs-head">
            <div className="fs-brand">
              {/* Cover sets the letterhead on orange, so the artwork needs a
                  white plate behind it and light text beside it. */}
              <Letterhead
                institution={form.settings.institution}
                height={style === "cover" ? 58 : 68}
                plate={style === "cover"}
                onDark={style === "cover"}
              />
            </div>
            <h1 className="dsp">{form.title || "Untitled form"}</h1>
            {form.description && <p className="fs-desc">{form.description}</p>}
            {answerable.some((q) => q.required) && (
              <p className="fs-headnote">
                <span className="fs-req">*</span> Required
              </p>
            )}
          </header>
        )}

        {closed && (
          <div style={{ padding: style === "panel" ? "0 0 8px" : "24px 0 0" }}>
            <div className="fs-closed">
              <Icon name="alert" size={19} />
              <span>
                This form is closed and is not accepting responses at the moment.
              </span>
            </div>
          </div>
        )}

        <div className="fs-flow">
          {logic.visible.map((q) => {
            if (q.type === "section") {
              return (
                <section className="fs-section" key={q.id}>
                  <h2 className="dsp">{q.title || "Section"}</h2>
                  {q.description && <p className="fs-help">{q.description}</p>}
                </section>
              );
            }
            if (q.type === "image") return <PictureBlock q={q} key={q.id} />;
            return (
              <QuestionBlock
                key={q.id}
                q={q}
                index={logic.numberOf(q.id)}
                value={answers[q.id]}
                error={errors[q.id]}
                onChange={(v) => change(q.id, v)}
                style={style}
              />
            );
          })}
        </div>

        <footer className="fs-foot">
          <button className="fs-submit" onClick={submitAll} disabled={sending || closed || preview}>
            {sending ? <span className="spin" /> : <Icon name="check" size={18} />}
            {preview ? "Submit (disabled in preview)" : sending ? "Saving…" : "Submit"}
          </button>
          {onClear && !preview && (
            <button className="fs-clear" onClick={onClear} disabled={sending}>
              Clear form
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- picture block */

/** A picture the form shows. It asks nothing, so it owns no Excel column. */
function PictureBlock({ q }: { q: Question }) {
  if (!q.image) return null;
  return (
    <figure className={`fs-figure ${q.imageWidth || "medium"}`}>
      <img src={q.image} alt={q.imageCaption || q.title || ""} />
      {q.imageCaption && <figcaption className="fs-figcap">{q.imageCaption}</figcaption>}
    </figure>
  );
}

/* ------------------------------------------------------------ shared block */

function QuestionBlock({
  q,
  index,
  value,
  error,
  onChange,
  style,
}: {
  q: Question;
  index: number;
  value: AnswerValue;
  error?: string;
  onChange: (v: AnswerValue) => void;
  style: FormDef["settings"]["style"];
}) {
  return (
    <section className={`fs-q${error ? " invalid" : ""}`} data-q={q.id}>
      <div className="fs-n">{String(index).padStart(2, "0")}</div>
      <div className="fs-qbody">
        <h3 className="fs-qtitle">
          {q.title || "Untitled question"}
          {q.required && <span className="fs-req">*</span>}
        </h3>
        {q.description && <p className="fs-help">{q.description}</p>}
        <div className="fs-field">
          <Field q={q} value={value} onChange={onChange} style={style} />
        </div>
        {error && (
          <p className="fs-err">
            <Icon name="alert" size={15} />
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- 02 — panel wall */

function PanelSide({
  form,
  answers,
  pct,
  logicHidden,
}: {
  form: FormDef;
  answers: Answers;
  pct: number;
  logicHidden: Set<string>;
}) {
  // Split the form at its section headings so the wall can show real progress
  // through real parts, not invented steps.
  const groups = useMemo(() => {
    const out: { title: string; qs: Question[] }[] = [];
    let cur: { title: string; qs: Question[] } = { title: "Questions", qs: [] };
    for (const q of form.questions) {
      if (logicHidden.has(q.id)) continue;
      if (q.type === "section") {
        if (cur.qs.length) out.push(cur);
        cur = { title: q.title || "Section", qs: [] };
      } else if (q.type !== "image") cur.qs.push(q);
    }
    if (cur.qs.length) out.push(cur);
    return out;
  }, [form.questions, logicHidden]);

  const answeredIn = (qs: Question[]) =>
    qs.filter((q) => {
      const v = answers[q.id];
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === "object") return Object.keys(v).length > 0;
      return v !== undefined && String(v ?? "").trim() !== "";
    }).length;

  const firstUnfinished = groups.findIndex((g) => answeredIn(g.qs) < g.qs.length);

  return (
    <aside className="fs-side">
      <Letterhead institution={form.settings.institution} height={56} plate onDark />
      <h1 className="dsp" style={{ marginTop: 26 }}>{form.title || "Untitled form"}</h1>
      {form.description && <p className="fs-desc">{form.description}</p>}

      {groups.length > 1 && (
        <div className="fs-steps">
          {groups.map((g, i) => {
            const a = answeredIn(g.qs);
            const state =
              a === g.qs.length ? "done" : i === firstUnfinished ? "now" : "pending";
            return (
              <div className={`fs-step ${state}`} key={g.title + i}>
                <span className="fs-stepdot" />
                <span>
                  <b>{g.title}</b>
                  <s>
                    {state === "done"
                      ? "Complete"
                      : `${a} of ${g.qs.length} answered`}
                  </s>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="fs-prog">
        <span className="lbl">Progress · {pct}%</span>
        <div className="fs-track">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </aside>
  );
}

/* --------------------------------------------------------- 03 — focus flow */

function FocusFlow({
  form,
  pages,
  numberOf,
  total,
  answers,
  onChange,
  errors,
  step,
  setStep,
  advance,
  sending,
  preview,
  closed,
  pct,
  cls,
}: {
  form: FormDef;
  /** Visible blocks only — a hidden branch never becomes a screen. */
  pages: Question[];
  numberOf: (id: string) => number;
  total: number;
  answers: Answers;
  onChange: (id: string, v: AnswerValue) => void;
  errors: Record<string, string>;
  step: number;
  setStep: (n: number) => void;
  advance: () => void;
  sending: boolean;
  preview: boolean;
  closed: boolean;
  pct: number;
  cls: string;
}) {
  const q = pages[Math.min(step, Math.max(pages.length - 1, 0))];
  const last = step >= pages.length - 1;

  // Keyboard: Enter moves on, a letter picks that option.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing =
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

      if (e.key === "Enter" && !(typing && el.tagName === "TEXTAREA")) {
        e.preventDefault();
        advance();
        return;
      }
      if (typing || !q || e.ctrlKey || e.metaKey || e.altKey) return;
      if (q.type !== "multiple_choice" && q.type !== "checkboxes") return;

      const i = "abcdefghijklmnopqrstuvwxyz".indexOf(e.key.toLowerCase());
      const opt = q.options[i];
      if (!opt) return;
      e.preventDefault();
      if (q.type === "checkboxes") {
        const cur = new Set((answers[q.id] as string[]) ?? []);
        if (cur.has(opt.label)) cur.delete(opt.label);
        else cur.add(opt.label);
        onChange(q.id, [...cur]);
      } else {
        onChange(q.id, opt.label);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, answers, onChange, advance]);

  if (!q) return null;

  return (
    <div className={cls}>
      <div className="fs-watermark">
        <img src={institutionOf(form.settings.institution).logo} alt="" />
      </div>

      <div className="fs-topbar">
        <i style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>

      <div className="fs-crumb">
        <span className="l">
          <Letterhead institution={form.settings.institution} height={34} compact />
        </span>
        <span className="lbl">{form.title || "Untitled form"}</span>
      </div>

      <div className="fs-main">
        {closed && (
          <div style={{ padding: "24px 28px 0", maxWidth: 620, margin: "0 auto", width: "100%" }}>
            <div className="fs-closed">
              <Icon name="alert" size={19} />
              <span>This form is closed and is not accepting responses at the moment.</span>
            </div>
          </div>
        )}

        <div className="fs-flow">
          {q.type === "section" ? (
            <section className="fs-section" key={q.id}>
              <h2 className="dsp">{q.title || "Next section"}</h2>
              {q.description && <p className="fs-help">{q.description}</p>}
            </section>
          ) : q.type === "image" ? (
            <section className="fs-section" key={q.id}>
              {q.title && <h2 className="dsp">{q.title}</h2>}
              <PictureBlock q={q} />
            </section>
          ) : (
            <section className="fs-q" key={q.id} data-q={q.id}>
              <div className="fs-n">
                Question {numberOf(q.id)} of {total}
              </div>
              <h3 className="fs-qtitle">
                {q.title || "Untitled question"}
                {q.required && <span className="fs-req">*</span>}
              </h3>
              {q.description && <p className="fs-help">{q.description}</p>}
              <div className="fs-field">
                <Field
                  q={q}
                  value={answers[q.id]}
                  onChange={(v) => onChange(q.id, v)}
                  style="focus"
                  autoFocus={
                    q.type === "short_text" ||
                    q.type === "paragraph" ||
                    q.type === "email" ||
                    q.type === "number" ||
                    q.type === "phone"
                  }
                />
              </div>
              {errors[q.id] && (
                <p className="fs-err">
                  <Icon name="alert" size={15} />
                  {errors[q.id]}
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="fs-nav">
        <div className="inner">
          <button className="fs-back" onClick={() => setStep(step - 1)} disabled={step === 0}>
            ← Back
          </button>
          <button
            className={last ? "fs-submit" : "fs-next"}
            onClick={advance}
            disabled={sending || (last && (closed || preview))}
          >
            {sending ? "Saving…" : last ? (preview ? "Submit (disabled in preview)" : "Submit") : "Next"}
          </button>
          <span className="fs-kbd">
            or press <kbd>Enter</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
