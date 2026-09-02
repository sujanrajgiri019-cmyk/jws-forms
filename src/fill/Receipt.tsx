import { useEffect } from "react";
import { Logo } from "../components/Logo";
import { headersFor, valuesFor } from "../lib/answers";
import { ADDRESS, PHONE_LINE, institutionOf } from "../lib/brand";
import type { Answers, FormDef } from "../types";

/**
 * The acknowledgement slip.
 *
 * A counter hands this to whoever just filled the form — it is the proof they
 * came, and the number they are called by. Everything about it is built for
 * paper: fixed narrow measure, no colour that costs ink to no purpose, and a
 * print stylesheet that drops the rest of the page so Ctrl+P gives the slip
 * alone rather than the slip plus a screenful of confirmation.
 */
export function Receipt({
  form,
  answers,
  token,
  hidden,
}: {
  form: FormDef;
  answers: Answers;
  /** The queue number, already formatted. Empty when tokens are switched off. */
  token: string;
  hidden: Set<string>;
}) {
  const r = form.settings.receipt;
  const info = institutionOf(form.settings.institution);

  /**
   * The print stylesheet for the slip hides everything else on the page, so it
   * must only be live while a slip is actually on screen. Ungated, it turned
   * every other print in the app — the blank paper copy especially — into a
   * sheet of nothing.
   */
  useEffect(() => {
    document.body.classList.add("slip-on");
    return () => document.body.classList.remove("slip-on");
  }, []);

  const lines = r.fields
    .map((id) => form.questions.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => {
      const label = headersFor(q)[0] ?? q.title;
      const value = hidden.has(q.id) ? "" : valuesFor(q, answers).filter(Boolean).join(", ");
      return { id: q.id, label: q.title.trim() || label, value };
    })
    .filter((l) => l.value !== "");

  return (
    <div className="slip" id="jws-slip">
      <div className="slip-head">
        {/* The mark alone — the name is set beside it, so a lockup would
            print "Janapremi World School" twice. */}
        <Logo institution={form.settings.institution} height={38} />
        <div className="slip-org">
          <b>{info.name}</b>
          <span>{ADDRESS}</span>
          <span>{PHONE_LINE}</span>
        </div>
      </div>

      <h3 className="slip-title">{r.title.trim() || form.title || "Acknowledgement"}</h3>

      {r.showToken && token && (
        <div className="slip-token">
          <span className="lbl">Token</span>
          <b>{token}</b>
        </div>
      )}

      <dl className="slip-rows">
        <div>
          <dt>Received</dt>
          <dd>{new Date().toLocaleString()}</dd>
        </div>
        {lines.map((l) => (
          <div key={l.id}>
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
      </dl>

      {r.note.trim() && <p className="slip-note">{r.note}</p>}

      <div className="slip-foot">
        <span>{form.title || "JWS Forms"}</span>
        <span>Office copy · not a receipt of payment</span>
      </div>
    </div>
  );
}
