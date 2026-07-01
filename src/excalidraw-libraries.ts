import type { NoteContext } from "./types";

export const EXCALIDRAW_LIBRARY_REGISTRY_URL =
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json";
export const EXCALIDRAW_LIBRARY_RAW_BASE_URL =
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries";

export interface ExcalidrawAssetLibrarySpec {
  name: string;
  source: string;
  description: string;
  keywords: string[];
  itemNames: string[];
}

export interface CachedExcalidrawAssetLibrary {
  spec: ExcalidrawAssetLibrarySpec;
  path: string;
  rawUrl: string;
  itemNames: string[];
  status: "cached" | "downloaded" | "catalog-only" | "failed";
  error?: string;
}

export const EXCALIDRAW_ASSET_LIBRARIES: ExcalidrawAssetLibrarySpec[] = [
  {
    name: "Microsoft Fabric Architecture Icons",
    source: "mwc360/microsoft-fabric-architecture-icons.excalidrawlib",
    description:
      "Microsoft Fabric workloads, data items, file types, data sources, developer tools, GitHub, Python, Power BI, Copilot, and Users.",
    keywords: [
      "fabric",
      "microsoft fabric",
      "onelake",
      "power bi",
      "copilot",
      "warehouse",
      "lakehouse",
      "data factory",
      "semantic model",
      "spark",
      "python",
      "github",
      "data",
      "데이터",
      "웨어하우스",
      "레이크하우스",
    ],
    itemNames: [
      "Fabric",
      "OneLake",
      "Data Warehouse",
      "Data Engineering",
      "Data Factory",
      "Real-Time Intelligence",
      "Data Science",
      "Databases",
      "Power BI",
      "Copilot",
      "Lakehouse",
      "Warehouse",
      "Pipeline",
      "Notebook",
      "Dashboard",
      "Report",
      "Semantic Model",
      "Key Vault",
      "VS Code",
      "Python",
      "GIT",
      "Github",
      "Repo",
      "Branch",
      "Developer",
      "Users",
    ],
  },
  {
    name: "Software Architecture",
    source: "youritjang/software-architecture.excalidrawlib",
    description:
      "Generic software architecture components such as microservice, database, cache, event bus, pipeline, documents, and code.",
    keywords: [
      "architecture",
      "system",
      "software",
      "server",
      "database",
      "api",
      "cli",
      "agent",
      "plugin",
      "runtime",
      "oauth",
      "security",
      "repo",
      "시스템",
      "아키텍처",
      "보안",
      "플러그인",
    ],
    itemNames: [
      "user",
      "frontend",
      "service",
      "microservice",
      "database",
      "cache",
      "queue",
      "event bus",
      "pipeline",
      "document",
      "code",
      "terminal",
      "lock",
      "cloud",
    ],
  },
  {
    name: "C4 Architecture",
    source: "dmitry-burnyshev/c4-architecture.excalidrawlib",
    description:
      "C4 model visual vocabulary for person, software system, container, component, database, group, and relation diagrams.",
    keywords: [
      "c4",
      "component",
      "container",
      "system context",
      "person",
      "relation",
      "workflow",
      "flow",
      "구성",
      "관계",
      "흐름",
    ],
    itemNames: [
      "Person",
      "Web App",
      "Mobile App",
      "Component",
      "System",
      "Existing System",
      "Database",
      "Group",
      "Relation",
    ],
  },
  {
    name: "Information Architecture",
    source: "inwardmovement/information-architecture.excalidrawlib",
    description:
      "Information architecture and interaction design shapes such as page, file, stack, cluster, decision point, and conditional branch.",
    keywords: [
      "document",
      "file",
      "page",
      "decision",
      "branch",
      "navigation",
      "roadmap",
      "workflow",
      "문서",
      "파일",
      "판단",
      "분기",
      "로드맵",
    ],
    itemNames: [
      "page",
      "file",
      "flow reference",
      "page stack",
      "file stack",
      "cluster",
      "decision point",
      "conditional branch",
      "conditional selector",
      "concurrent set",
    ],
  },
  {
    name: "Architecture diagram components",
    source: "anna-pastushko/architecture-diagram-components.excalidrawlib",
    description:
      "Common architecture diagram components such as Slack, Docker, GitHub, VPC, subnets, User, Device, and Server.",
    keywords: [
      "docker",
      "github",
      "vpc",
      "subnet",
      "device",
      "server",
      "cloud",
      "network",
      "windows",
      "terminal",
      "설치",
      "네트워크",
    ],
    itemNames: [
      "Slack",
      "Docker",
      "GitHub",
      "VPC",
      "Private subnet",
      "Public subnet",
      "User",
      "Users",
      "Device",
      "Server",
    ],
  },
];

