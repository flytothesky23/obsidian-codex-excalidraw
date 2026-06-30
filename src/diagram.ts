import { arrow, createScene, rectangle, renderExcalidrawMarkdown, stableId, textElement } from "./excalidraw";
import { truncate } from "./markdown";
import type { DiagramBuildResult, DiagramOptions, ExcalidrawElement, NoteContext } from "./types";

const CARD_WIDTH = 430;
const CARD_HEIGHT = 250;
const CARD_GAP_X = 120;
const CARD_GAP_Y = 80;
const CARD_COLUMNS = 2;

const PALETTE = {
  ink: "#111827",
  slate: "#334155",
  muted: "#64748b",
  line: "#94a3b8",
  paper: "#ffffff",
  panel: "#f8fafc",
};

const STUDY_THEMES = {
  chalkboard: {
    background: "#123b34",
    panel: "#17463e",
    ink: "#f8fafc",
    muted: "#d9eadf",
    blue: "#a5d8ff",
    yellow: "#ffe08a",
    green: "#b2f2bb",
    red: "#ffc9c9",
    line: "#d9eadf",
  },
  whiteboard: {
    background: "#ffffff",
    panel: "#ffffff",
    ink: "#111827",
    muted: "#475569",
    blue: "#2563eb",
    yellow: "#b45309",
    green: "#047857",
    red: "#b91c1c",
    line: "#64748b",
  },
} satisfies Record<DiagramOptions["visualTheme"], {
  background: string;
  panel: string;
  ink: string;
  muted: string;
  blue: string;
  yellow: string;
  green: string;
  red: string;
  line: string;
}>;

type StudyTheme = (typeof STUDY_THEMES)[DiagramOptions["visualTheme"]];
type Anchor = { x: number; y: number; width: number; height: number };

interface GenericNoteAnalysis {
  title: string;
  question: string;
  thesis: string;
  structure: string[];
  evidence: string[];
  uncertainty: string[];
  process: string[];
  nextChecks: string[];
  sourceGuard: string[];
}

export function buildDiagram(notes: NoteContext[], options: DiagramOptions): DiagramBuildResult {
  const sortedNotes = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const result =
    sortedNotes.length === 1
      ? buildSingleNoteStudyDiagram(sortedNotes[0], options)
      : buildMultiNoteContextDiagram(sortedNotes, options);

  return {
    ...result,
    markdown: renderExcalidrawMarkdown(result.scene, {
      title: options.title,
      sourcePaths: sortedNotes.map((note) => note.path),
    }),
  };
}

export function defaultDiagramOptions(
  title: string,
  sourceLabel: string,
  visualTheme: DiagramOptions["visualTheme"] = "chalkboard",
  handwritingFontFamily = 4,
  studyNoteFontScale = 1,
): DiagramOptions {
  return {
    title,
    sourceLabel,
    visualTheme,
    handwritingFontFamily,
    studyNoteFontScale,
    maxHeadingsPerNote: 8,
    maxTagsPerNote: 4,
    maxLinksPerNote: 5,
    includeSummaries: true,
  };
}

