import { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { Letterhead } from "../components/Logo";
import { Button } from "../components/ui";
import { isDisplayBlock, isUpload } from "../lib/answers";
import { styleToCss } from "../lib/richtext";
import { useApp } from "../lib/store";
import type { Question } from "../types";

/**
 * A paper copy of the form.
 *
 * Schools still collect on paper: at a gate, in a hall with no Wi-Fi, from a
 * parent who would rather write than tap. The rule this screen follows is that
 * the paper must ask exactly what the screen asks, in the same order — so what
 * comes back on paper drops straight into the same Excel columns.
 *
 * Conditional questions are all printed, with their rule noted underneath. On
 * screen a branch hides them; on paper the person needs to see the instruction
 * and skip past it themselves.
 */
export default function Print({ id }: { id: string }) {
  const { form, openForm, go } = useApp();
  const [mono, setMono] = useState(false);

  useEffect(() => {
    void openForm(id);
  }, [id, openForm]);

  if (!form || form.id !== id) return <div className="center-fill">Opening form…</div>;

  let n = 0;

  return (
    <>
      <div className="topbar noprint">
        <Button icon="back" aria-label="Back to editing" onClick={() => go({ name: "builder", id })} />
        <h1>Printable copy</h1>
        <span className="grow" />
        <div className="seg">
          <button className={mono ? "" : "on"} onClick={() => setMono(false)}>
            Colour
          </button>
          <button className={mono ? "on" : ""} onClick={() => setMono(true)}>
            Black &amp; white
          </button>
        </div>
        <Button variant="primary" icon="file" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <div className="scroll">
        <div className="page">
          <p className="hint noprint" style={{ marginBottom: 14 }}>
            Set your printer to A4. Choose “Save as PDF” in the same dialog if you
            want a file rather than paper. Black &amp; white drops every colour, which
            prints faster and costs less on a school printer.
          </p>

          <div className={`paper${mono ? " mono" : ""}`} id="jws-paper">
            <header className="paper-head">
              {form.settings.banner && !mono && (
                <div className={`bannerprev ${form.settings.bannerHeight || "medium"}`}>
                  <img src={form.settings.banner} alt="" />
                </div>
              )}
              <Letterhead institution={form.settings.institution} height={52} />
              <h1 style={styleToCss(form.settings.titleStyle)}>
                {form.title || "Untitled form"}
              </h1>
              {form.description && (
                <p className="paper-desc" style={styleToCss(form.settings.descriptionStyle)}>
                  {form.description}
                </p>
              )}
              <div className="paper-meta">
                <span>Date: ______________________</span>
                <span>Received by: ______________________</span>
              </div>
            </header>

            {form.questions.map((q) => {
              if (q.type === "section") {
                return (
                  <section className="paper-sec" key={q.id}>
                    <h2>{q.title || "Section"}</h2>
                    {q.description && <p>{q.description}</p>}
                  </section>
                );
              }
              if (q.type === "image") {
                return q.image ? (
                  <figure className="paper-fig" key={q.id}>
                    <img src={q.image} alt="" />
                    {q.imageCaption && <figcaption>{q.imageCaption}</figcaption>}
                  </figure>
                ) : null;
              }
              n += 1;
              return <PaperQuestion q={q} index={n} key={q.id} />;
            })}

            <footer className="paper-foot">
              <span>{form.title || "JWS Forms"}</span>
              <span>Signature: ______________________</span>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}

function PaperQuestion({ q, index }: { q: Question; index: number }) {
  return (
    <section className="paper-q">
      <div className="paper-n">{String(index).padStart(2, "0")}</div>
      <div>
        <h3 style={styleToCss(q.titleStyle)}>
          {q.title || "Untitled question"}
          {q.required && <span className="paper-req">*</span>}
        </h3>
        {q.description && (
          <p className="paper-help" style={styleToCss(q.helpStyle)}>
            {q.description}
          </p>
        )}
        {q.conditions?.rules.length ? (
          <p className="paper-note">
            <Icon name="alert" size={12} /> Only answer this if it applies to you.
          </p>
        ) : null}
        <PaperAnswer q={q} />
      </div>
    </section>
  );
}

/** The space to write in — shaped like the question rather than a generic box. */
function PaperAnswer({ q }: { q: Question }) {
  switch (q.type) {
    case "paragraph":
      return (
        <div className="paper-lines">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} />
          ))}
        </div>
      );

    case "multiple_choice":
    case "checkboxes":
      return (
        <ul className="paper-opts">
          {q.options.map((o) => (
            <li key={o.id}>
              <span className={q.type === "checkboxes" ? "box" : "circle"} />
              {o.label || "…"}
            </li>
          ))}
          {q.hasOther && (
            <li>
              <span className={q.type === "checkboxes" ? "box" : "circle"} />
              Other: ______________________
            </li>
          )}
        </ul>
      );

    case "dropdown":
      return (
        <p className="paper-inline">
          Circle one: {q.options.map((o) => o.label).join("   ·   ") || "…"}
        </p>
      );

    case "linear_scale": {
      const nums: number[] = [];
      for (let i = q.scale.min; i <= q.scale.max; i++) nums.push(i);
      return (
        <div className="paper-scale">
          {nums.map((x) => (
            <span key={x}>
              <i />
              {x}
            </span>
          ))}
        </div>
      );
    }

    case "rating":
      return (
        <div className="paper-scale">
          {Array.from({ length: q.ratingMax }, (_, i) => (
            <span key={i}>
              <i />
              {i + 1}
            </span>
          ))}
        </div>
      );

    case "grid_choice":
    case "grid_checkbox":
      return (
        <div className="tablewrap">
          <table className="paper-grid">
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
                      <span className={q.type === "grid_checkbox" ? "box" : "circle"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      if (isUpload(q.type)) {
        return <p className="paper-inline">Attach the document to this sheet.</p>;
      }
      if (isDisplayBlock(q.type)) return null;
      return <div className="paper-lines one"><span /></div>;
  }
}
