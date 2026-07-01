import type { NoteContext } from "./types";

export const EXCALIDRAW_LIBRARY_REGISTRY_URL =
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries.json";
export const EXCALIDRAW_LIBRARY_RAW_BASE_URL =
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries";

export interface ExcalidrawAssetLibrarySpec {
  name: string;
  source: string;
  domains: string[];
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

const DEFAULT_ASSET_LIBRARY_SOURCES = [
  "youritjang/software-architecture.excalidrawlib",
  "inwardmovement/information-architecture.excalidrawlib",
  "mateuszbaransanok/it-icons.excalidrawlib",
];

const MAX_SELECTED_ASSET_LIBRARIES = 6;

export const EXCALIDRAW_ASSET_LIBRARIES: ExcalidrawAssetLibrarySpec[] = [
  {
    name: "Microsoft Fabric Architecture Icons",
    source: "mwc360/microsoft-fabric-architecture-icons.excalidrawlib",
    domains: ["cloud-data", "microsoft-fabric", "analytics"],
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
    name: "Tools",
    source: "pixelass/tools.excalidrawlib",
    domains: ["construction-site", "field-work", "physical-tools"],
    description:
      "Common physical work tools for construction, maintenance, inspection, and site-work diagrams.",
    keywords: [
      "construction",
      "field",
      "site",
      "tool",
      "tools",
      "hammer",
      "drill",
      "saw",
      "공사",
      "공구",
      "시공",
      "현장",
      "철거",
      "펜스",
      "기초",
      "콘크리트",
      "장비",
      "설비",
      "수량",
      "후속",
      "공사일보",
    ],
    itemNames: [
      "Screws",
      "Nails",
      "Screw",
      "Nail",
      "Screwdriver",
      "Hammer",
      "Drill",
      "Saw",
      "Folding rule",
    ],
  },
  {
    name: "Architecture floor plan symbols",
    source: "Arqtangeles/architecture.excalidrawlib",
    domains: ["construction-site", "floor-plan", "facility-layout"],
    description:
      "Architecture planning symbols useful for site, facility, floor-plan, and building-layout diagrams.",
    keywords: [
      "architecture",
      "floor plan",
      "building",
      "facility",
      "layout",
      "site plan",
      "건축",
      "도면",
      "평면",
      "부지",
      "공장",
      "증축",
      "시설",
      "현장",
      "기숙사",
      "숙소",
      "배치",
    ],
    itemNames: [
      "floor plan",
      "door",
      "window",
      "wall",
      "stairs",
      "table",
      "chair",
      "bed",
      "sink",
      "toilet",
      "plant",
      "site",
    ],
  },
  {
    name: "IT icons",
    source: "mateuszbaransanok/it-icons.excalidrawlib",
    domains: ["evidence-reporting", "media", "general-system"],
    description:
      "Document, image, camera, folder, user, home, chart, cloud, database, and device icons for evidence/report flows.",
    keywords: [
      "document",
      "file",
      "image",
      "camera",
      "photo",
      "report",
      "folder",
      "chart",
      "문서",
      "파일",
      "사진",
      "이미지",
      "보고",
      "일보",
      "검측",
      "체크",
      "회의",
      "자료",
      "증빙",
    ],
    itemNames: [
      "Document",
      "Image",
      "Folder",
      "Camera",
      "User",
      "Home",
      "Pie chart",
      "Bar chart",
      "Cloud",
      "Database",
      "Drive",
      "Server",
      "Device",
      "Settings",
      "Key",
      "Yes",
      "No",
      "Event",
      "Message",
    ],
  },
  {
    name: "System Icons",
    source: "xxxdeveloper/system-icons.excalidrawlib",
    domains: ["status-risk", "workflow", "documentation"],
    description:
      "Status, warning, file, relationship, cleanup, graph, notice, book, picture, and standardization icons.",
    keywords: [
      "warning",
      "risk",
      "status",
      "relationship",
      "notice",
      "standard",
      "cleanup",
      "검토",
      "리스크",
      "위험",
      "주의",
      "품질",
      "안전",
      "관리",
      "관계",
      "표준",
      "정리",
      "확인",
      "검증",
    ],
    itemNames: [
      "document",
      "warn",
      "file",
      "relationship",
      "bar graph",
      "clean up",
      "notice",
      "book",
      "picture",
      "standardization",
      "line-graph",
      "lightning",
      "star",
    ],
  },
  {
    name: "Artem's icons",
    source: "artem-anufrij-live-de/artem-s-icons.excalidrawlib",
    domains: ["workflow", "concept-board", "status-risk"],
    description:
      "Concept-board icons for process, devices, accept/cancel, warning, information, target, question, files, and next steps.",
    keywords: [
      "process",
      "workflow",
      "step",
      "target",
      "question",
      "warning",
      "information",
      "roadmap",
      "프로세스",
      "흐름",
      "단계",
      "질문",
      "로드맵",
      "목표",
      "확인",
      "다음",
      "완료",
      "보류",
    ],
    itemNames: [
      "process",
      "laptop",
      "tablet",
      "smartphone",
      "accept",
      "cancel",
      "server",
      "warning",
      "information",
      "finish",
      "next step",
      "start step",
      "files",
      "folder",
      "important",
      "target",
      "question",
    ],
  },
  {
    name: "Software Architecture",
    source: "youritjang/software-architecture.excalidrawlib",
    domains: ["software-system", "architecture", "runtime"],
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
    domains: ["software-system", "c4", "architecture"],
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
    domains: ["workflow", "information-architecture", "decision"],
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
    domains: ["software-system", "cloud-network", "architecture"],
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
  const defaults = DEFAULT_ASSET_LIBRARY_SOURCES
    .map((source) => EXCALIDRAW_ASSET_LIBRARIES.find((library) => library.source === source))
    .filter((library): library is ExcalidrawAssetLibrarySpec => Boolean(library));
  for (const library of [...selected, ...defaults]) {
    if (!bySource.has(library.source)) {
      bySource.set(library.source, library);
    }
  }
  return [...bySource.values()].slice(0, MAX_SELECTED_ASSET_LIBRARIES);
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
      "No local library cache was prepared. Fall back to editable primitive glyphs only after naming the missing asset need.",
    ].join("\n");
  }

