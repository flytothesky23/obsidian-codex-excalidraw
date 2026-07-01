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

  it("injects current visual settings into Codex CLI drawing briefs", () => {
    const brief = buildCodexBrief(
      [
        buildNoteContext({
          path: "Reports/W25.md",
          content: "# W25\n본문",
        }),
      ],
      "Excalidraw/Codex Maps/W25.excalidraw.md",
      {
        visualTheme: "whiteboard",
        handwritingFontFamily: 4,
        studyNoteFontScale: 1.25,
      },
    );

    expect(brief).toContain("clean whiteboard");
    expect(brief).toContain("Minimum readable text size 33");
    expect(brief).toContain("fontFamily 4");
  });

  it("uses a separate architecture/SVG-system contract for SVG-style diagrams", () => {
    const brief = buildCodexBrief(
      [
        buildNoteContext({
          path: "21_업무노트/정보기술/Odysseus/05 한글화 로드맵.md",
          content: "# Odysseus 한글화 로드맵\nCodex CLI, OAuth, GitHub, Windows 설치 흐름을 설명한다.",
        }),
      ],
      "Codex Maps/Odysseus SVG식 도식.excalidraw.md",
      { diagramMode: "svg-system", visualTheme: "whiteboard" },
    );

    expect(brief).toContain("Architecture / SVG-System Diagram Mode");
    expect(brief).toContain("Asset pass");
    expect(brief).toContain("editable vector glyph vocabulary");
    expect(brief).toContain("1-3 lanes or zones");
    expect(brief).toContain("Verification pass");
    expect(brief).toContain("Title must be top-left anchored");
    expect(brief).not.toContain("graduate-level teacher");
    expect(brief).not.toContain("single simplest visual form");
  });
});
