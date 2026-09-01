import { describe, expect, it } from "vitest";
import { hiddenIds, reachedSections, sectionsOf } from "./logic";
import { markQuiz } from "./quiz";
import { buildRow, validate } from "./answers";
import { newForm, newQuestion } from "./questionTypes";
import { applyMask, maskComplete } from "./mask";
import { SUBMIT_SECTION } from "../types";
import type { FormDef, Question } from "../types";

function q(p: Partial<Question> & { id: string }): Question {
  return { ...newQuestion(p.type ?? "short_text"), ...p };
}

function form(questions: Question[], settings: Partial<FormDef["settings"]> = {}): FormDef {
  const f = newForm();
  return { ...f, questions, settings: { ...f.settings, ...settings } };
}

describe("sections", () => {
  it("treats the blocks before the first heading as their own section", () => {
    const f = form([q({ id: "a" }), q({ id: "s1", type: "section", title: "Two" }), q({ id: "b" })]);
    const secs = sectionsOf(f);
    expect(secs.map((s) => s.id)).toEqual(["", "s1"]);
    expect(secs[0].blocks.map((b) => b.id)).toEqual(["a"]);
  });

  it("drops the leading run when the form opens with a heading", () => {
    const f = form([q({ id: "s1", type: "section", title: "One" }), q({ id: "a" })]);
    expect(sectionsOf(f).map((s) => s.id)).toEqual(["s1"]);
  });
});

describe("section routing", () => {
  const routed = () =>
    form([
      q({
        id: "pick",
        type: "multiple_choice",
        title: "Applying for",
        options: [
          { id: "o1", label: "School", goTo: "sSchool" },
          { id: "o2", label: "College", goTo: "sCollege" },
        ],
      }),
      q({ id: "sSchool", type: "section", title: "School", nextSection: SUBMIT_SECTION }),
      q({ id: "schoolQ", title: "Previous school" }),
      q({ id: "sCollege", type: "section", title: "College" }),
      q({ id: "collegeQ", title: "Faculty" }),
    ]);

  it("follows the option the respondent chose", () => {
    const f = routed();
    const reached = reachedSections(f, { pick: "College" });
    expect(reached.has("sCollege")).toBe(true);
    expect(reached.has("sSchool")).toBe(false);
  });

  it("stops at a section that submits", () => {
    const f = routed();
    const reached = reachedSections(f, { pick: "School" });
    expect(reached.has("sSchool")).toBe(true);
    expect(reached.has("sCollege")).toBe(false);
  });

  it("blanks the cells of a section nobody reached, keeping the columns", () => {
    const f = routed();
    const answers = { pick: "School", schoolQ: "Shree Ganesh", collegeQ: "Management" };
    const { headers, values } = buildRow(f, answers, hiddenIds(f, answers));
    expect(headers).toEqual(["Timestamp", "Applying for", "Previous school", "Faculty"]);
    expect(values[2]).toBe("Shree Ganesh");
    // Answered earlier, then routed away from — kept in state, blank in the sheet.
    expect(values[3]).toBe("");
  });

  it("does not hang on a form that loops back on itself", () => {
    const f = form([
      q({ id: "sA", type: "section", title: "A", nextSection: "sB" }),
      q({ id: "sB", type: "section", title: "B", nextSection: "sA" }),
    ]);
    const reached = reachedSections(f, {});
    expect(reached.has("sA")).toBe(true);
    expect(reached.has("sB")).toBe(true);
  });

  it("carries on when the destination section has been deleted", () => {
    const f = form([
      q({ id: "sA", type: "section", title: "A", nextSection: "gone" }),
      q({ id: "sB", type: "section", title: "B" }),
    ]);
    expect(reachedSections(f, {}).has("sB")).toBe(true);
  });
});

describe("validation", () => {
  it("enforces a number range", () => {
    const n = q({ id: "n", type: "number", minNumber: "1", maxNumber: "12" });
    expect(validate(n, "5")).toBe("");
    expect(validate(n, "0")).toContain("1 or more");
    expect(validate(n, "13")).toContain("12 or less");
  });

  it("enforces text length", () => {
    const t = q({ id: "t", minLength: "3", maxLength: "5" });
    expect(validate(t, "abcd")).toBe("");
    expect(validate(t, "ab")).toContain("at least 3");
    expect(validate(t, "abcdef")).toContain("Keep it to 5");
  });

  it("enforces how many boxes are ticked", () => {
    const c = q({ id: "c", type: "checkboxes", countRule: "exactly", countValue: "2" });
    expect(validate(c, ["a", "b"])).toBe("");
    expect(validate(c, ["a"])).toContain("exactly 2");
  });

  it("treats a half-typed mask as unfinished, not wrong", () => {
    const p = q({ id: "p", type: "phone", mask: "9999999999" });
    expect(validate(p, "9744570500")).toBe("");
    expect(validate(p, "9744")).toContain("should look like");
  });
});

describe("masks", () => {
  it("keeps only what fits and adds the punctuation", () => {
    expect(applyMask("98ab4570500999", "9999999999")).toBe("9845705009");
    expect(applyMask("015910299", "99-9999999")).toBe("01-5910299");
    expect(maskComplete("01-591029", "99-9999999")).toBe(false);
  });
});

describe("quiz marking", () => {
  const quizForm = () =>
    form(
      [
        q({
          id: "cap",
          type: "multiple_choice",
          title: "Capital of Nepal",
          options: [
            { id: "a", label: "Kathmandu" },
            { id: "b", label: "Pokhara" },
          ],
          answerKey: ["Kathmandu"],
          points: "2",
        }),
        q({ id: "yr", type: "number", title: "Founded", answerKey: ["2050"], points: "1" }),
        q({ id: "essay", type: "paragraph", title: "Why?", points: "5" }),
      ],
      { quiz: true }
    );

  it("scores only the questions that carry a key", () => {
    const f = quizForm();
    const r = markQuiz(f, { cap: "Kathmandu", yr: "2050", essay: "because" });
    expect(r.score).toBe(3);
    expect(r.total).toBe(3); // the paragraph is never auto-marked
  });

  it("ignores capitals and stray spaces", () => {
    const f = quizForm();
    expect(markQuiz(f, { cap: "  kathmandu " }).score).toBe(2);
  });

  it("leaves a skipped question out of the total rather than marking it wrong", () => {
    const f = quizForm();
    const hidden = new Set(["yr"]);
    const r = markQuiz(f, { cap: "Kathmandu" }, hidden);
    expect(r.score).toBe(2);
    expect(r.total).toBe(2);
  });

  it("writes the score into the last two columns", () => {
    const f = quizForm();
    const { headers, values } = buildRow(f, { cap: "Kathmandu", yr: "1999" });
    expect(headers.slice(-2)).toEqual(["Score", "Out of"]);
    expect(values.slice(-2)).toEqual(["2", "3"]);
  });
});
