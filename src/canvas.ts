import { truncate } from "./markdown";
import type {
  CanvasBuildResult,
  JsonCanvas,
  JsonCanvasEdge,
  JsonCanvasFileNode,
  JsonCanvasGroupNode,
  JsonCanvasNode,
  JsonCanvasTextNode,
  NoteContext,
} from "./types";

export function buildCanvas(notes: NoteContext[], title: string): CanvasBuildResult {
  const sortedNotes = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  const canvas = sortedNotes.length <= 1
    ? buildSingleNoteCanvas(sortedNotes[0], title)
    : buildMultiNoteCanvas(sortedNotes, title);

  validateCanvas(canvas);
  return {
    json: `${JSON.stringify(canvas, null, 2)}\n`,
    canvas,
    nodeCount: canvas.nodes.length,
    edgeCount: canvas.edges.length,
  };
}

export function validateCanvas(canvas: JsonCanvas): void {
  const ids = new Set<string>();
  for (const node of canvas.nodes) {
    assertId(node.id, `node ${node.id}`);
    if (ids.has(node.id)) throw new Error(`Duplicate canvas id: ${node.id}`);
    ids.add(node.id);
    if (!["text", "file", "group"].includes(node.type)) {
      throw new Error(`Unsupported canvas node type: ${node.type}`);
    }
    for (const value of [node.x, node.y, node.width, node.height]) {
      if (!Number.isFinite(value)) throw new Error(`Invalid geometry for node ${node.id}`);
    }
    if (node.type === "text" && !node.text) throw new Error(`Text node ${node.id} is empty`);
    if (node.type === "file" && !node.file) throw new Error(`File node ${node.id} has no file path`);
  }

  for (const edge of canvas.edges) {
    assertId(edge.id, `edge ${edge.id}`);
    if (ids.has(edge.id)) throw new Error(`Duplicate canvas id: ${edge.id}`);
    ids.add(edge.id);
    if (!canvas.nodes.some((node) => node.id === edge.fromNode)) {
      throw new Error(`Edge ${edge.id} references missing fromNode ${edge.fromNode}`);
    }
    if (!canvas.nodes.some((node) => node.id === edge.toNode)) {
      throw new Error(`Edge ${edge.id} references missing toNode ${edge.toNode}`);
    }
  }
}

export function parseAndValidateCanvas(json: string): JsonCanvas {
  const canvas = JSON.parse(json) as JsonCanvas;
  if (!Array.isArray(canvas.nodes)) canvas.nodes = [];
  if (!Array.isArray(canvas.edges)) canvas.edges = [];
  validateCanvas(canvas);
  return canvas;
}

export function assertReadableCanvas(canvas: JsonCanvas): { textNodeCount: number; fileNodeCount: number; edgeCount: number } {
  const textNodes = canvas.nodes.filter((node): node is JsonCanvasTextNode => node.type === "text");
  const fileNodes = canvas.nodes.filter((node): node is JsonCanvasFileNode => node.type === "file");
  const meaningfulTextNodes = textNodes.filter((node) => node.text.replace(/\s+/g, "").length >= 20);
  if (meaningfulTextNodes.length < 4) {
    throw new Error(`Canvas is valid JSON but too sparse: only ${meaningfulTextNodes.length} meaningful text node(s).`);
  }
  if (fileNodes.length === 0) {
    throw new Error("Canvas must keep at least one source file node so the original note remains openable.");
  }
  if (canvas.edges.length === 0) {
    throw new Error("Canvas must contain edges that explain how source, claims, evidence, and next checks connect.");
  }
  return {
    textNodeCount: meaningfulTextNodes.length,
    fileNodeCount: fileNodes.length,
    edgeCount: canvas.edges.length,
  };
}

function buildSingleNoteCanvas(note: NoteContext | undefined, title: string): JsonCanvas {
  const safeNote = note ?? {
    path: "Untitled.md",
    basename: "Untitled",
    folder: "",
    content: "",
    headings: [],
    links: [],
    tags: [],
    summary: "내용을 읽어 핵심 질문, 결론, 근거, 다음 행동으로 정리합니다.",
  };

  const nodes: JsonCanvasNode[] = [
    groupNode("group-main", -80, -80, 1860, 1120, "AI가 직접 편집할 수 있는 Obsidian Canvas", "4"),
    textNode(
      "title",
      0,
      0,
      960,
      180,
      `# ${truncate(title || safeNote.basename, 60)}\n\n**핵심 질문:** ${mainQuestion(safeNote)}`,
      "6",
    ),
    fileNode("source-file", 1040, 0, 620, 360, safeNote.path, "5"),
    textNode(
      "logic",
      0,
      260,
      520,
      300,
      `## 논리 뼈대\n${logicBullets(safeNote)}`,
      "3",
    ),
    textNode(
      "evidence",
      640,
      260,
      520,
      300,
      `## 근거\n${evidenceBullets(safeNote)}`,
      "5",
    ),
    textNode(
      "risk",
      1280,
      260,
      420,
      300,
      `## 아직 단정 금지\n${riskBullets(safeNote)}`,
      "1",
    ),
    textNode(
      "next",
      320,
      680,
      1040,
      260,
      `## 다음에 확인할 것\n${nextBullets(safeNote)}`,
      "2",
    ),
  ];

  const edges: JsonCanvasEdge[] = [
    edge("title-source", "title", "source-file", "right", "left", "source"),
    edge("title-logic", "title", "logic", "bottom", "top", "structure"),
    edge("logic-evidence", "logic", "evidence", "right", "left", "supports"),
    edge("evidence-risk", "evidence", "risk", "right", "left", "caveat"),
    edge("risk-next", "risk", "next", "bottom", "right", "check"),
  ];

  return { nodes, edges };
}

