import type { NoteContext, NoteHeading, NoteLink } from "./types";

const FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*\n?/;
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const COMMENT_RE = /%%[\s\S]*?%%/g;
const WIKI_LINK_RE = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?]]/g;
const TAG_RE = /(^|\s)#([A-Za-z가-힣0-9_/-]+)/g;

export function buildNoteContext(input: {
  path: string;
  content: string;
  basename?: string;
  folder?: string;
  headings?: NoteHeading[];
  links?: NoteLink[];
  tags?: string[];
}): NoteContext {
  const basename = input.basename ?? basenameFromPath(input.path);
  const folder = input.folder ?? folderFromPath(input.path);
  const content = input.content;
  const cleaned = stripNonNarrativeMarkdown(content);

  return {
    path: input.path,
    basename,
    folder,
    content,
    headings: normalizeHeadings(input.headings ?? extractHeadings(cleaned)),
    links: input.links ?? extractWikiLinks(cleaned),
    tags: normalizeTags(input.tags ?? extractTags(cleaned)),
    summary: summarizeMarkdown(cleaned),
  };
}

export function stripNonNarrativeMarkdown(markdown: string): string {
  return markdown
    .replace(FRONTMATTER_RE, "")
    .replace(CODE_BLOCK_RE, "")
    .replace(COMMENT_RE, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/!\[\[[^\]]+]]/g, "")
    .replace(/^!\S+\.(png|jpe?g|gif|webp|svg)\s*$/gim, "")
    .trim();
}

export function extractHeadings(markdown: string): NoteHeading[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,6})\s+(.+?)\s*#*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      level: match[1].length,
      heading: match[2].trim(),
    }));
}

export function extractWikiLinks(markdown: string): NoteLink[] {
  const links: NoteLink[] = [];
  for (const match of markdown.matchAll(WIKI_LINK_RE)) {
    const target = match[1].trim();
    links.push({
      raw: match[0],
      target,
      display: match[2]?.trim(),
    });
  }
  return dedupeBy(links, (link) => `${link.target}|${link.display ?? ""}`);
}

export function extractTags(markdown: string): string[] {
  const tags: string[] = [];
  for (const match of markdown.matchAll(TAG_RE)) {
    tags.push(`#${match[2]}`);
  }
  return normalizeTags(tags);
}

export function summarizeMarkdown(markdown: string, maxLength = 220): string {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^>\s*\[![^\]]+]\s*/, "")
        .replace(/^>\s?/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/\[\[([^\]|]+)\|?([^\]]+)?]]/g, (_, target, display) => display || target)
        .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
        .trim(),
    )
    .filter((line) => Boolean(line) && !line.startsWith("|") && !line.match(/^:?-{3,}:?/));

  const paragraph = lines.find((line) => line.length > 24) ?? lines[0] ?? "";
  return truncate(paragraph, maxLength);
}

export function normalizeTags(tags: string[]): string[] {
  return dedupeBy(
    tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
    (tag) => tag.toLowerCase(),
  );
}

export function normalizeHeadings(headings: NoteHeading[]): NoteHeading[] {
  return headings
    .map((heading) => ({
      heading: heading.heading.trim(),
      level: Math.min(Math.max(heading.level, 1), 6),
    }))
    .filter((heading) => heading.heading.length > 0);
}

export function basenameFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
}

export function folderFromPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