function buildSingleNoteStudyDiagram(
  note: NoteContext,
  options: DiagramOptions,
): Omit<DiagramBuildResult, "markdown"> {
  const analysis = analyzeGenericNote(note);
  const elements: ExcalidrawElement[] = [];
  const theme = STUDY_THEMES[options.visualTheme];
  const fontFamily = options.handwritingFontFamily;

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "title",
    x: 0,
    y: 0,
    width: 2140,
    height: 230,
    color: theme.ink,
    title: chalkLines(analysis.title, 30, 1),
    body: chalkLines(`질문: ${analysis.question}`, 46, 2),
    titleSize: 56,
    bodySize: 38,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "thesis",
    x: 390,
    y: 340,
    width: 1360,
    height: 280,
    color: theme.green,
    title: "잠정 결론",
    body: chalkLines(analysis.thesis, 60, 3),
    titleSize: 40,
    bodySize: 31,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "structure",
    x: 0,
    y: 760,
    width: 650,
    height: 340,
    color: theme.blue,
    title: "1. 핵심 구조",
    body: chalkBulletLines(analysis.structure, 40, 4),
    titleSize: 37,
    bodySize: 28,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "evidence",
    x: 745,
    y: 760,
    width: 650,
    height: 340,
    color: theme.yellow,
    title: "2. 근거 / 자료",
    body: chalkBulletLines(analysis.evidence, 40, 4),
    titleSize: 37,
    bodySize: 28,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "uncertainty",
    x: 1490,
    y: 760,
    width: 650,
    height: 340,
    color: theme.red,
    title: "3. 아직 조심할 점",
    body: chalkBulletLines(analysis.uncertainty, 40, 4),
    titleSize: 37,
    bodySize: 28,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "process",
    x: 0,
    y: 1210,
    width: 670,
    height: 300,
    color: theme.muted,
    title: "4. 실행 / 절차",
    body: chalkBulletLines(analysis.process, 42, 3),
    titleSize: 35,
    bodySize: 26,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "next",
    x: 735,
    y: 1210,
    width: 670,
    height: 300,
    color: theme.ink,
    title: "5. 다음에 확인할 것",
    body: chalkBulletLines(analysis.nextChecks, 42, 3),
    titleSize: 35,
    bodySize: 26,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "source",
    x: 1470,
    y: 1210,
    width: 670,
    height: 300,
    color: theme.ink,
    title: "원문 보호 기준",
    body: chalkBulletLines(analysis.sourceGuard, 42, 3),
    titleSize: 35,
    bodySize: 26,
  });

  addChalkArrow(elements, "title-thesis", { x: 1070, y: 230 }, { x: 1070, y: 340 }, theme.green);
  addChalkArrow(elements, "thesis-structure", { x: 1065, y: 620 }, { x: 325, y: 760 }, theme.blue);
  addChalkArrow(elements, "thesis-evidence", { x: 1070, y: 620 }, { x: 1070, y: 760 }, theme.yellow);
  addChalkArrow(elements, "thesis-uncertainty", { x: 1075, y: 620 }, { x: 1815, y: 760 }, theme.red);
  addChalkArrow(elements, "evidence-next", { x: 1070, y: 1100 }, { x: 1070, y: 1210 }, theme.ink);
  addChalkArrow(elements, "uncertainty-source", { x: 1815, y: 1100 }, { x: 1805, y: 1210 }, theme.line);

  scaleStudyNoteElements(elements, options.studyNoteFontScale);

  const scene = createScene(elements);
  scene.appState = {
    ...scene.appState,
    viewBackgroundColor: theme.background,
  };
  return {
    scene,
    textElementCount: elements.filter((element) => element.type === "text").length,
    relationCount: elements.filter((element) => element.type === "arrow").length,
  };
}

function buildMultiNoteContextDiagram(
  notes: NoteContext[],
  options: DiagramOptions,
): Omit<DiagramBuildResult, "markdown"> {
  const elements: ExcalidrawElement[] = [];
  const noteAnchors = new Map<string, Anchor>();

  addPanel(elements, {
    id: "center",
    x: 0,
    y: -40,
    width: 500,
    height: 170,
    strokeColor: PALETTE.ink,
    backgroundColor: PALETTE.paper,
    title: options.title,
    body: `${options.sourceLabel}\n${notes.length}개 노트의 공통 맥락과 링크 구조`,
  });

  notes.forEach((note, index) => {
    const col = index % CARD_COLUMNS;
    const row = Math.floor(index / CARD_COLUMNS);
    const x = 650 + col * (CARD_WIDTH + CARD_GAP_X);
    const y = -170 + row * (CARD_HEIGHT + CARD_GAP_Y);
    const cardHeight = calculateCardHeight(note, options);
    const anchor = { x, y, width: CARD_WIDTH, height: cardHeight };
    noteAnchors.set(note.path, anchor);

    addPanel(elements, {
      id: `note-${index}`,
      x,
      y,
      width: CARD_WIDTH,
      height: cardHeight,
      strokeColor: PALETTE.slate,
      backgroundColor: PALETTE.panel,
      title: note.basename,
      body: renderNoteCard(note, options),
      link: `[[${note.path.replace(/\.md$/i, "")}]]`,
    });

    elements.push(
      arrow({
        id: stableId("arrow", `center:${note.path}`),
        start: { x: 500, y: 45 },
        end: { x, y: y + cardHeight / 2 },
        strokeColor: PALETTE.line,
        strokeWidth: 1,
      }),
    );
  });

  const relationArrows = buildRelationArrows(notes, noteAnchors);
  elements.push(...relationArrows);

  const scene = createScene(elements);
  return {
    scene,
    textElementCount: elements.filter((element) => element.type === "text").length,
    relationCount: relationArrows.length,
  };
}