function buildMultiNoteCanvas(notes: NoteContext[], title: string): JsonCanvas {
  const focusNotes = notes.slice(0, Math.min(4, notes.length));
  const evidenceHeight = Math.max(820, 120 + focusNotes.length * 200);
  const nodes: JsonCanvasNode[] = [
    groupNode("group-source-lane", -760, -120, 540, evidenceHeight, "열어볼 원문", "5"),
    groupNode("group-thinking-lane", -160, -120, 680, evidenceHeight, "판단 축", "6"),
    groupNode("group-evidence-lane", 600, -120, 760, evidenceHeight, "근거와 검증", "4"),
    groupNode("group-action-lane", -160, evidenceHeight + 40, 1520, 230, "다음 작업", "2"),
    textNode(
      "synthesis-title",
      -120,
      -40,
      620,
      140,
      `# ${truncate(title, 58)}\n\n${notes.length}개 노트를 원문-질문-판단-근거-검증 흐름으로 묶은 작업 Canvas입니다.`,
      "6",
    ),
    textNode(
      "synthesis-question",
      -120,
      140,
      620,
      130,
      `## 핵심 질문\n${mainQuestion(notes[0])}`,
      "3",
    ),
    textNode(
      "synthesis-judgment",
      -120,
      310,
      620,
      210,
      `## 잠정 판단\n${synthesisJudgment(notes)}`,
      "4",
    ),
    textNode(
      "synthesis-caveat",
      -120,
      560,
      620,
      160,
      `## 아직 단정 금지\n${synthesisRisks(notes)}`,
      "1",
    ),
    textNode(
      "synthesis-next",
      -120,
      evidenceHeight + 100,
      1440,
      130,
      `## 다음에 확인할 것\n${synthesisNextChecks(notes)}`,
      "2",
    ),
  ];
  const edges: JsonCanvasEdge[] = [
    edge("title-question", "synthesis-title", "synthesis-question", "bottom", "top", "focus"),
    edge("question-judgment", "synthesis-question", "synthesis-judgment", "bottom", "top", "answer"),
    edge("judgment-caveat", "synthesis-judgment", "synthesis-caveat", "bottom", "top", "limit"),
    edge("caveat-next", "synthesis-caveat", "synthesis-next", "bottom", "top", "verify"),
  ];

  focusNotes.forEach((note, index) => {
    const y = -30 + index * 190;
    const sourceKey = `source-file-${index}`;
    const evidenceKey = `evidence-card-${index}`;
    nodes.push(fileNode(sourceKey, -720, y, 460, 145, note.path, colorForIndex(index)));
    nodes.push(textNode(
      evidenceKey,
      650,
      y,
      650,
      165,
      noteEvidenceCard(note, index),
      colorForIndex(index + 1),
    ));
    edges.push(edge(`source-evidence-${index}`, sourceKey, evidenceKey, "right", "left", "원문"));
    edges.push(edge(`evidence-judgment-${index}`, evidenceKey, "synthesis-judgment", "left", "right", "근거"));
  });

  if (notes.length > focusNotes.length) {
    nodes.push(textNode(
      "source-overflow",
      -720,
      -30 + focusNotes.length * 190,
      460,
      130,
      `## 추가 원문\n외 ${notes.length - focusNotes.length}개 노트는 현재 Canvas의 판단 축을 보강하는 후보입니다. 필요한 경우 파일 노드를 추가로 펼쳐 검증합니다.`,
      "5",
    ));
    edges.push(edge("overflow-next", "source-overflow", "synthesis-next", "right", "left", "expand"));
  }

  return { nodes, edges };
}

function textNode(
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  color?: string,
): JsonCanvasTextNode {
  return {
    id: stableCanvasId(key),
    type: "text",
    x,
    y,
    width,
    height,
    text,
    ...(color ? { color } : {}),
  };
}

