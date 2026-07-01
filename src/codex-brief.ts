import { truncate } from "./markdown";
import type { NoteContext } from "./types";

export type DrawingBriefMode = "study-note" | "svg-system";

export interface CodexBriefOptions {
  visualTheme?: "chalkboard" | "whiteboard";
  handwritingFontFamily?: number;
  studyNoteFontScale?: number;
  diagramMode?: DrawingBriefMode;
}

export function buildCodexBrief(
  notes: NoteContext[],
  targetPath: string,
  options: CodexBriefOptions = {},
): string {
  const fontScale = clampScale(options.studyNoteFontScale ?? 1);
  const minBodyFont = Math.round(26 * fontScale);
  const minTitleFont = Math.round(48 * fontScale);
  const themeName = options.visualTheme === "whiteboard" ? "clean whiteboard" : "dark green chalkboard";
  const fontFamily = options.handwritingFontFamily ?? 4;
  const diagramMode = options.diagramMode ?? "study-note";
  const noteBlocks = notes
    .map((note) => {
      const headings = note.headings.map((heading) => `${"#".repeat(heading.level)} ${heading.heading}`).join("\n");
      const links = note.links.map((link) => `- ${link.raw} -> ${link.resolvedPath ?? link.target}`).join("\n");
      return [
        `## ${note.path}`,
        note.tags.length ? `Tags: ${note.tags.join(", ")}` : "Tags: none",
        note.summary ? `Summary: ${note.summary}` : "Summary: none",
        headings ? `Headings:\n${headings}` : "Headings: none",
        links ? `Links:\n${links}` : "Links: none",
        "Orientation excerpt only:",
        truncate(note.content.replace(/\s+/g, " "), 700),
      ].join("\n\n");
    })
    .join("\n\n---\n\n");

  const sourcePaths = notes.map((note) => `- ${note.path}`).join("\n");
  const modeSections = diagramMode === "svg-system"
    ? svgSystemModeSections({ minBodyFont, minTitleFont, themeName, fontFamily })
    : studyNoteModeSections({ minBodyFont, minTitleFont, themeName, fontFamily });

  return [
    "# Codex Excalidraw Semantic Drawing Brief",
    "",
    `Target file: ${targetPath}`,
    "",
    "You are editing an Obsidian Excalidraw Markdown drawing from inside the vault root.",
    "The drawing must come from your own reading of the source notes, not from a fixed template.",
    "",
    "# Source Files To Read",
    "",
    "Read these Markdown files from disk before editing the drawing. Do not rely only on the metadata excerpt below.",
    "",
    sourcePaths || "- none",
    "",
    "# Thinking Standard",
    "",
    ...modeSections.thinking,
    "",
    "# Visual Complexity Budget",
    "",
    ...modeSections.budget,
    "",
    "# Excalidraw Requirements",
    "",
    ...modeSections.requirements,
    "",
    "# Metadata For Orientation Only",
    "",
    noteBlocks,
  ].join("\n");
}

function studyNoteModeSections(params: {
  minBodyFont: number;
  minTitleFont: number;
  themeName: string;
  fontFamily: number;
}): { thinking: string[]; budget: string[]; requirements: string[] } {
  return {
    thinking: [
      "Work like a graduate-level teacher writing a clear chalkboard note after reading the material, not like a dashboard generator:",
      "- First infer the note's main thesis, evidence spine, causal/logic chain, tensions, caveats, and decision questions.",
      "- Choose the single simplest visual form, usually a chalkboard-style or whiteboard-style study note, that makes the note easier to understand: one reading question, one core judgment, evidence blocks, counter-interpretation, and next-check/actions.",
      "- Do not use a fixed number of panels. Do not force headings into a preselected dashboard.",
      "- The drawing should omit raw detail but preserve the decision-critical content. Do not reduce a serious analytical note to a generic three-box summary.",
      "- If the source has tables, extract the numbers, contrasts, caveats, and pending checks that change the reader's judgment.",
      "- Every major node should be traceable to actual source content, but do not copy table rows into the canvas.",
      "- Show the relationships a reader needs first: main question -> judgment -> evidence spine -> what could make the judgment wrong -> what to check next.",
      "- If there are multiple notes, synthesize their shared model and disagreement points instead of drawing one card per note.",
      "- If your diagram is harder to read than the Markdown note, simplify before finishing.",
    ],
    budget: [
      "Hard limits unless the user explicitly asks for a full map:",
      "- One screen: target canvas should fit roughly within 2200 x 1850.",
      "- Maximum 10 content boxes, including title and caveat boxes.",
      "- Maximum 7 arrows. Avoid arrow labels except one or two short words.",
      `- Minimum readable text size ${params.minBodyFont} for body text and ${params.minTitleFont} for the main title.`,
      "- Target 650-950 visible Korean characters total across all canvas text.",
      "- No dense bullet blocks, no full tables, no duplicated metadata, no raw block IDs visible on canvas.",
      "- Use whitespace as structure. A sparse chalkboard note is good, but not if it drops the decision-critical evidence.",
    ],
    requirements: [
      ...baseExcalidrawRequirements(),
      "- Replace placeholder or draft drawing content from scratch when it limits the analysis.",
      "- Use editable Excalidraw text, rectangles, arrows, and groups rather than SVG or screenshots.",
      "- Prefer Excalidraw's hand-drawn taste: Korean handwriting via Excalidraw Local Font, chalk/marker-like strokes, slight roughness, and a clear teacher-at-the-board composition.",
      `- Use a ${params.themeName} theme. Do not mix chalkboard and whiteboard in one drawing.`,
      "- Avoid playful bright fills, rainbow colors, decorative mind-map bubbles, and UI-card/dashboard aesthetics.",
      `- Use Excalidraw fontFamily ${params.fontFamily} for Korean handwritten text. Prefer fontFamily 4 when the vault has a Local Font configured.`,
      "- Prefer a round, readable Korean handwriting font such as Gaegu. Do not rely on Virgil for Hangul because Virgil falls back to a non-handwritten Korean system font.",
      "- Hide raw attachment/image paths unless the image itself is meaningfully embedded.",
      "- Keep labels concise enough to read on canvas, but not so compressed that meaning is lost.",
      "- Avoid overlapping elements. If dense, use multiple rows or sections.",
      "- Keep Obsidian wikilinks visible in text labels where helpful.",
      "- The result should help the reader understand the note better than a linear summary would.",
    ],
  };
}

