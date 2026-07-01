import { describe, expect, it } from "vitest";
import { buildDiagram, defaultDiagramOptions } from "../src/diagram";
import { inspectExcalidrawMarkdown } from "../src/excalidraw";
import { buildNoteContext } from "../src/markdown";

describe("diagram generation", () => {
  it("renders parseable Excalidraw Markdown", () => {
    const notes = [
      buildNoteContext({
        path: "A.md",
        content: "# A\nLinks to [[B]].",
        links: [{ raw: "[[B]]", target: "B", resolvedPath: "B.md" }],
      }),
      buildNoteContext({
        path: "B.md",
        content: "# B\nSecond note.",
      }),
    ];

    const result = buildDiagram(notes, defaultDiagramOptions("Test map", "Unit test"));
    const json = result.markdown.match(/```json\n([\s\S]*?)\n```/)?.[1];

    expect(result.markdown).toContain("# Excalidraw Data");
    expect(result.markdown).toContain("## Text Elements");
    expect(result.markdown).toContain("\n%%\n# Excalidraw Data");
    expect(result.markdown).toContain("## Text Elements\n");
    expect(result.markdown).not.toContain("\n%%\n## Drawing");
    expect(result.markdown).toContain("## Drawing");
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json ?? "{}");
    expect(parsed.elements.length).toBeGreaterThan(0);
    expect(result.relationCount).toBe(1);
  });

  it("inspects generated Excalidraw Markdown before reporting completion", () => {
    const result = buildDiagram(
      [buildNoteContext({ path: "A.md", content: "# A\nLinks to [[B]]." })],
      defaultDiagramOptions("Inspectable", "Unit test"),
    );
    const stats = inspectExcalidrawMarkdown(result.markdown);

    expect(stats.elementCount).toBeGreaterThan(0);
    expect(stats.textCount).toBe(stats.markdownTextBlockCount);
    expect(stats.arrowCount).toBeGreaterThan(0);
    expect(stats.visibleTextCharacters).toBeGreaterThan(10);
    expect(stats.maxX).toBeGreaterThan(stats.minX);
    expect(stats.maxY).toBeGreaterThan(stats.minY);
  });

  it("keeps Excalidraw text block ids compatible with Obsidian Excalidraw", () => {
    const notes = [
      buildNoteContext({
        path: "A.md",
        content: "# A\nText for note A.",
      }),
    ];

    const result = buildDiagram(notes, defaultDiagramOptions("Test map", "Unit test"));
    const json = result.markdown.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? "{}";
    const scene = JSON.parse(json);
    const textJsonIds = scene.elements
      .filter((element: { type: string }) => element.type === "text")
      .map((element: { id: string }) => element.id)
      .sort();
    const markdownBlockIds = [...result.markdown.matchAll(/\^([0-9a-z]{8})/g)]
      .map((match) => match[1])
      .sort();

    expect(textJsonIds.length).toBeGreaterThan(0);
    expect(markdownBlockIds).toEqual(textJsonIds);
    expect(textJsonIds.every((id: string) => id.length === 8)).toBe(true);
  });

  it("uses stable unique element ids", () => {
    const notes = [
      buildNoteContext({ path: "Note.md", content: "# Title\nBody" }),
    ];
    const result = buildDiagram(notes, defaultDiagramOptions("Stable", "Unit test"));
    const ids = result.scene.elements.map((element) => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 4)).toBe(true);
  });

  it("supports chalkboard and whiteboard study-note themes with local handwriting font", () => {
    const notes = [
      buildNoteContext({ path: "Note.md", content: "# 제목\n본문" }),
    ];

    const chalkboard = buildDiagram(notes, defaultDiagramOptions("Stable", "Unit test"));
    const whiteboard = buildDiagram(
      notes,
      defaultDiagramOptions("Stable", "Unit test", "whiteboard", 4),
    );

    expect(chalkboard.scene.appState.viewBackgroundColor).toBe("#123b34");
    expect(whiteboard.scene.appState.viewBackgroundColor).toBe("#ffffff");
    expect(
      chalkboard.scene.elements
        .filter((element) => element.type === "text")
        .every((element) => element.fontFamily === 4),
    ).toBe(true);
  });

  it("scales one-screen study-note typography and canvas geometry together", () => {
    const notes = [
      buildNoteContext({ path: "Note.md", content: "# 제목\n본문" }),
    ];

    const normal = buildDiagram(notes, defaultDiagramOptions("Scale", "Unit test"));
    const larger = buildDiagram(notes, defaultDiagramOptions("Scale", "Unit test", "chalkboard", 4, 1.25));

    const normalTexts = normal.scene.elements.filter((element) => element.type === "text");
    const largerTexts = larger.scene.elements.filter((element) => element.type === "text");
    const normalRects = normal.scene.elements.filter((element) => element.type === "rectangle");
    const largerRects = larger.scene.elements.filter((element) => element.type === "rectangle");

    expect(Math.min(...largerTexts.map((element) => element.fontSize))).toBeGreaterThan(
      Math.min(...normalTexts.map((element) => element.fontSize)),
    );
    expect(Math.max(...largerRects.map((element) => element.width))).toBeGreaterThan(
      Math.max(...normalRects.map((element) => element.width)),
    );
  });

  it("extracts a generic one-screen study note without fixed domain panels", () => {
    const content = [
      "# 2026-W25 유네코 경영분석 주간보고서",
      "",
      "> [!summary]",
      "> 아직 성과 판단 주간이 아니다. W26 회복 신호와 6월 월마감 대사가 결론의 전제다.",
      "",
      "> [!warning]",
      "> 검증용 참고자료. 공식 마감·성과 평가는 원장 대사 후.",
      "",
      "## 경영 지표 보드",
      "| 지표 | 이번 주 | 전주 대비 | 판단 |",
      "| --- | --- | --- | --- |",
      "| PSBall 매출액 | 77,758,995원 | -5.5% | W24보다 약하고 4주 평균보다 낮다 |",
      "| 판매량 | 1,218.0T | -7.1% | 출하 시점 차이를 확인한다 |",
      "| 운임 | 10.9% | +1.5%p | 나쁜 비용인지 단가 회수인지 확인한다 |",
      "",
      "## 기준선 적용 상태",
      "| 기준선 | 판단 기준 | 해석 |",
      "| --- | --- | --- |",
      "| 직전 4주 평균 | 4주 평균 | W23 급락 후 W24~W25는 회복 여부 확인 구간이다 |",
      "",
      "## 용도·규격·출고처",
      "| 용도 | 매출액 | 수량 | 해석 |",
      "| --- | --- | --- | --- |",
      "| 고운입 | 30백만원 | 300T | 반복 거래 확인이 필요하다 |",
      "",
      "## 고객별 전략 질문",
      "| 고객 | 이번 주 질문 |",
      "| --- | --- |",
      "| 함안 | 월마감 대사와 상계 여부를 확인한다 |",
      "",
      "## 수율감사 요약",
      "| 사업장 | 총입고량 | 판매가능 부산물 | 부산물 수율 | 판정 |",
      "| --- | --- | --- | --- | --- |",
      "| 함안 | 271.29T | 342.30T | 50.97T | 내부이동 상계 확인 |",
      "",
      "## 운영 자원 진단",
      "| 사업장 | 이번 주 해석 |",
      "| --- | --- |",
      "| 칠서 | 원료 이동 기록이 W26 회복 확인 지점이다 |",
      "",
      "## 수량·금액 확인 플래그",
      "| 플래그 | W25 판정 | 조치 |",
      "| --- | --- | --- |",
      "| 월마감 대사 | conditional_pass | 공식 원장 대사 후 확정한다 |",
      "",
      "## W21~W25 기준선 비교",
      "1. W25 약세가 출하 시점 차이인지 반복 고객 약화인지 확인한다.",
      "2. 도착도 거래에서 운임이 단가로 회수됐는지 확인한다.",
      "",
      "## 도착 조건 가격 회수 확인",
      "- 운임을 나쁜 비용으로 단정하지 말고 단가 회수 여부를 본다.",
    ].join("\n");
    const notes = [
      buildNoteContext({
        path: "21_업무노트/경영분석보고서/2026-W25.md",
        basename: "2026-W25",
        content,
      }),
    ];

    const result = buildDiagram(notes, defaultDiagramOptions("W25", "Unit test"));
    const visibleText = result.scene.elements
      .filter((element) => element.type === "text")
      .map((element) => element.text)
      .join("\n");

    expect(visibleText).toContain("잠정 결론");
    expect(visibleText).toContain("핵심 구조");
    expect(visibleText).toContain("근거 / 자료");
    expect(visibleText).toContain("아직 조심할 점");
    expect(visibleText).toContain("다음에 확인할 것");
    expect(visibleText).toContain("원문 보호 기준");
    expect(visibleText).toContain("77,758,995원");
    expect(visibleText).not.toContain("판매/수요");
    expect(visibleText).not.toContain("가격/운임");
    expect(visibleText).not.toContain("운영 회복");
    expect(visibleText).not.toContain("품질 게이트");
    expect(result.textElementCount).toBe(16);
    expect(result.relationCount).toBe(6);

    const rects = result.scene.elements.filter((element) => element.type === "rectangle");
    const texts = result.scene.elements.filter((element) => element.type === "text");
    expect(Math.min(...texts.map((element) => element.fontSize))).toBeGreaterThanOrEqual(26);
    expect(Math.max(...texts.map((element) => element.fontSize))).toBeGreaterThanOrEqual(48);
    for (const text of texts) {
      const owner = rects.find(
        (rect) =>
          text.x >= rect.x &&
          text.x <= rect.x + rect.width &&
          text.y >= rect.y &&
          text.y <= rect.y + rect.height,
      );
      expect(owner, `text without containing panel: ${text.text}`).toBeTruthy();
      expect(text.y + text.height).toBeLessThanOrEqual((owner?.y ?? 0) + (owner?.height ?? 0) - 8);
    }
  });

  it("does not leak weekly report vocabulary into an unrelated technical note", () => {
    const notes = [
      buildNoteContext({
        path: "21_업무노트/정보기술/Odysseus/05 한글화 로드맵.md",
        basename: "05 한글화 로드맵",
        content: [
          "# Odysseus 한글화 로드맵",
          "",
          "한국어 사용자가 Odysseus의 목적, 설치, 보안 주의, Codex CLI 연동, 주요 기능을 영어 문서 장벽 없이 이해하고 실행하게 한다.",
          "",
          "## 목적",
          "- 영어 문서 의존도를 줄이고 설치 전 판단을 돕는다.",
          "",
          "## 설치와 로그인",
          "- Codex CLI 설치 후 OAuth 로그인을 안내한다.",
          "- Windows 사용자는 PowerShell에서 PATH와 Node 런타임을 확인한다.",
          "",
          "## 보안 주의",
          "- API 키와 토큰은 노트에 쓰지 않는다.",
          "- 전역 Codex 설정은 변경 전 백업한다.",
          "",
          "## 다음 확인",
          "- 실제 Windows 환경에서 설치 명령과 로그인 흐름을 검증한다.",
        ].join("\n"),
      }),
    ];

    const result = buildDiagram(notes, defaultDiagramOptions("Odysseus", "Unit test", "whiteboard"));
    const visibleText = result.scene.elements
      .filter((element) => element.type === "text")
      .map((element) => element.text)
      .join("\n");

    expect(visibleText).toContain("Odysseus 한글화 로드맵");
    expect(visibleText).toContain("Codex CLI");
    expect(visibleText).toContain("OAuth");
    expect(visibleText).toContain("보안");
    expect(visibleText).toContain("Windows");
    expect(visibleText).not.toContain("W25");
    expect(visibleText).not.toContain("출하");
    expect(visibleText).not.toContain("운임");
    expect(visibleText).not.toContain("판매/수요");
    expect(visibleText).not.toContain("운영 회복");
  });
});
