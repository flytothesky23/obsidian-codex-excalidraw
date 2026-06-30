import { truncate } from "./markdown";
import type { NoteContext } from "./types";

export function buildCanvasBrief(notes: NoteContext[], targetPath: string): string {
  const sourcePaths = notes.map((note) => `- ${note.path}`).join("\n");
  const sourceOverview = notes
    .map((note) => {
      const headings = note.headings
        .slice(0, 12)
        .map((heading) => `${"#".repeat(heading.level)} ${heading.heading}`)
        .join("\n");
      return [
        `## ${note.path}`,
        note.summary ? `Summary: ${note.summary}` : "Summary: none",
        headings ? `Headings:\n${headings}` : "Headings: none",
        `Excerpt: ${truncate(note.content.replace(/\s+/g, " "), 1000)}`,
      ].join("\n\n");
    })
    .join("\n\n---\n\n");

  return [
    "# Obsidian Canvas Generation Brief",
    "",
    `Target canvas: ${targetPath}`,
    "",
    "You are editing an Obsidian JSON Canvas file from inside the vault root.",
    "This task intentionally follows the video workflow: Canvas files are plain JSON, so the AI should directly read, rearrange, recolor, and complete the canvas.",
    "",
    "# Source Files To Read",
    "",
    "Read these Markdown files from disk before editing the canvas. Do not rely only on the excerpt.",
    "",
    sourcePaths || "- none",
    "",
    "# Required Canvas Behavior",
    "",
    "- Edit only the exact target `.canvas` JSON file named above.",
    "- Do not create a second `.canvas` file anywhere else in the vault. If the target is not writable, stop and report the write failure.",
    "- Preserve valid JSON Canvas 1.0 shape: top-level `nodes` and `edges` arrays.",
    "- Use node types `text`, `file`, and `group`; use `file` nodes to keep source notes openable inside Obsidian.",
    "- Generate 16-character lowercase hex IDs for every node and edge.",
    "- Every edge must reference existing node IDs through `fromNode` and `toNode`.",
    "- Use `x`, `y`, `width`, and `height` to make the layout readable without overlap at normal Obsidian Canvas zoom.",
    "- Use preset colors `1`-`6` to distinguish thesis, evidence, risk, action, and source files.",
    "- Use groups for major zones when useful.",
    "- Every text node must contain useful Korean reading text, not placeholder symbols, empty lines, or decorative filler.",
    "",
    "# Thinking Standard",
    "",
    "- Do not make a decorative diagram. Make a working thinking canvas.",
    "- Extract the source note's main question, current judgment, evidence spine, uncertainty, and next action according to the note's own domain.",
    "- If there are multiple notes, synthesize the shared model and connect source file nodes to the concept nodes they support.",
    "- If the current canvas is a rough sketch, keep useful user nodes and expand them into a coherent structure.",
    "- If nodes are scattered, auto-layout them into clear lanes or clusters.",
    "- If the canvas is harder to read than the note, reduce the node count, enlarge node dimensions, and improve labels.",
    "",
    "# Output Standard",
    "",
    "- Do not create Excalidraw Markdown for this task.",
    "- Do not create SVG, PNG, or HTML unless explicitly asked.",
    "- Keep text inside Canvas text nodes concise and Markdown-friendly.",
    "- Minimum acceptable result: 4+ meaningful text nodes, 1+ source file node, and connected edges that explain source -> question -> judgment -> evidence -> caveat -> next check.",
    "- After editing, report what visual structure you created and which source notes anchor the important nodes.",
    "",
    "# Orientation Metadata",
    "",
    sourceOverview,
  ].join("\n");
}