function analyzeGenericNote(note: NoteContext): GenericNoteAnalysis {
  const content = note.content;
  const title = cleanText(firstHeading(content) ?? note.basename);
  const allLines = narrativeLines(content);
  const headingLines = note.headings.map((heading) => cleanText(heading.heading)).filter(Boolean);
  const tableLines = summarizeTables(content);

  const question = extractFirstQuestion(allLines)
    ?? `${truncate(title, 34)}에서 먼저 이해해야 할 핵심 질문은 무엇인가?`;
  const thesis = firstUseful(
    [
      ...extractCallouts(content, ["summary", "abstract", "tldr", "info"]).slice(0, 2),
      note.summary,
      ...allLines.filter((line) => line.length >= 28).slice(0, 2),
    ],
    "원문의 목적, 판단 기준, 근거, 주의사항을 먼저 분리해 읽습니다.",
    150,
  );

  const structure = uniqueNonEmpty([
    ...headingLines.slice(0, 5),
    ...allLines.filter((line) => includesAny(line, ["목적", "구성", "개요", "로드맵", "범위", "기능"])).slice(0, 3),
    note.summary,
  ]).slice(0, 5);

  const evidence = uniqueNonEmpty([
    ...tableLines.slice(0, 3),
    ...linesByKeywords(allLines, [
      "근거",
      "자료",
      "기준",
      "요건",
      "설정",
      "명령",
      "CLI",
      "OAuth",
      "파일",
      "환경",
      "지원",
    ], 5),
  ]).slice(0, 5);

  const uncertainty = uniqueNonEmpty([
    ...extractCallouts(content, ["warning", "caution", "danger", "important"]).slice(0, 3),
    ...linesByKeywords(allLines, [
      "주의",
      "보안",
      "권한",
      "제약",
      "한계",
      "위험",
      "문제",
      "오류",
      "실패",
      "불확실",
      "미정",
    ], 5),
  ]).slice(0, 5);

  const process = uniqueNonEmpty([
    ...linesByKeywords(allLines, [
      "설치",
      "사용",
      "연동",
      "실행",
      "단계",
      "절차",
      "작업",
      "로드맵",
      "업데이트",
      "배포",
      "로그인",
    ], 5),
    ...headingLines.filter((line) => includesAny(line, ["설치", "사용", "연동", "절차", "로드맵", "단계"])),
  ]).slice(0, 5);

  const nextChecks = uniqueNonEmpty([
    ...taskLines(content),
    ...linesByKeywords(allLines, [
      "확인",
      "검증",
      "다음",
      "TODO",
      "할 일",
      "체크",
      "테스트",
      "보완",
      "질문",
    ], 5),
    ...headingLines.filter((line) => includesAny(line, ["확인", "검증", "다음", "TODO", "체크"])),
  ]).slice(0, 5);

  return {
    title,
    question,
    thesis,
    structure: fillPanelItems(structure, [
      "제목과 상위 섹션을 먼저 읽어 전체 범위를 잡습니다.",
      "본문의 세부 항목은 목적과 사용 흐름 아래에 배치합니다.",
    ]),
    evidence: fillPanelItems(evidence, [
      "표, 명령, 설정값, 링크는 판단을 지지하는 근거로 분리합니다.",
      "숫자와 파일 경로는 원문에서 다시 확인합니다.",
    ]),
    uncertainty: fillPanelItems(uncertainty, [
      "보안, 권한, 설치 조건, 예외 상황은 결론과 분리해 둡니다.",
      "원문에 없는 판단은 추가하지 않습니다.",
    ]),
    process: fillPanelItems(process, [
      "사용자는 설치 → 설정 → 실행 → 검증 순서로 따라가야 합니다.",
      "실행 가능한 단계와 배경 설명을 구분합니다.",
    ]),
    nextChecks: fillPanelItems(nextChecks, [
      "실제 환경에서 한 번 실행하고 실패 메시지를 확인합니다.",
      "누락된 링크, 명령, 버전 조건을 보완합니다.",
    ]),
    sourceGuard: [
      `원문: ${truncate(note.path, 52)}`,
      "이 그림은 요약 필기입니다. 원문을 덮어쓰지 않습니다.",
      "근거가 약한 항목은 다음 확인 목록으로 남깁니다.",
    ],
  };
}

