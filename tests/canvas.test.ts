import { describe, expect, it } from "vitest";
import { assertReadableCanvas, buildCanvas, parseAndValidateCanvas } from "../src/canvas";
import { buildCanvasBrief } from "../src/canvas-brief";
import { buildNoteContext } from "../src/markdown";

describe("Obsidian JSON Canvas generation", () => {
  it("creates valid Obsidian Canvas JSON with file and concept nodes", () => {
    const result = buildCanvas(
      [
        buildNoteContext({
          path: "Reports/W25.md",
          content: [
            "# W25",
            "## Executive Brief",
            "- 매출 77,758,995원. 전주 대비 약세.",
            "- 검증용 참고자료. 공식 마감 대사 후 판단.",
            "- W26 회복 신호를 확인한다.",
          ].join("\n"),
        }),
      ],
      "W25 Canvas",
    );
    const parsed = parseAndValidateCanvas(result.json);

    expect(parsed.nodes.some((node) => node.type === "file" && node.file === "Reports/W25.md")).toBe(true);
    expect(parsed.nodes.some((node) => node.type === "text" && node.text.includes("논리 뼈대"))).toBe(true);
    expect(parsed.nodes.some((node) => node.type === "group")).toBe(true);
    expect(result.edgeCount).toBeGreaterThan(0);
  });

  it("keeps canvas ids unique and edge references resolvable", () => {
    const result = buildCanvas(
      [
        buildNoteContext({ path: "A.md", content: "# A\nLinks to [[B]]." }),
        buildNoteContext({ path: "B.md", content: "# B\nSecond note." }),
      ],
      "Two-note Canvas",
    );
    const parsed = parseAndValidateCanvas(result.json);
    const nodeIds = new Set(parsed.nodes.map((node) => node.id));
    const allIds = [...parsed.nodes.map((node) => node.id), ...parsed.edges.map((edge) => edge.id)];

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(parsed.edges.every((edge) => nodeIds.has(edge.fromNode) && nodeIds.has(edge.toNode))).toBe(true);
  });

  it("builds a multi-note canvas with readable synthesis instead of file-only placeholders", () => {
    const result = buildCanvas(
      [
        buildNoteContext({
          path: "Reports/W25.md",
          content: [
            "# W25",
            "- PSBall 매출 77,758,995원, 판매량 1,218.09T.",
            "- 검증용 자료라 공식 마감 대사 후 판단한다.",
            "- W26 회복 신호 확인 필요.",
          ].join("\n"),
        }),
        buildNoteContext({
          path: "Reports/W24.md",
          content: [
            "# W24",
            "- 직전 기준선과 전주 대비를 비교한다.",
            "- 고객군별 재주문 여부를 확인한다.",
          ].join("\n"),
        }),
      ],
      "W25 Multi Canvas",
    );
    const parsed = parseAndValidateCanvas(result.json);
    const stats = assertReadableCanvas(parsed);

    expect(stats.textNodeCount).toBeGreaterThanOrEqual(4);
    expect(parsed.nodes.some((node) => node.type === "text" && node.text.includes("잠정 판단"))).toBe(true);
    expect(parsed.nodes.some((node) => node.type === "text" && node.text.includes("다음에 확인할 것"))).toBe(true);
    expect(parsed.nodes.filter((node) => node.type === "file")).toHaveLength(2);
  });

  it("briefs Codex to edit Canvas JSON instead of Excalidraw", () => {
    const brief = buildCanvasBrief(
      [buildNoteContext({ path: "Reports/W25.md", content: "# W25\n본문" })],
      "Excalidraw/Codex Maps/W25.canvas",
    );

    expect(brief).toContain("Target canvas");
    expect(brief).toContain("valid JSON Canvas");
    expect(brief).toContain("Do not create Excalidraw Markdown");
    expect(brief).toContain("Do not create a second `.canvas` file anywhere else");
    expect(brief).toContain("Reports/W25.md");
  });
});
