import type {
  ExcalidrawArrowElement,
  ExcalidrawBaseElement,
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  ExcalidrawScene,
  ExcalidrawTextElement,
} from "./types";

const SOURCE = "https://github.com/local/obsidian-codex-excalidraw";
const WARNING =
  "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'";

export function createScene(elements: ExcalidrawElement[]): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: 2,
    source: SOURCE,
    elements,
    appState: {
      theme: "light",
      viewBackgroundColor: "#ffffff",
      gridSize: null,
    },
    files: {},
  };
}

export function rectangle(params: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  roughness?: number;
  link?: string | null;
}): ExcalidrawRectangleElement {
  return {
    ...base(params.id, params.x, params.y, params.width, params.height),
    type: "rectangle",
    strokeColor: params.strokeColor ?? "#1e1e1e",
    backgroundColor: params.backgroundColor ?? "#ffffff",
    strokeWidth: params.strokeWidth ?? 1,
    roughness: params.roughness ?? 1,
    link: params.link ?? null,
  };
}

export function textElement(params: {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize?: number;
  strokeColor?: string;
  textAlign?: "left" | "center";
  verticalAlign?: "top" | "middle";
  link?: string | null;
  fontFamily?: number;
}): ExcalidrawTextElement {
  const fontSize = params.fontSize ?? 20;
  const lineHeight = 1.25;
  const lines = params.text.split("\n").length;
  const height = Math.max(fontSize * lineHeight, lines * fontSize * lineHeight);

  return {
    ...base(params.id, params.x, params.y, params.width, height),
    type: "text",
    strokeColor: params.strokeColor ?? "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    roughness: 0,
    fontSize,
    fontFamily: params.fontFamily ?? 4,
    text: params.text,
    rawText: params.text,
    textAlign: params.textAlign ?? "left",
    verticalAlign: params.verticalAlign ?? "top",
    containerId: null,
    originalText: params.text,
    lineHeight,
    baseline: Math.round(height - fontSize * 0.2),
    link: params.link ?? null,
  };
}

export function arrow(params: {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  roughness?: number;
}): ExcalidrawArrowElement {
  const width = params.end.x - params.start.x;
  const height = params.end.y - params.start.y;
  return {
    ...base(params.id, params.start.x, params.start.y, width, height),
    type: "arrow",
    strokeColor: params.strokeColor ?? "#495057",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: params.strokeWidth ?? 2,
    strokeStyle: params.strokeStyle ?? "solid",
    roughness: params.roughness ?? 1,
    points: [
      [0, 0],
      [width, height],
    ],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    lastCommittedPoint: null,
    elbowed: false,
  };
}

export function renderExcalidrawMarkdown(scene: ExcalidrawScene, options: {
  title: string;
  sourcePaths: string[];
}): string {
  const normalizedScene = normalizeSceneElementIds(scene);
  const textElements = normalizedScene.elements.filter(
    (element): element is ExcalidrawTextElement => element.type === "text",
  );
  const textSection = textElements
    .map((element) => `${escapeTextElement(element.rawText)} ^${element.id}`)
    .join("\n\n");
  const sources = options.sourcePaths
    .map((path) => `  - "[[${escapeYamlString(path.replace(/\\.md$/i, ""))}]]"`)
    .join("\n");
  const frontmatter = [
    "---",
    "excalidraw-plugin: parsed",
    "tags:",
    "  - excalidraw",
    "  - codex-map",
    `codex_source_count: ${options.sourcePaths.length}`,
    "codex_sources:",
    sources || "  - none",
    "---",
  ].join("\n");

  return [
    frontmatter,
    WARNING,
    "",
    "",
    "%%",
    "# Excalidraw Data",
    "",
    "## Text Elements",
    textSection,
    "",
    `## Drawing\n\`\`\`json\n${JSON.stringify(normalizedScene, null, 2)}\n\`\`\`\n%%`,
    "",
  ].join("\n");
}