function addChalkPanel(
  elements: ExcalidrawElement[],
  params: {
    theme: StudyTheme;
    fontFamily: number;
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    title: string;
    body: string;
    titleSize: number;
    bodySize: number;
  },
): void {
  elements.push(
    rectangle({
      id: stableId("chalk-rect", params.id),
      x: params.x,
      y: params.y,
      width: params.width,
      height: params.height,
      strokeColor: params.color,
      backgroundColor: params.theme.panel,
      strokeWidth: 2,
      roughness: 2,
    }),
    textElement({
      id: stableId("chalk-title", params.id),
      text: params.title,
      x: params.x + 22,
      y: params.y + 18,
      width: params.width - 44,
      fontSize: params.titleSize,
      strokeColor: params.color,
      fontFamily: params.fontFamily,
    }),
    textElement({
      id: stableId("chalk-body", params.id),
      text: params.body,
      x: params.x + 22,
      y: params.y + Math.max(58, params.titleSize + 30),
      width: params.width - 44,
      fontSize: params.bodySize,
      strokeColor: params.theme.ink,
      fontFamily: params.fontFamily,
    }),
  );
}

function addChalkArrow(
  elements: ExcalidrawElement[],
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
): void {
  elements.push(
    arrow({
      id: stableId("chalk-arrow", id),
      start,
      end,
      strokeColor: color,
      strokeWidth: 2,
      roughness: 2,
    }),
  );
}

function scaleStudyNoteElements(elements: ExcalidrawElement[], requestedScale: number): void {
  const scale = clampScale(requestedScale);
  if (scale === 1) return;

  for (const element of elements) {
    element.x = Math.round(element.x * scale);
    element.y = Math.round(element.y * scale);
    element.width = Math.round(element.width * scale);
    element.height = Math.round(element.height * scale);

    if (element.type === "text") {
      element.fontSize = Math.max(12, Math.round(element.fontSize * scale));
      element.baseline = Math.round(element.height - element.fontSize * 0.2);
    }

    if (element.type === "arrow") {
      element.points = element.points.map(([x, y]) => [
        Math.round(x * scale),
        Math.round(y * scale),
      ]) as typeof element.points;
      element.strokeWidth = Math.max(1, Math.round(element.strokeWidth * Math.min(scale, 1.25)));
    }
  }
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1.5, Math.max(0.75, Math.round(value * 100) / 100));
}

function chalkLines(value: string, width: number, maxLines: number): string {
  return wrapText(cleanText(value), width).slice(0, maxLines).join("\n");
}

function chalkBulletLines(items: string[], width: number, maxLines: number): string {
  const lines = items
    .flatMap((item) => wrapText(`- ${cleanText(item)}`, width))
    .slice(0, maxLines);
  return lines.length ? lines.join("\n") : "- 원문에서 다시 확인";
}