function svgSystemModeSections(params: {
  minBodyFont: number;
  minTitleFont: number;
  themeName: string;
  fontFamily: number;
}): { thinking: string[]; budget: string[]; requirements: string[] } {
  return {
    thinking: [
      "Work in Architecture / SVG-System Diagram Mode, not teacher-board study-note mode:",
      "- Design pass: infer the source domain, real reader question, actors, systems, files/assets, states, dependencies, risks, and verification points before drawing.",
      "- Asset pass: choose a compact editable vector glyph vocabulary inspired by professional SVG/icon libraries: person, device, server, database, cloud, lock/key, file, package, branch, check, warning, gear, globe, terminal, book, chat, calendar, or other source-specific concepts.",
      "- If external or vault-local assets are not available, draw simplified editable glyphs yourself from Excalidraw primitives. Do not paste screenshots or flatten the result into one image.",
      "- Layout pass: choose 1-3 lanes or zones that match the content, such as user -> interface -> agent/runtime -> repository -> verification, or policy -> implementation -> risk -> next check.",
      "- Connection pass: arrows must mean causal flow, data/control flow, dependency, decision, verification, or feedback. Use short relationship labels where they prevent ambiguity.",
      "- Explanation pass: use callouts, numbered step markers, badges, small captions, and legend tags only when they improve comprehension.",
      "- Do not use generic labels such as 정렬, 위계, 간결, 핵심, 정리 unless the source uses those concepts. Name the actual source-specific entity or relationship.",
      "- Do not use a fixed question -> conclusion -> evidence study-note skeleton unless the note itself is analytical prose that needs that skeleton.",
      "- Verification pass: before finishing, inspect the drawing JSON and fix title drift, text overflow, arrows through labels, disconnected nodes, and decorative shapes without meaning.",
    ],
    budget: [
      "Architecture diagram budget unless the user explicitly asks for a large system map:",
      "- One screen: target canvas should fit roughly within 2600 x 1800.",
      "- Use 5-9 semantic nodes plus 3-8 small editable glyph/icon clusters. A glyph can be a simple composed icon, not a separate text-heavy box.",
      "- Use 1-3 visible zones/containers and 2-4 callouts or caption tags.",
      "- Use 6-12 arrows. Every arrow should have an obvious reason; label only ambiguous relationships.",
      `- Minimum readable text size ${params.minBodyFont} for body text and ${params.minTitleFont} for the main title.`,
      "- Target 550-900 visible Korean characters total. Keep individual labels short: about 18 Korean characters per line for node titles and 34 characters per line for body/callout text.",
      "- No raw markdown tables, no duplicated source metadata, no raw block IDs visible on canvas.",
      "- Prefer a memorable architecture/storyboard layout over a row of summary boxes.",
    ],
    requirements: [
      ...baseExcalidrawRequirements(),
      "- Replace placeholder or draft drawing content from scratch when it blocks a true architecture/SVG-system diagram.",
      "- Use editable Excalidraw vector elements: text, rectangles, diamonds, ellipses, lines, arrows, frames/groups, and simple freehand/path-like glyphs where useful.",
      "- You may use common icon-library concepts such as Lucide/Iconify-style line icons as inspiration, but keep the final result editable inside Excalidraw.",
      `- Use a ${params.themeName} theme and keep colors restrained: one neutral base, one primary accent, one risk/warning accent, and one verification/success accent at most.`,
      "- Use whiteboard/architecture clarity before hand-drawn charm. Slight roughness is good; messy handwriting is not.",
      `- Use Excalidraw fontFamily ${params.fontFamily} for Korean text. Prefer fontFamily 4 when the vault has a Local Font configured.`,
      "- Title must be top-left anchored with a visible underline or marker, clear margin, and no overlap with the first node.",
      "- Every text block must sit inside its intended visual region. Insert manual line breaks before text reaches the shape edge.",
      "- Avoid arrows crossing through labels. Route arrows around boxes or use elbows/offsets when needed.",
      "- Include source-specific wikilinks only when they are useful labels, not as raw path clutter.",
      "- In the final response, report counts for zones, glyph/icon clusters, semantic nodes, arrows, callouts, and whether overlap/text overflow was checked.",
    ],
  };
}

function baseExcalidrawRequirements(): string[] {
  return [
    "- Preserve the Excalidraw Markdown structure: `# Excalidraw Data`, `## Text Elements`, and `## Drawing` with JSON.",
    "- Put the whole Excalidraw data section inside one Obsidian comment block: `%%` before `# Excalidraw Data` and the closing `%%` after the drawing JSON fence.",
    "- Every visible text element must have exactly one matching entry in `## Text Elements`.",
    "- Excalidraw text element IDs and their Markdown block IDs must match exactly and must be 8 ASCII letters/digits, e.g. `^tTitle01`. Never use IDs like `^t_sales` or any block ID longer/shorter than 8 characters.",
    "- Do not leave raw Markdown block IDs visible as canvas text. Block IDs belong only after Text Elements entries.",
  ];
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1.5, Math.max(0.75, Math.round(value * 100) / 100));
}