function fileNode(
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
  file: string,
  color?: string,
): JsonCanvasFileNode {
  return {
    id: stableCanvasId(key),
    type: "file",
    x,
    y,
    width,
    height,
    file,
    ...(color ? { color } : {}),
  };
}

function groupNode(
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color?: string,
): JsonCanvasGroupNode {
  return {
    id: stableCanvasId(key),
    type: "group",
    x,
    y,
    width,
    height,
    label,
    ...(color ? { color } : {}),
  };
}

function edge(
  key: string,
  fromNodeKey: string,
  toNodeKey: string,
  fromSide: JsonCanvasEdge["fromSide"],
  toSide: JsonCanvasEdge["toSide"],
  label: string,
): JsonCanvasEdge {
  return {
    id: stableCanvasId(`edge-${key}`),
    fromNode: stableCanvasId(fromNodeKey),
    fromSide,
    toNode: stableCanvasId(toNodeKey),
    toSide,
    toEnd: "arrow",
    label,
  };
}

function mainQuestion(note: NoteContext): string {
  const heading = note.headings.find((item) => item.heading.includes("?"))?.heading;
  return truncate(heading || note.summary || `${note.basename}의 핵심 판단은 무엇인가?`, 100);
}

function logicBullets(note: NoteContext): string {
  const headings = note.headings.slice(0, 4).map((heading) => `- ${heading.heading}`);
  return (headings.length ? headings : [`- ${truncate(note.summary, 90)}`]).join("\n");
}

function evidenceBullets(note: NoteContext): string {
  const lines = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.match(/[%₩원T]|전주|대비|판단|근거|확인/))
    .slice(0, 5)
    .map((line) => `- ${truncate(line.replace(/^[-*+]\s+/, ""), 90)}`);
  return (lines.length ? lines : [`- ${truncate(note.summary, 100)}`]).join("\n");
}

function riskBullets(note: NoteContext): string {
  const lines = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("주의") || line.includes("검증") || line.includes("마감") || line.includes("한계"))
    .slice(0, 4)
    .map((line) => `- ${truncate(line.replace(/^[-*+]\s+/, ""), 80)}`);
  return (lines.length ? lines : ["- 원문 근거 확인 전 결론을 고정하지 않기"]).join("\n");
}

function nextBullets(note: NoteContext): string {
  const questions = note.content
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+\.\s+/, "").replace(/^[-*+]\s+/, ""))
    .filter((line) => line.includes("?") || line.includes("확인") || line.includes("대사"))
    .slice(0, 4)
    .map((line) => `- ${truncate(line, 100)}`);
  return (questions.length ? questions : ["- 원문을 다시 읽고 다음 판단 질문을 3개로 좁히기"]).join("\n");
}

function synthesisJudgment(notes: NoteContext[]): string {
  const summaryBullets = notes
    .map((note) => note.summary)
    .filter(Boolean)
    .slice(0, 3)
    .map((summary) => `- ${truncate(summary, 110)}`);
  if (summaryBullets.length) return summaryBullets.join("\n");
  return `- ${truncate(notes[0]?.basename ?? "첫 노트", 40)}를 기준으로 다른 노트가 보강하거나 반박하는 판단을 분리한다.`;
}

function synthesisRisks(notes: NoteContext[]): string {
  const riskLines = uniqueLines(
    notes.flatMap((note) => riskBullets(note).split("\n")),
  ).slice(0, 4);
  return (riskLines.length ? riskLines : ["- 원문 확인 전 결론을 고정하지 않기"]).join("\n");
}

function synthesisNextChecks(notes: NoteContext[]): string {
  const nextLines = uniqueLines(
    notes.flatMap((note) => nextBullets(note).split("\n")),
  ).slice(0, 5);
  return (nextLines.length ? nextLines : ["- 원문 파일을 열어 핵심 수치와 판단 문장을 다시 대조하기"]).join("\n");
}

function noteEvidenceCard(note: NoteContext, index: number): string {
  const heading = note.headings[0]?.heading || note.basename;
  const evidence = evidenceBullets(note)
    .split("\n")
    .slice(0, 3)
    .join("\n");
  return [
    `## 근거 ${index + 1}: ${truncate(heading, 42)}`,
    evidence,
    note.tags.length ? `- 태그: ${note.tags.slice(0, 4).join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function colorForIndex(index: number): string {
  return String((index % 6) + 1);
}

function stableCanvasId(value: string): string {
  return `${hash32(value).toString(16).padStart(8, "0")}${hash32(`${value}:salt`).toString(16).padStart(8, "0")}`;
}

function hash32(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function assertId(value: string, label: string): void {
  if (!/^[0-9a-f]{16}$/.test(value)) {
    throw new Error(`Invalid ${label}: JSON Canvas ids must be 16 lowercase hex characters`);
  }
}