function addPanel(
  elements: ExcalidrawElement[],
  params: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor: string;
    backgroundColor: string;
    title: string;
    body: string;
    titleSize?: number;
    bodySize?: number;
    link?: string;
  },
): void {
  elements.push(
    rectangle({
      id: stableId("rect", params.id),
      x: params.x,
      y: params.y,
      width: params.width,
      height: params.height,
      strokeColor: params.strokeColor,
      backgroundColor: params.backgroundColor,
      strokeWidth: 1,
      roughness: 0,
      link: params.link ?? null,
    }),
    textElement({
      id: stableId("title", params.id),
      text: wrapText(params.title, Math.max(28, Math.floor(params.width / 15))).join("\n"),
      x: params.x + 24,
      y: params.y + 22,
      width: params.width - 48,
      fontSize: params.titleSize ?? 22,
      strokeColor: params.strokeColor,
      link: params.link ?? null,
    }),
    textElement({
      id: stableId("body", params.id),
      text: params.body,
      x: params.x + 24,
      y: params.y + (params.titleSize && params.titleSize > 24 ? 78 : 66),
      width: params.width - 48,
      fontSize: params.bodySize ?? 16,
      strokeColor: PALETTE.ink,
      link: params.link ?? null,
    }),
  );
}

function renderNoteCard(note: NoteContext, options: DiagramOptions): string {
  const lines: string[] = [];
  if (note.tags.length > 0) lines.push(note.tags.slice(0, options.maxTagsPerNote).join(" "));
  if (options.includeSummaries && note.summary) lines.push(truncate(note.summary, 150));

  const headings = note.headings.slice(0, options.maxHeadingsPerNote);
  if (headings.length > 0) {
    lines.push("", "핵심 구조");
    for (const heading of headings) {
      lines.push(`${"  ".repeat(Math.max(0, heading.level - 1))}- ${truncate(heading.heading, 58)}`);
    }
  }
  const links = note.links.slice(0, options.maxLinksPerNote);
  if (links.length > 0) {
    lines.push("", "연결");
    for (const link of links) lines.push(`- [[${truncate(link.resolvedPath?.replace(/\.md$/i, "") ?? link.target, 52)}]]`);
  }
  return lines.join("\n");
}

function calculateCardHeight(note: NoteContext, options: DiagramOptions): number {
  let lines = 2;
  if (note.tags.length > 0) lines += 1;
  if (options.includeSummaries && note.summary) lines += 3;
  if (note.headings.length > 0) lines += 2 + Math.min(note.headings.length, options.maxHeadingsPerNote);
  if (note.links.length > 0) lines += 2 + Math.min(note.links.length, options.maxLinksPerNote);
  return Math.max(CARD_HEIGHT, 36 + lines * 24);
}

