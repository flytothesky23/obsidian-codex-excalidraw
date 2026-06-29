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
  panel2: "#f1f5f9",
  blue: "#1d4ed8",
  blueSoft: "#eff6ff",
  teal: "#0f766e",
  tealSoft: "#f0fdfa",
  amber: "#92400e",
  amberSoft: "#fffbeb",
  red: "#991b1b",
  redSoft: "#fef2f2",
};

const CHALK = {
  board: "#123b34",
  boardSoft: "#17463e",
  chalk: "#f8fafc",
  muted: "#d9eadf",
  blue: "#a5d8ff",
  yellow: "#ffe08a",
  green: "#b2f2bb",
  red: "#ffc9c9",
  line: "#d9eadf",
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

type Anchor = { x: number; y: number; width: number; height: number };

export function buildDiagram(notes: NoteContext[], options: DiagramOptions): DiagramBuildResult {
  const sortedNotes = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const result =
    sortedNotes.length === 1
      ? buildSingleNoteReportDiagram(sortedNotes[0], options)
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
): DiagramOptions {
  return {
    title,
    sourceLabel,
    visualTheme,
    handwritingFontFamily,
    maxHeadingsPerNote: 8,
    maxTagsPerNote: 4,
    maxLinksPerNote: 5,
    includeSummaries: true,
  };
}

function buildSingleNoteReportDiagram(
  note: NoteContext,
  options: DiagramOptions,
): Omit<DiagramBuildResult, "markdown"> {
  const analysis = analyzeReportNote(note);
  const elements: ExcalidrawElement[] = [];
  const theme = STUDY_THEMES[options.visualTheme];
  const fontFamily = options.handwritingFontFamily;

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "title",
    x: 0,
    y: 0,
    width: 1660,
    height: 170,
    color: theme.ink,
    title: chalkTitle(analysis.title, options.sourceLabel),
    body: mainQuestion(analysis),
    titleSize: 42,
    bodySize: 29,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "judgement",
    x: 300,
    y: 260,
    width: 1060,
    height: 210,
    color: theme.green,
    title: "잠정 결론",
    body: chalkLines(judgementSignal(analysis), 56, 3),
    titleSize: 31,
    bodySize: 24,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "sales",
    x: 0,
    y: 560,
    width: 500,
    height: 260,
    color: theme.blue,
    title: "1. 판매/수요",
    body: chalkLines(salesSignal(analysis), 39, 4),
    titleSize: 29,
    bodySize: 21,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "price",
    x: 580,
    y: 560,
    width: 500,
    height: 260,
    color: theme.yellow,
    title: "2. 가격/운임",
    body: chalkLines(priceSignal(analysis), 39, 4),
    titleSize: 29,
    bodySize: 21,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "ops",
    x: 1160,
    y: 560,
    width: 500,
    height: 260,
    color: theme.muted,
    title: "3. 운영 회복",
    body: chalkLines(opsSignal(analysis), 39, 4),
    titleSize: 29,
    bodySize: 21,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "mix",
    x: 0,
    y: 900,
    width: 520,
    height: 220,
    color: theme.ink,
    title: "4. 용도/고객 믹스",
    body: chalkLines(mixSignal(analysis), 40, 3),
    titleSize: 27,
    bodySize: 20,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "counter",
    x: 570,
    y: 900,
    width: 520,
    height: 220,
    color: theme.red,
    title: "5. 단정하면 안 되는 이유",
    body: chalkLines(counterSignal(analysis), 40, 3),
    titleSize: 27,
    bodySize: 20,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "next",
    x: 1140,
    y: 900,
    width: 520,
    height: 220,
    color: theme.ink,
    title: "다음에 확인할 것",
    body: chalkLines(nextChecks(analysis), 40, 3),
    titleSize: 27,
    bodySize: 20,
  });

  addChalkPanel(elements, {
    theme,
    fontFamily,
    id: "caveat",
    x: 310,
    y: 1200,
    width: 1040,
    height: 140,
    color: theme.red,
    title: "품질 게이트",
    body: chalkLines(qualitySignal(analysis), 72, 2),
    titleSize: 27,
    bodySize: 20,
  });

  addChalkArrow(elements, "title-judge", { x: 830, y: 170 }, { x: 830, y: 260 }, theme.green);
  addChalkArrow(elements, "judge-sales", { x: 825, y: 470 }, { x: 250, y: 560 }, theme.blue);
  addChalkArrow(elements, "judge-price", { x: 830, y: 470 }, { x: 830, y: 560 }, theme.yellow);
  addChalkArrow(elements, "judge-ops", { x: 835, y: 470 }, { x: 1410, y: 560 }, theme.muted);
  addChalkArrow(elements, "price-counter", { x: 830, y: 820 }, { x: 830, y: 900 }, theme.red);
  addChalkArrow(elements, "ops-next", { x: 1410, y: 820 }, { x: 1400, y: 900 }, theme.line);

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

