import { describe, expect, it } from "vitest";
import { buildCodexBrief } from "../src/codex-brief";
import { buildNoteContext } from "../src/markdown";

describe("Codex drawing brief", () => {
  it("requires source reading instead of fixed-panel generation", () => {
    const brief = buildCodexBrief(
      [
        buildNoteContext({
          path: "Reports/W25.md",
          content: "# W25\n## Executive Brief\n- Revenue changed because of mix.",
        }),
      ],
      "Excalidraw/Codex Maps/W25.excalidraw.md",
    );

    expect(brief).toContain("Read these Markdown files from disk before editing");
    expect(brief).toContain("Do not use a fixed number of panels");
    expect(brief).toContain("single simplest visual form");
    expect(brief).toContain("Reports/W25.md");
  });

  it("keeps Codex drawings within a study-note complexity budget", () => {
    const brief = buildCodexBrief(
      [
        buildNoteContext({
          path: "Reports/W25.md",
          content: "# W25\n| metric | value |\n|---|---|\n| Revenue | 77m |",
        }),
      ],
      "Excalidraw/Codex Maps/W25.excalidraw.md",
    );

    expect(brief).toContain("Maximum 10 content boxes");
    expect(brief).toContain("Maximum 7 arrows");
    expect(brief).toContain("Target 650-950 visible Korean characters");
    expect(brief).toContain("If your diagram is harder to read than the Markdown note, simplify");
  });
});