function buildRelationArrows(notes: NoteContext[], anchors: Map<string, Anchor>): ExcalidrawElement[] {
  const selectedPaths = new Set(notes.map((note) => note.path));
  const arrows: ExcalidrawElement[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    const from = anchors.get(note.path);
    if (!from) continue;
    for (const link of note.links) {
      const targetPath = link.resolvedPath;
      if (!targetPath || !selectedPaths.has(targetPath) || targetPath === note.path) continue;
      const key = `${note.path}->${targetPath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const to = anchors.get(targetPath);
      if (!to) continue;
      arrows.push(
        arrow({
          id: stableId("rel", key),
          start: { x: from.x + from.width, y: from.y + from.height / 2 },
          end: { x: to.x, y: to.y + to.height / 2 },
          strokeColor: PALETTE.line,
          strokeWidth: 1,
          strokeStyle: "dashed",
        }),
      );
    }
  }
  return arrows;
}

function fillPanelItems(items: string[], fallback: string[]): string[] {
  return uniqueNonEmpty(items).length ? uniqueNonEmpty(items) : fallback;
}

function firstUseful(items: string[], fallback: string, maxLength: number): string {
  return truncate(cleanText(items.find((item) => cleanText(item).length > 0) ?? fallback), maxLength);
}

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items.map((value) => truncate(cleanText(value), 120)).filter(Boolean)) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function narrativeLines(content: string): string[] {
  return content
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/%%[\s\S]*?%%/g, "")
    .split(/\r?\n/)
    .map((line) =>
      cleanText(line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^>\s*\[![^\]]+]\s*/, "")
        .replace(/^>\s?/, "")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/^\s*[-*+]\s+\[[ xX-]]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "")),
    )
    .filter((line) =>
      line.length > 0 &&
      !line.startsWith("|") &&
      !/^:?-{3,}:?$/.test(line) &&
      !/^!\S+\.(png|jpe?g|gif|webp|svg)$/i.test(line),
    );
}

function extractFirstQuestion(lines: string[]): string | undefined {
  const question = lines.find((line) => /[?？]$/.test(line) || line.includes("무엇") || line.includes("어떻게"));
  return question ? truncate(cleanText(question).replace(/[.。]$/, "?"), 90) : undefined;
}

function linesByKeywords(lines: string[], keywords: string[], limit: number): string[] {
  return lines
    .filter((line) => includesAny(line, keywords))
    .slice(0, limit);
}

function taskLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*+]\s+\[[ xX-]]\s+(.+)/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map(cleanText)
    .slice(0, 5);
}

function extractCallouts(content: string, types: string[]): string[] {
  return types.flatMap((type) => extractCallout(content, type));
}

function extractCallout(content: string, type: string): string[] {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  let active = false;
  for (const line of lines) {
    if (line.match(new RegExp(`^>\\s*\\[!${type}\\]`, "i"))) {
      active = true;
      continue;
    }
    if (active && line.startsWith(">")) {
      const cleaned = cleanText(line.replace(/^>\s?/, ""));
      if (cleaned) result.push(cleaned);
      continue;
    }
    if (active && line.trim() === "") continue;
    if (active) break;
  }
  return result;
}

function summarizeTables(content: string): string[] {
  const tables = parseTables(content);
  return tables
    .flatMap((rows) => rows.slice(0, 2).map(summarizeRow))
    .filter(Boolean)
    .slice(0, 5);
}

function parseTables(content: string): Record<string, string>[][] {
  const lines = content.split(/\r?\n/);
  const tables: Record<string, string>[][] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim().startsWith("|")) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && lines[index].trim().startsWith("|")) index += 1;
    const parsed = parseTable(lines.slice(start, index).join("\n"));
    if (parsed.length) tables.push(parsed);
  }
  return tables;
}

function parseTable(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (lines.length < 3) return [];
  const header = splitTableRow(lines[0]);
  return lines
    .slice(2)
    .map(splitTableRow)
    .filter((cells) => cells.length === header.length)
    .map((cells) => Object.fromEntries(header.map((key, index) => [key, cleanText(cells[index])])));
}

function splitTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function summarizeRow(row: Record<string, string>): string {
  const entries = Object.entries(row)
    .filter(([, value]) => value)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`);
  return truncate(entries.join(" / "), 120);
}

function firstHeading(content: string): string | undefined {
  return content.match(/^#\s+(.+)$/m)?.[1].trim();
}

function cleanText(value: string): string {
  return value
    .replace(/!\[\[[^\]]+]]/g, "")
    .replace(/\[\[([^\]|]+)\|?([^\]]+)?]]/g, (_, target, display) => display || target)
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string | undefined, needles: string[]): boolean {
  const source = value?.toLowerCase();
  return Boolean(source && needles.some((needle) => source.includes(needle.toLowerCase())));
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const chunks = chunkLongWord(word, width);
    for (const chunk of chunks) {
      if (!current) {
        current = chunk;
      } else if ([...current, ...chunk].length + 1 <= width) {
        current += ` ${chunk}`;
      } else {
        lines.push(current);
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function chunkLongWord(word: string, width: number): string[] {
  if ([...word].length <= width) return [word];
  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    if ([...current, char].length > width) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