export interface ExcalidrawInspectionStats {
  elementCount: number;
  textCount: number;
  markdownTextBlockCount: number;
  rectangleCount: number;
  arrowCount: number;
  nonTextVectorCount: number;
  visibleTextCharacters: number;
  minFontSize: number;
  maxFontSize: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function inspectExcalidrawMarkdown(markdown: string): ExcalidrawInspectionStats {
  const drawingJson = markdown.match(/## Drawing\s*```json\s*([\s\S]*?)\s*```/)?.[1];
  if (!drawingJson) {
    throw new Error("Missing Excalidraw `## Drawing` JSON fence.");
  }

  const parsed = JSON.parse(drawingJson) as { elements?: unknown[] };
  const elements = Array.isArray(parsed.elements)
    ? parsed.elements.filter(isVisibleExcalidrawElement)
    : [];
  if (elements.length === 0) {
    throw new Error("Excalidraw drawing JSON contains no visible elements.");
  }

  const textElements = elements.filter(isTextInspectionElement);
  const markdownTextBlockCount = countMarkdownTextBlocks(markdown);
  if (textElements.length !== markdownTextBlockCount) {
    throw new Error(
      `Text element mismatch: JSON has ${textElements.length}, Markdown has ${markdownTextBlockCount}.`,
    );
  }

  const bounds = elements.reduce(
    (acc, element) => ({
      minX: Math.min(acc.minX, element.x),
      minY: Math.min(acc.minY, element.y),
      maxX: Math.max(acc.maxX, element.x + Math.abs(element.width)),
      maxY: Math.max(acc.maxY, element.y + Math.abs(element.height)),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
  const fontSizes = textElements
    .map((element) => element.fontSize)
    .filter((fontSize) => Number.isFinite(fontSize));

  return {
    elementCount: elements.length,
    textCount: textElements.length,
    markdownTextBlockCount,
    rectangleCount: elements.filter((element) => element.type === "rectangle").length,
    arrowCount: elements.filter((element) => element.type === "arrow").length,
    nonTextVectorCount: elements.filter((element) => element.type !== "text").length,
    visibleTextCharacters: textElements.reduce(
      (total, element) => total + (element.rawText || element.text || "").replace(/\s+/g, "").length,
      0,
    ),
    minFontSize: fontSizes.length ? Math.min(...fontSizes) : 0,
    maxFontSize: fontSizes.length ? Math.max(...fontSizes) : 0,
    minX: Math.round(bounds.minX),
    minY: Math.round(bounds.minY),
    maxX: Math.round(bounds.maxX),
    maxY: Math.round(bounds.maxY),
  };
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}-${hash(value).toString(36)}`;
}

interface ExcalidrawInspectionElement {
  id?: unknown;
  type?: unknown;
  isDeleted?: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExcalidrawTextInspectionElement extends ExcalidrawInspectionElement {
  type: "text";
  text?: string;
  rawText?: string;
  fontSize: number;
}

function base(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ExcalidrawBaseElement {
  const nonce = hash(`${id}:nonce`);
  return {
    id,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "#ffffff",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: nonce,
    version: 1,
    versionNonce: nonce,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  };
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function escapeTextElement(value: string): string {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isVisibleExcalidrawElement(value: unknown): value is ExcalidrawInspectionElement {
  if (!value || typeof value !== "object") return false;
  const element = value as Record<string, unknown>;
  return element.isDeleted !== true &&
    typeof element.type === "string" &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number";
}

function isTextInspectionElement(value: ExcalidrawInspectionElement): value is ExcalidrawTextInspectionElement {
  return value.type === "text" &&
    typeof (value as unknown as Record<string, unknown>).fontSize === "number";
}

function countMarkdownTextBlocks(markdown: string): number {
  const section = markdown.match(/## Text Elements\s*([\s\S]*?)\n\s*## Drawing/)?.[1] ?? "";
  return [...section.matchAll(/\^([0-9A-Za-z]{8})\b/g)].length;
}

function normalizeSceneElementIds(scene: ExcalidrawScene): ExcalidrawScene {
  const idMap = new Map<string, string>();
  const usedIds = new Set<string>();
  scene.elements.forEach((element, index) => {
    idMap.set(element.id, uniqueEightCharId(`${element.id}:${index}`, usedIds));
  });

  return {
    ...scene,
    elements: scene.elements.map((element) => {
      const copy = JSON.parse(JSON.stringify(element)) as ExcalidrawElement;
      const mutable = copy as unknown as {
        id: string;
        boundElements?: Array<{ id: string; type?: string }> | null;
        containerId?: string | null;
        frameId?: string | null;
      };
      mutable.id = idMap.get(element.id) ?? uniqueEightCharId(element.id, usedIds);
      if (mutable.boundElements) {
        mutable.boundElements = mutable.boundElements.map((bound) => ({
          ...bound,
          id: idMap.get(bound.id) ?? bound.id,
        }));
      }
      if (mutable.containerId) {
        mutable.containerId = idMap.get(mutable.containerId) ?? mutable.containerId;
      }
      if (mutable.frameId) {
        mutable.frameId = idMap.get(mutable.frameId) ?? mutable.frameId;
      }
      return copy;
    }),
  };
}

function uniqueEightCharId(value: string, usedIds: Set<string>): string {
  let salt = 0;
  let id = eightCharId(value);
  while (usedIds.has(id)) {
    salt += 1;
    id = eightCharId(`${value}:${salt}`);
  }
  usedIds.add(id);
  return id;
}

function eightCharId(value: string): string {
  return hash(value).toString(36).padStart(8, "0").slice(0, 8);
}