  return [
    "# Excalidraw Asset Libraries",
    "",
    `Registry reference: ${EXCALIDRAW_LIBRARY_REGISTRY_URL}`,
    "The plugin prepared these public Excalidraw `.excalidrawlib` caches as a real asset library, not a moodboard.",
    "",
    "## Library Element Insertion Protocol",
    "- First read the cached `.excalidrawlib` files that match the source domain.",
    "- Prefer exact cached library items over hand-drawn primitive glyphs. Use at least three library items when three source concepts have plausible matches.",
    "- To use a library item, copy that item's editable Excalidraw elements into the target drawing JSON, translate them near the semantic node, and regenerate IDs/groupIds/boundElements as needed.",
    "- Keep imported items editable vectors. Do not paste screenshots, bitmap captures, flattened SVGs, or a single image.",
    "- If fewer than three library items are used, the final response must include `라이브러리 미사용 사유:` for each missing asset category.",
    "- The final response must include `라이브러리 사용:` with library name + item name for every imported or copied item.",
    "",
    "## Clean Connector Contract",
    "- Pick one primary flow direction before drawing: left-to-right or top-to-bottom.",
    "- Use zone gutters and explicit edge ports. Connect from box edges, not from arbitrary text centers.",
    "- Prefer orthogonal/elbow connectors with at most two bends. Avoid diagonal cross-zone spaghetti.",
    "- Arrows must not cross labels, icons, or other arrows. If a line crosses, reroute through a gutter or add a small junction node.",
    "- Use a hub/junction for fan-in or fan-out instead of many arrows converging directly into one crowded box.",
    "",
    ...libraries.flatMap((library) => [
      `## ${library.spec.name}`,
      `Domains: ${library.spec.domains.join(", ")}`,
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
      `- Domains: ${library.spec.domains.join(", ")}`,
      `- Cache path: ${library.path}`,
      `- Source: ${library.rawUrl}`,
      `- Status: ${library.status}${library.error ? ` (${library.error})` : ""}`,
      `- Description: ${library.spec.description}`,
      `- Candidate item names: ${library.itemNames.join(", ")}`,
      "",
    ]),
  ].join("\n");
}
