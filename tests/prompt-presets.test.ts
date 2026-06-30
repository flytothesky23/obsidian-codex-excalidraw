import { describe, expect, it } from "vitest";
import {
  CODEX_PROMPT_CATEGORIES,
  CODEX_PROMPT_PRESETS,
  firstPresetForCategory,
  getPromptCategory,
} from "../src/prompt-presets";

describe("Codex prompt presets", () => {
  it("groups presets into note templates, visual notes, and drawing polish", () => {
    expect(CODEX_PROMPT_CATEGORIES.map((category) => category.id)).toEqual([
      "md-template",
      "dataview-visual",
      "drawing-polish",
    ]);
    expect(CODEX_PROMPT_PRESETS.some((preset) => preset.id === "meeting-note")).toBe(true);
    expect(CODEX_PROMPT_PRESETS.some((preset) => preset.id === "dataview-dashboard")).toBe(true);
    expect(CODEX_PROMPT_PRESETS.some((preset) => preset.id === "teacher-board")).toBe(true);
  });

  it("keeps prompt text domain-neutral instead of leaking the W25 business-analysis sample", () => {
    for (const preset of CODEX_PROMPT_PRESETS) {
      expect(preset.instruction).not.toMatch(/PSBall|운임|W25 약세/);
    }
  });

  it("finds category metadata and the first preset for a selected category", () => {
    expect(getPromptCategory("dataview-visual").label).toContain("DataviewJS");
    expect(firstPresetForCategory("drawing-polish").category).toBe("drawing-polish");
  });
});
