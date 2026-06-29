import { describe, expect, it } from "vitest";
import { buildNoteContext, extractHeadings, extractTags, extractWikiLinks, stripNonNarrativeMarkdown } from "../src/markdown";

describe("markdown context extraction", () => {
  it("extracts headings, tags, links, and summary", () => {
    const markdown = [
      "---",
      "tags:",
      "  - project",
      "---",
      "# Agent OS",
      "",
      "This note explains the loop between [[Goals]] and [[Memory|agent memory]]. #ai/agent",
      "",
      "## Loop",
      "Details.",
    ].join("\n");

    const context = buildNoteContext({ path: "Systems/Agent OS.md", content: markdown });

    expect(context.basename).toBe("Agent OS");
    expect(context.headings.map((heading) => heading.heading)).toEqual(["Agent OS", "Loop"]);
    expect(context.links.map((link) => link.target)).toEqual(["Goals", "Memory"]);
    expect(context.tags).toContain("#ai/agent");
    expect(context.summary).toContain("This note explains");
  });

  it("ignores frontmatter and fenced code during extraction", () => {
    const cleaned = stripNonNarrativeMarkdown("---\ntitle: X\n---\n```ts\n# fake\n```\n# Real");
    expect(extractHeadings(cleaned)).toEqual([{ heading: "Real", level: 1 }]);
  });

  it("deduplicates wiki links and tags", () => {
    expect(extractWikiLinks("[[A]] [[A]] [[A|Shown]]").map((link) => link.raw)).toEqual([
      "[[A]]",
      "[[A|Shown]]",
    ]);
    expect(extractTags("#one #one #two")).toEqual(["#one", "#two"]);
  });
});