function analyzeReportNote(note: NoteContext) {
  const content = note.content;
  const title = firstHeading(content) ?? note.basename;
  const period = extractPeriod(content);
  const judgement = extractCallout(content, "summary") || extractBullets(section(content, "Executive Brief"), 4);
  const warning = extractCallout(content, "warning").slice(0, 2);
  const kpis = parseTable(section(content, "경영 지표 보드")).slice(0, 5);
  const baseline = parseTable(section(content, "기준선 적용 상태")).slice(0, 3);
  const operations = parseTable(section(content, "운영 자원 진단"))
    .slice(0, 5)
    .map((row) => `${row["사업장"]}: ${row["이번 주 해석"] || row["해석"]}`)
    .filter(Boolean);
  const qualityGates = parseTable(section(content, "수량·금액 확인 플래그"))
    .slice(0, 4)
    .map((row) => `${row["플래그"]}: ${row["W25 판정"]} - ${row["조치"]}`)
    .filter(Boolean);

  return {
    title,
    period,
    tags: note.tags.slice(0, 4),
    judgement: judgement.length ? judgement : [note.summary],
    warning,
    kpis,
    baseline,
    salesMix: parseTable(section(content, "용도·규격·출고처")).slice(0, 5),
    customers: parseTable(section(content, "고객별 전략 질문")).slice(0, 5),
    yieldAudit: parseTable(section(content, "수율감사 요약")).slice(0, 2),
    operations,
    qualityGates: [...warning, ...qualityGates].slice(0, 5),
    questions: deriveQuestions(content),
    drivers: deriveDrivers(content, kpis, baseline),
  };
}

function addChalkPanel(
  elements: ExcalidrawElement[],
  params: {
    theme: typeof STUDY_THEMES[DiagramOptions["visualTheme"]];
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

function chalkTitle(title: string, sourceLabel: string): string {
  const cleaned = cleanText(title || sourceLabel).replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const short = cleaned.includes("유네코") ? "W25 한눈 필기" : truncate(cleaned, 34);
  return chalkLines(short, 24, 1);
}

function mainQuestion(analysis: ReturnType<typeof analyzeReportNote>): string {
  const question = analysis.questions[0] || "이번 약세는 일시적 차이인가, 회복 지연 신호인가?";
  return chalkLines(`질문: ${cleanText(question).replace(/[.。]$/, "?")}`, 38, 2);
}

function judgementSignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  const judgement = firstUseful(analysis.judgement, "아직 결론보다 확인이 중요한 주간입니다.");
  const baseline = analysis.baseline.find((row) => row["기준선"]?.includes("직전 4주"))?.["해석"];
  return [judgement, baseline ? `핵심 비교: ${baseline}` : ""]
    .filter(Boolean)
    .join(" ");
}

function salesSignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  const row = analysis.kpis.find((item) => includesAny(item["지표"], ["PSBall", "매출", "판매"]));
  const volume = analysis.kpis.find((item) => includesAny(item["지표"], ["판매량", "수량"]));
  const baseline = analysis.baseline.find((item) => item["기준선"] === "직전 4주 평균");
  return [
    rowSummary(row),
    rowSummary(volume),
    baseline?.["해석"] ? `4주 평균: ${baseline["해석"]}` : "",
  ].filter(Boolean).join(" / ") || firstUseful(analysis.drivers, "매출·판매량이 기준선보다 약한지 먼저 확인합니다.");
}

function priceSignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  const row = analysis.kpis.find((item) => includesAny(item["지표"], ["운임", "가격", "단가"]));
  const driver = analysis.drivers.find((item) => includesAny(item, ["운임", "가격", "단가", "도착"]));
  const question = analysis.questions.find((item) => includesAny(item, ["운임", "단가", "가격", "도착"]));
  return [
    rowSummary(row),
    driver,
    question ? `확인: ${question}` : "",
  ].filter(Boolean).join(" / ") || cleanText("운임이 나쁜 비용인지, 단가로 회수되는 거래인지 봅니다.");
}

function opsSignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  return analysis.operations.slice(0, 3).join(" / ")
    || "현장 이동·장비 기록이 다음 주 회복 확인 지점입니다.";
}

function mixSignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  const mix = analysis.salesMix.slice(0, 3).map((row) => {
    const use = row["용도"] ?? row[Object.keys(row)[0]];
    const revenue = row["매출액"] ? `${row["매출액"]}` : "";
    const note = row["해석"] ?? "";
    return cleanText([use, revenue, note].filter(Boolean).join(": "));
  });
  const customer = analysis.customers.slice(0, 2).map((row) => {
    const name = row["고객"] ?? row[Object.keys(row)[0]];
    const question = row["이번 주 질문"] ?? "";
    return cleanText(`${name}: ${question}`);
  });
  return [...mix, ...customer].slice(0, 4).join(" / ")
    || "용도 믹스 -> 규격 믹스 -> 출고처 -> 반복 주문 순서로 읽습니다.";
}

function counterSignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  const gates = [...analysis.warning, ...analysis.qualityGates].map(cleanText).join(" ");
  const questions = analysis.questions.map(cleanText).join(" ");
  const yieldAudit = analysis.yieldAudit.map(rowSummary).join(" ");
  const points = [
    includesAny(gates, ["검증용", "official_report=false", "공식 마감"])
      ? "공식 마감 전 검증용 자료라 결론은 조건부"
      : "",
    includesAny(gates, ["월마감", "원장", "대사"])
      ? "월마감 전 매출·수량 포함: 원장 대사 필요"
      : "",
    includesAny(questions, ["운임", "단가", "가격"])
      ? "운임 상승만으로 악화 단정 금지: 단가 회수 확인"
      : "",
    includesAny([gates, yieldAudit].join(" "), ["함안", "청남", "상계", "내부이동"])
      ? "함안·청남 내부이동은 연결 기준 상계 필요"
      : "",
  ].filter(Boolean);
  return points.slice(0, 3).join(" / ")
    || "검증용 참고자료이므로 회계 마감·성과 평가는 원장 대사 후 판단합니다.";
}

function nextChecks(analysis: ReturnType<typeof analyzeReportNote>): string {
  return analysis.questions
    .slice(0, 4)
    .map((item) => truncate(cleanText(item).replace(/[.。]$/, ""), 46))
    .join(" | ") || "원장 대사 | 고객 재주문 | 규격별 평균단가";
}

function qualitySignal(analysis: ReturnType<typeof analyzeReportNote>): string {
  const gates = analysis.qualityGates.map(cleanText).join(" ");
  const points = [
    includesAny(gates, ["official_report=false", "공식 마감자료", "검증용"])
      ? "검증용 경영참고자료: 공식 마감자료 아님"
      : "",
    includesAny(gates, ["월마감", "원장", "대사"])
      ? "월마감 전 매출·수량은 원장 대사 후 확정"
      : "",
    includesAny(gates, ["함안", "청남", "수량 감사", "내부이동"])
      ? "함안·청남 수량 감사와 내부이동 상계 확인"
      : "",
    includesAny(gates, ["High", "Medium"])
      ? "차이 플래그는 위험도별로 다음 주 재확인"
      : "",
  ].filter(Boolean);
  return points.slice(0, 3).join(" / ")
    || "공식 마감자료가 아니며, 월마감 원장 대사 후 경영 판단에 사용합니다.";
}

function firstUseful(items: string[], fallback: string): string {
  return truncate(cleanText(items.find((item) => cleanText(item).length > 0) ?? fallback), 96);
}

function rowSummary(row: Record<string, string> | undefined): string {
  if (!row) return "";
  const metric = row["지표"] ?? row["기준선"] ?? row[Object.keys(row)[0]];
  const value = row["이번 주"] ?? row["전주 대비"] ?? row["판단 기준"] ?? "";
  const judgement = row["판단"] ?? row["해석"] ?? row["이번 주 해석"] ?? "";
  return truncate(cleanText([metric, value, judgement].filter(Boolean).join(" · ")), 96);
}

function includesAny(value: string | undefined, needles: string[]): boolean {
  return Boolean(value && needles.some((needle) => value.includes(needle)));
}

