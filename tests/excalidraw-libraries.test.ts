import { describe, expect, it } from "vitest";
import {
  excalidrawLibraryCacheName,
  excalidrawLibraryRawUrl,
  formatExcalidrawAssetLibraryBrief,
  selectExcalidrawAssetLibraries,
  summarizeExcalidrawLibraryItems,
} from "../src/excalidraw-libraries";
import { buildNoteContext } from "../src/markdown";

describe("Excalidraw asset library selection", () => {
  it("selects Microsoft Fabric icons for Fabric/data architecture notes", () => {
    const libraries = selectExcalidrawAssetLibraries([
      buildNoteContext({
        path: "Roadmap/Fabric.md",
        content: "# Fabric data roadmap\nOneLake, Warehouse, Power BI, Notebook, Python, GitHub 흐름을 설계한다.",
      }),
    ]);

    expect(libraries.map((library) => library.name)).toContain("Microsoft Fabric Architecture Icons");
    const fabric = libraries.find((library) => library.name === "Microsoft Fabric Architecture Icons");
    expect(fabric ? excalidrawLibraryRawUrl(fabric) : "").toContain(
      "mwc360/microsoft-fabric-architecture-icons.excalidrawlib",
    );
    expect(fabric ? excalidrawLibraryCacheName(fabric) : "").toBe(
      "mwc360-microsoft-fabric-architecture-icons.excalidrawlib",
    );
  });

  it("keeps generic architecture and information libraries available as fallback vocabulary", () => {
    const libraries = selectExcalidrawAssetLibraries([
      buildNoteContext({
        path: "Odysseus/05 한글화 로드맵.md",
        content: "# 한글화 로드맵\nCodex CLI 설치, OAuth 로그인, 보안 주의, Windows 안내를 정리한다.",
      }),
    ]);
    const names = libraries.map((library) => library.name);

    expect(names).toContain("Software Architecture");
    expect(names).toContain("Information Architecture");
  });

  it("selects field-work and evidence libraries for construction daily notes", () => {
    const libraries = selectExcalidrawAssetLibraries([
      buildNoteContext({
        path: "공사일보/2026-06-30_지수면_지수로708_공장증축공사_공사일보.md",
        content: "# 공장증축 공사일보\n현장사진 8장, 기초 콘크리트, 펜스, 전기설비 안전거리, 관리 체크, 후속 부대공사 일정을 검토한다.",
      }),
    ]);
    const names = libraries.map((library) => library.name);

    expect(names).toContain("Tools");
    expect(names).toContain("Architecture floor plan symbols");
    expect(names).toContain("IT icons");
    expect(names).toContain("System Icons");
  });

  it("summarizes v2 excalidraw library item names for Codex prompts", () => {
    const itemNames = summarizeExcalidrawLibraryItems(
      JSON.stringify({
        type: "excalidrawlib",
        version: 2,
        libraryItems: [
          { name: "Fabric" },
          { name: "OneLake" },
        ],
      }),
      ["fallback"],
    );

    expect(itemNames).toEqual(["Fabric", "OneLake"]);
  });

  it("formats cached libraries as a readable prompt section", () => {
    const [spec] = selectExcalidrawAssetLibraries([
      buildNoteContext({ path: "Fabric.md", content: "Power BI와 OneLake" }),
    ]);

    const brief = formatExcalidrawAssetLibraryBrief([
      {
        spec,
        path: "Codex Maps/_libraries/fabric.excalidrawlib",
        rawUrl: excalidrawLibraryRawUrl(spec),
        itemNames: ["Fabric", "OneLake", "Power BI"],
        status: "downloaded",
      },
    ]);

    expect(brief).toContain("# Excalidraw Asset Libraries");
    expect(brief).toContain("Library Element Insertion Protocol");
    expect(brief).toContain("Clean Connector Contract");
    expect(brief).toContain("라이브러리 사용:");
    expect(brief).toContain("Cache path: Codex Maps/_libraries/fabric.excalidrawlib");
    expect(brief).toContain("Candidate item names: Fabric, OneLake, Power BI");
  });
});