export function selectExcalidrawAssetLibraries(notes: NoteContext[]): ExcalidrawAssetLibrarySpec[] {
  const haystack = notes
    .map((note) => `${note.path}\n${note.basename}\n${note.tags.join(" ")}\n${note.headings.map((heading) => heading.heading).join(" ")}\n${note.summary}\n${note.content}`)
    .join("\n")
    .toLowerCase();
  const selected = EXCALIDRAW_ASSET_LIBRARIES.filter((library) =>
    library.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  );
  const bySource = new Map<string, ExcalidrawAssetLibrarySpec>();
  for (const library of [...selected, EXCALIDRAW_ASSET_LIBRARIES[1], EXCALIDRAW_ASSET_LIBRARIES[3]]) {
    bySource.set(library.source, library);
  }
  return [...bySource.values()].slice(0, 4);
}

export function excalidrawLibraryRawUrl(library: ExcalidrawAssetLibrarySpec): string {
  return `${EXCALIDRAW_LIBRARY_RAW_BASE_URL}/${library.source}`;
}

export function excalidrawLibraryCacheName(library: ExcalidrawAssetLibrarySpec): string {
  return library.source
    .replace(/\.excalidrawlib$/i, "")
    .replace(/[^0-9A-Za-z가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "") + ".excalidrawlib";
}

export function summarizeExcalidrawLibraryItems(raw: string, fallback: string[]): string[] {
  try {
    const parsed = JSON.parse(raw) as {
      libraryItems?: Array<{ name?: unknown }>;
      library?: Array<{ name?: unknown }>;
    };
    const items = Array.isArray(parsed.libraryItems) ? parsed.libraryItems : parsed.library;
    const names = Array.isArray(items)
      ? items.map((item) => item.name).filter((name): name is string => typeof name === "string" && name.trim().length > 0)
      : [];
    return names.length ? names.slice(0, 80) : fallback;
  } catch {
    return fallback;
  }
}

export function formatExcalidrawAssetLibraryBrief(libraries: CachedExcalidrawAssetLibrary[]): string {
  if (!libraries.length) {
    return [
      "# Excalidraw Asset Libraries",
      "",
      "No local library cache was prepared. Fall back to editable primitive glyphs.",
    ].join("\n");
  }

  return [
    "# Excalidraw Asset Libraries",
    "",
    `Registry reference: ${EXCALIDRAW_LIBRARY_REGISTRY_URL}`,
    "The plugin prepared these public Excalidraw `.excalidrawlib` caches. Read them when an exact icon helps, otherwise draw a simplified editable glyph inspired by their item names.",
    "Use these libraries as visual vocabulary sources, not as a reason to paste a screenshot or make the drawing non-editable.",
    "",
    ...libraries.flatMap((library) => [
      `## ${library.spec.name}`,
      `Cache path: ${library.path}`,
      `Source: ${library.rawUrl}`,
      `Status: ${library.status}${library.error ? ` (${library.error})` : ""}`,
      `Use when: ${library.spec.description}`,
      `Candidate item names: ${library.itemNames.slice(0, 36).join(", ")}`,
      "",
    ]),
  ].join("\n");
}

export function buildExcalidrawAssetCatalogMarkdown(libraries: CachedExcalidrawAssetLibrary[]): string {
  return [
    "# Codex Excalidraw Asset Library Cache",
    "",
    `Registry: ${EXCALIDRAW_LIBRARY_REGISTRY_URL}`,
    "",
    ...libraries.flatMap((library) => [
      `## ${library.spec.name}`,
      `- Cache path: ${library.path}`,
      `- Source: ${library.rawUrl}`,
      `- Status: ${library.status}${library.error ? ` (${library.error})` : ""}`,
      `- Description: ${library.spec.description}`,
      `- Candidate item names: ${library.itemNames.join(", ")}`,
      "",
    ]),
  ].join("\n");
}
