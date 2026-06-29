import { truncate } from "./markdown";
import type { NoteContext } from "./types";

export function buildCodexBrief(notes: NoteContext[], targetPath: string): string {
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
    "",
    "# Visual Complexity Budget",
    "",
    "Hard limits unless the user explicitly asks for a full map:",
    "- One screen: target canvas should fit roughly within 1700 x 1350.",
    "- Maximum 10 content boxes, including title and caveat boxes.",
    "- Maximum 7 arrows. Avoid arrow labels except one or two short words.",
    "- Minimum readable text size 20-22 for body text and 36 for the main title.",
    "- Target 850-1200 visible Korean characters total across all canvas text.",
    "- No dense bullet blocks, no full tables, no duplicated metadata, no raw block IDs visible on canvas.",
    "- Use whitespace as structure. A sparse chalkboard note is good, but not if it drops the decision-critical evidence.",
    "",
    "# Excalidraw Requirements",
    "",
    "- Preserve the Excalidraw Markdown structure: `# Excalidraw Data`, `## Text Elements`, and `## Drawing` with JSON.",
    "- Put the whole Excalidraw data section inside one Obsidian comment block: `%%` before `# Excalidraw Data` and the closing `%%` after the drawing JSON fence.",
    "- Every visible text element must have exactly one matching entry in `## Text Elements`.",
    "- Excalidraw text element IDs and their Markdown block IDs must match exactly and must be 8 ASCII letters/digits, e.g. `^tTitle01`. Never use IDs like `^t_sales` or any block ID longer/shorter than 8 characters.",
    "- Do not leave raw Markdown block IDs visible as canvas text. Block IDs belong only after Text Elements entries.",
    "- Replace placeholder or draft drawing content from scratch when it limits the analysis.",
    "- Use editable Excalidraw text, rectangles, arrows, and groups rather than SVG or screenshots.",
    "- Prefer Excalidraw's hand-drawn taste: Korean handwriting via Excalidraw Local Font, chalk/marker-like strokes, slight roughness, and a clear teacher-at-the-board composition.",
    "- Use either a dark green chalkboard theme or a clean whiteboard theme. Do not mix both in one drawing.",
    "- Avoid playful bright fills, rainbow colors, decorative mind-map bubbles, and UI-card/dashboard aesthetics.",
    "- Use Excalidraw fontFamily 4 for Korean handwritten text when the vault has a Local Font configured. Prefer a round, readable Korean handwriting font such as Gaegu. Do not rely on Virgil for Hangul because Virgil falls back to a non-handwritten Korean system font.",
    "- Hide raw attachment/image paths unless the image itself is meaningfully embedded.",
    "- Keep labels concise enough to read on canvas, but not so compressed that meaning is lost.",
    "- Avoid overlapping elements. If dense, use multiple rows or sections.",
    "- Keep Obsidian wikilinks visible in text labels where helpful.",
    "- The result should help the reader understand the note better than a linear summary would.",
    "",
    "# Metadata For Orientation Only",
    "",
    noteBlocks,
  ].join("\n");
}