function chalkLines(value: string, width: number, maxLines: number): string {
  return wrapText(cleanText(value), width).slice(0, maxLines).join("\n");
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

function addFlowStrip(elements: ExcalidrawElement[], analysis: ReturnType<typeof analyzeReportNote>): void {
  const stages = [
    ["원장/업무기록", analysis.baseline[0]?.["해석"] || "주간 원장과 현장 기록"],
    ["KPI 변화", analysis.kpis[0]?.["판단"] || "매출·물량·운임 변화"],
    ["드라이버 분해", "용도, 규격, 출고처, 운영 사건"],
    ["다음 판단", analysis.questions[0] || "W26 회복 신호 확인"],
  ];
  const y = 920;
  stages.forEach(([title, body], index) => {
    const x = 805 + (index % 2) * 375;
    const rowY = y + Math.floor(index / 2) * 155;
    addPanel(elements, {
      id: `flow-${index}`,
      x,
      y: rowY,
      width: 345,
      height: 135,
      strokeColor: index === stages.length - 1 ? PALETTE.teal : PALETTE.slate,
      backgroundColor: index === stages.length - 1 ? PALETTE.tealSoft : PALETTE.panel,
      title,
      body: truncate(body, 92),
      titleSize: 18,
      bodySize: 14,
    });
    if (index > 0) {
      elements.push(
        arrow({
          id: stableId("flow-arrow", `${index}`),
          start: { x: index % 2 === 0 ? x + 172 : x - 30, y: rowY + 67 },
          end: { x: index % 2 === 0 ? x + 375 : x, y: rowY + 67 },
          strokeColor: PALETTE.line,
          strokeWidth: 1,
        }),
      );
    }
  });
}

function connect(elements: ExcalidrawElement[], from: string, to: string): void {
  const anchors: Record<string, Anchor> = {
    header: { x: 0, y: 0, width: 1540, height: 145 },
    judgement: { x: 0, y: 190, width: 500, height: 300 },
    kpi: { x: 540, y: 190, width: 520, height: 300 },
    questions: { x: 1100, y: 190, width: 440, height: 300 },
    sales: { x: 0, y: 540, width: 500, height: 330 },
    yield: { x: 540, y: 540, width: 520, height: 330 },
    ops: { x: 1100, y: 540, width: 440, height: 330 },
    quality: { x: 0, y: 920, width: 760, height: 300 },
  };
  const a = anchors[from];
  const b = anchors[to];
  if (!a || !b) return;
  elements.push(
    arrow({
      id: stableId("connect", `${from}->${to}`),
      start: { x: a.x + a.width / 2, y: a.y + a.height },
      end: { x: b.x + b.width / 2, y: b.y },
      strokeColor: PALETTE.line,
      strokeWidth: 1,
    }),
  );
}

function formatKpiRows(rows: Record<string, string>[]): string {
  if (!rows.length) return "KPI 표를 찾지 못했습니다.\n본문의 경영 지표 보드를 확인하세요.";
  return rows
    .map((row) => {
      const metric = row["지표"] ?? row[Object.keys(row)[0]];
      const value = row["이번 주"] ?? "";
      const delta = row["전주 대비"] ? ` (${row["전주 대비"]})` : "";
      const judgement = row["판단"] ? ` - ${row["판단"]}` : "";
      return `• ${metric}: ${value}${delta}${judgement}`;
    })
    .map((line) => wrapText(line, 54).join("\n  "))
    .join("\n");
}

function formatDrivers(drivers: string[]): string {
  return drivers.map((driver) => wrapText(`• ${driver}`, 78).join("\n  ")).join("\n");
}

function formatSalesMix(rows: Record<string, string>[]): string {
  if (!rows.length) {
    return "용도·고객군 표를 찾지 못했습니다.\nPSBall 전략 섹션을 확인하세요.";
  }
  return rows
    .map((row) => {
      const use = row["용도"] ?? row["렌즈"] ?? row[Object.keys(row)[0]];
      const revenue = row["매출액"] ? ` ${row["매출액"]}` : "";
      const volume = row["수량"] ? ` / ${row["수량"]}` : "";
      const note = row["해석"] ?? row["판정"] ?? "";
      return `• ${use}:${revenue}${volume} - ${note}`;
    })
    .map((line) => wrapText(line, 58).join("\n  "))
    .join("\n");
}

function formatYieldAudit(rows: Record<string, string>[]): string {
  if (!rows.length) {
    return "수율감사 요약표를 찾지 못했습니다.\n함안·청남 가치 회수 섹션을 확인하세요.";
  }
  return rows
    .map((row) => {
      const site = row["사업장"] ?? row[Object.keys(row)[0]];
      const inbound = row["총입고량"] ? `입고 ${row["총입고량"]}` : "";
      const byproduct = row["판매가능 부산물"] ? `부산물 ${row["판매가능 부산물"]}` : "";
      const yieldRate = row["부산물 수율"] ? `수율 ${row["부산물 수율"]}` : "";
      const judgement = row["판정"] ? `판정 ${row["판정"]}` : "";
      return `• ${site}: ${[inbound, byproduct, yieldRate, judgement].filter(Boolean).join(" / ")}`;
    })
    .map((line) => wrapText(line, 58).join("\n  "))
    .join("\n");
}

function formatBullets(items: string[], limit: number, width: number): string {
  return items
    .filter(Boolean)
    .slice(0, limit)
    .map((item) => wrapText(`• ${cleanText(item)}`, width).join("\n  "))
    .join("\n");
}

function renderNoteCard(note: NoteContext, options: DiagramOptions): string {
  const lines: string[] = [];
  if (note.tags.length > 0) lines.push(note.tags.slice(0, options.maxTagsPerNote).join(" "));
  if (options.includeSummaries && note.summary) lines.push(truncate(note.summary, 150));

  const headings = note.headings.slice(0, options.maxHeadingsPerNote);
  if (headings.length > 0) {
    lines.push("", "핵심 구조");
    for (const heading of headings) {
      lines.push(`${"  ".repeat(Math.max(0, heading.level - 1))}• ${truncate(heading.heading, 58)}`);
    }
  }
  const links = note.links.slice(0, options.maxLinksPerNote);
  if (links.length > 0) {
    lines.push("", "연결");
    for (const link of links) lines.push(`• [[${truncate(link.resolvedPath?.replace(/\.md$/i, "") ?? link.target, 52)}]]`);
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

function deriveDrivers(content: string, kpis: Record<string, string>[], baseline: Record<string, string>[]): string[] {
  const drivers = [
    kpis.find((row) => row["지표"]?.includes("PSBall 매출액"))?.["판단"],
    kpis.find((row) => row["지표"]?.includes("운임"))?.["판단"],
    baseline.find((row) => row["기준선"]?.includes("직전 4주"))?.["해석"],
    ...extractBullets(section(content, "PSBall 판매 전략 진단"), 2),
    ...extractBullets(section(content, "드라이버 진단 한계와 추가 데이터"), 2),
  ].filter(Boolean) as string[];
  return drivers.length ? drivers.slice(0, 7) : ["본문의 KPI, 기준선, 운영 기록을 함께 읽어 다음 주 판단 질문으로 전환한다."];
}

function deriveQuestions(content: string): string[] {
  const explicit = [
    ...extractNumberedList(section(content, "W21~W25 기준선 비교")).slice(0, 3),
    ...extractBullets(section(content, "도착 조건 가격 회수 확인"), 2),
    ...extractBullets(section(content, "드라이버 진단 한계와 추가 데이터"), 2),
  ];
  const fallback = [
    "W25 약세가 출하 시점 차이인지 반복 고객·규격 약화인지 구분한다.",
    "도착도 거래에서 운임이 제품 단가로 회수됐는지 확인한다.",
    "칠서·부산·청남·하동의 W26 선별/출하 회복 신호를 확인한다.",
    "함안·청남 내부이동은 연결 기준에서 상계하고 월마감 원장과 대사한다.",
  ];
  return (explicit.length ? explicit : fallback).slice(0, 6);
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

function section(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.match(/^#{1,6}\s+/) && line.includes(heading));
  if (start < 0) return "";
  const level = lines[start].match(/^(#{1,6})\s+/)?.[1].length ?? 1;
  const end = lines.findIndex((line, index) => index > start && line.match(new RegExp(`^#{1,${level}}\\s+`)));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
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

function extractBullets(text: string, limit = 5): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*+]\s+(.+)/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map(cleanText)
    .slice(0, limit);
}

function extractNumberedList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*\d+\.\s+(.+)/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map(cleanText);
}

function firstHeading(content: string): string | undefined {
  return content.match(/^#\s+(.+)$/m)?.[1].trim();
}

function extractPeriod(content: string): string | undefined {
  const title = firstHeading(content);
  return title?.match(/\((\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2})\)/)?.[1];
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

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ([...current, ...word].length + 1 <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}
