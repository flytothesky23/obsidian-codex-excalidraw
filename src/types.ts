export interface NoteHeading {
  heading: string;
  level: number;
}

export interface NoteLink {
  raw: string;
  target: string;
  display?: string;
  resolvedPath?: string;
}

export interface NoteContext {
  path: string;
  basename: string;
  folder: string;
  content: string;
  headings: NoteHeading[];
  links: NoteLink[];
  tags: string[];
  summary: string;
}

export interface DiagramOptions {
  title: string;
  sourceLabel: string;
  visualTheme: "chalkboard" | "whiteboard";
  handwritingFontFamily: number;
  studyNoteFontScale: number;
  maxHeadingsPerNote: number;
  maxTagsPerNote: number;
  maxLinksPerNote: number;
  includeSummaries: boolean;
}

export interface DiagramBuildResult {
  markdown: string;
  scene: ExcalidrawScene;
  textElementCount: number;
  relationCount: number;
}

export interface ExcalidrawScene {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export type ExcalidrawElement =
  | ExcalidrawRectangleElement
  | ExcalidrawTextElement
  | ExcalidrawArrowElement;

export interface ExcalidrawBaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: null;
  updated: number;
  link: string | null;
  locked: false;
}

export interface ExcalidrawRectangleElement extends ExcalidrawBaseElement {
  type: "rectangle";
}

export interface ExcalidrawTextElement extends ExcalidrawBaseElement {
  type: "text";
  fontSize: number;
  fontFamily: number;
  text: string;
  rawText: string;
  textAlign: "left" | "center";
  verticalAlign: "top" | "middle";
  containerId: null;
  originalText: string;
  lineHeight: number;
  baseline: number;
}

export interface ExcalidrawArrowElement extends ExcalidrawBaseElement {
  type: "arrow";
  points: [number, number][];
  startBinding: null;
  endBinding: null;
  startArrowhead: null;
  endArrowhead: "arrow";
  lastCommittedPoint: null;
  elbowed: false;
}

export interface CanvasBuildResult {
  json: string;
  canvas: JsonCanvas;
  nodeCount: number;
  edgeCount: number;
}

export interface JsonCanvas {
  nodes: JsonCanvasNode[];
  edges: JsonCanvasEdge[];
}

export type JsonCanvasNode = JsonCanvasTextNode | JsonCanvasFileNode | JsonCanvasGroupNode;

export interface JsonCanvasBaseNode {
  id: string;
  type: "text" | "file" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface JsonCanvasTextNode extends JsonCanvasBaseNode {
  type: "text";
  text: string;
}

export interface JsonCanvasFileNode extends JsonCanvasBaseNode {
  type: "file";
  file: string;
  subpath?: string;
}

export interface JsonCanvasGroupNode extends JsonCanvasBaseNode {
  type: "group";
  label?: string;
}

export interface JsonCanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  fromEnd?: "none" | "arrow";
  toNode: string;
  toSide?: "top" | "right" | "bottom" | "left";
  toEnd?: "none" | "arrow";
  color?: string;
  label?: string;
}
