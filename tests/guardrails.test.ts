import { describe, expect, it } from "vitest";
import { isAdviceRequest, isDeliveryOnly, splitSentences, validateLine } from "../lib/guardrails";

describe("advice request screening", () => {
  it.each([
    "What should I say to the judge?",
    "Will I win this case?",
    "Is my case strong?",
    "how should I answer that",
    "Can you give me legal advice",
    "Should I tell them the boiler was dangerous to win?",
  ])("flags %s", (t) => expect(isAdviceRequest(t)).toBe(true));

  it.each(["I moved out on 12 March.", "The landlord kept my deposit.", "I do not remember the exact date."])(
    "allows %s",
    (t) => expect(isAdviceRequest(t)).toBe(false),
  );
});

describe("output validation", () => {
  it("accepts a neutral factual question", () => {
    expect(validateLine("Could you tell the court when that happened?").ok).toBe(true);
  });
  it("trims to two sentences", () => {
    const v = validateLine("Thank you. Where were you? What did you see? Who else was there?");
    expect(v.ok).toBe(true);
    expect(splitSentences(v.line).length).toBeLessThanOrEqual(2);
  });
  it.each([
    "You should mention the photographs.",
    "I would advise you to bring the receipt.",
    "That sounds like a strong case.",
    "The law says you are entitled to a refund.",
    "Under section 21 you can do this.",
    "You will win this one.",
    "You are lying about the date.",
  ])("rejects %s", (line) => expect(validateLine(line).ok).toBe(false));
  it("rejects empty output", () => expect(validateLine("   ").ok).toBe(false));
  it("strips speaker labels and markdown", () => {
    expect(validateLine("**Judge:** Could you continue?").line).toBe("Could you continue?");
  });
});

describe("feedback filter", () => {
  it("allows delivery-only tips", () => expect(isDeliveryOnly("Pause briefly before you answer.")).toBe(true));
  it("blocks merits language", () => expect(isDeliveryOnly("Your evidence is strong and you will win.")).toBe(false));
});
