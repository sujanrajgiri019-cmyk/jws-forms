import { useEffect, useRef, useState } from "react";
import { Button, Spinner, useToast } from "../components/ui";
import { FormRenderer } from "../fill/FormRenderer";
import { buildRow } from "../lib/answers";
import { hiddenIds } from "../lib/logic";
import { formatToken } from "../lib/receipt";
import * as api from "../lib/api";
import { useApp } from "../lib/store";
import type { Answers, AnswerValue } from "../types";

export default function Fill({ id }: { id: string }) {
  const { form, openForm, go, refreshForms } = useApp();
  const toast = useToast();

  const [answers, setAnswers] = useState<Answers>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void openForm(id);
  }, [id, openForm]);

  useEffect(() => {
    setAnswers({});
    setDone(false);
    setToken("");
  }, [id]);

  if (!form || form.id !== id) {
    return (
      <div className="center-fill">
        <Spinner />
        Opening form…
      </div>
    );
  }

  const change = (qid: string, v: AnswerValue) =>
    setAnswers((a) => ({ ...a, [qid]: v }));

  const reset = () => {
    setAnswers({});
    setDone(false);
    setToken("");
    scroller.current?.scrollTo({ top: 0 });
  };

  async function submit() {
    if (!form) return;
    setSending(true);
    try {
      // Hidden answers are written as blank cells, not dropped — the column
      // has to stay where it is or the sheet changes shape mid-term.
      const { headers, values } = buildRow(form, answers, hiddenIds(form, answers));
      const count = await api.submitResponse(form.id, headers, values);
      setToken(formatToken(form.settings.receipt, count));
      setDone(true);
      void refreshForms();
      scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast(String(e), "bad");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <Button icon="back" aria-label="Back to editing" onClick={() => go({ name: "builder", id })} />
        <h1>Collecting a response</h1>
        <span className="pill">
          <span className="livedot" />
          Saves to Excel
        </span>
        <span className="grow" />
        <Button icon="pencil" onClick={() => go({ name: "builder", id })}>
          Edit form
        </Button>
      </div>

      <div className="scroll" ref={scroller}>
        <FormRenderer
          form={form}
          answers={answers}
          onChange={change}
          onSubmit={() => void submit()}
          onClear={reset}
          onAnother={reset}
          sending={sending}
          done={done}
          token={token}
        />
      </div>
    </>
  );
}
