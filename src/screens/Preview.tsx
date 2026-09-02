import { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { Button, Spinner } from "../components/ui";
import { FormRenderer } from "../fill/FormRenderer";
import { useApp } from "../lib/store";
import type { Answers, AnswerValue, FormStyle } from "../types";

const STYLE_NAMES: Record<FormStyle, string> = {
  register: "Register",
  panel: "Panel",
  focus: "Focus",
  letterhead: "Letterhead",
  cards: "Cards",
  cover: "Cover",
  split: "Split screen",
  arena: "Arena",
  prospectus: "Prospectus",
  terminal: "Terminal",
  community: "Community",
  editorial: "Editorial",
  aurora: "Aurora",
  ticket: "Ticket",
  atelier: "Atelier",
};

/**
 * Exactly what a respondent sees — same renderer, same styles — at either
 * desktop or phone width. Nothing here can write to the workbook: the submit
 * button is deliberately inert.
 */
export default function Preview({ id }: { id: string }) {
  const { form, openForm, go, patchSettings } = useApp();
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    void openForm(id);
  }, [id, openForm]);

  useEffect(() => setAnswers({}), [id]);

  if (!form || form.id !== id) {
    return (
      <div className="center-fill">
        <Spinner />
        Opening preview…
      </div>
    );
  }

  const change = (qid: string, v: AnswerValue) =>
    setAnswers((a) => ({ ...a, [qid]: v }));

  const rendered = (
    <FormRenderer
      form={form}
      answers={answers}
      onChange={change}
      onSubmit={() => {}}
      preview
    />
  );

  return (
    <>
      <div className="topbar">
        <Button icon="back" aria-label="Back to editing" onClick={() => go({ name: "builder", id })} />
        <h1>Preview</h1>
        <span className="pill grey">Nothing is saved</span>
        <span className="grow" />

        <div className="row" style={{ gap: 6 }}>
          {(Object.keys(STYLE_NAMES) as FormStyle[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={form.settings.style === s ? "primary" : "ghost"}
              onClick={() => patchSettings({ style: s })}
            >
              {STYLE_NAMES[s]}
            </Button>
          ))}
        </div>

        <span style={{ width: 1, height: 24, background: "var(--hair)" }} />

        <Button
          size="sm"
          variant={width === "desktop" ? "outline" : "ghost"}
          icon="table"
          aria-label="Desktop width"
          onClick={() => setWidth("desktop")}
        />
        <Button
          size="sm"
          variant={width === "phone" ? "outline" : "ghost"}
          icon="phone"
          aria-label="Phone width"
          onClick={() => setWidth("phone")}
        />
      </div>

      <div className="previewbar">
        <Icon name="eye" size={16} />
        <span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
          Showing the <b>{STYLE_NAMES[form.settings.style]}</b> style at{" "}
          {width === "phone" ? "phone" : "laptop"} width. Switch style above — the
          change is saved to the form.
        </span>
      </div>

      <div className="scroll">
        <div className="devicewrap">
          {width === "phone" ? (
            <div className="device phone">
              <div className="screen" style={{ height: 720, overflowY: "auto" }}>
                {rendered}
              </div>
            </div>
          ) : (
            <div className="device" style={{ minHeight: 620 }}>
              {rendered}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
