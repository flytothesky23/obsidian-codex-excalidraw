import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Codex drawing panel entry points", () => {
  const pluginSource = readFileSync("src/plugin.ts", "utf8");
  const settingsSource = readFileSync("src/settings.ts", "utf8");
  const stylesSource = readFileSync("styles.css", "utf8");

  it("opens the side panel from the visible ribbon icon", () => {
    expect(pluginSource).toContain('addRibbonIcon("panel-right-open", "Open Codex drawing panel"');
    expect(pluginSource).toContain("void this.openCodexPanel();");
  });

  it("auto-opens the side panel after Obsidian layout is ready", () => {
    expect(settingsSource).toContain("autoOpenPanel: boolean");
    expect(settingsSource).toContain("autoOpenPanel: true");
    expect(pluginSource).toContain("this.app.workspace.onLayoutReady");
    expect(pluginSource).toContain("this.settings.autoOpenPanel");
    expect(pluginSource).toContain("void this.openCodexPanel(false)");
  });

  it("exposes chat and Codexian handoff actions in the side panel", () => {
    expect(pluginSource).toContain("runCodexChat");
    expect(pluginSource).toContain("openActiveFileInCodexian");
    expect(pluginSource).toContain("Codex 대화창");
    expect(pluginSource).toContain("Codex 입력");
    expect(pluginSource).toContain("대화 보내기");
    expect(pluginSource).toContain("Codexian 열기");
    expect(pluginSource).toContain("getCodexRuntimeSummary");
  });

  it("makes chat output copyable and selectable", () => {
    expect(pluginSource).toContain("전체 복사");
    expect(pluginSource).toContain("copyText");
    expect(pluginSource).toContain("chatTranscript");
    expect(stylesSource).toContain("user-select: text");
    expect(stylesSource).toContain("overflow-wrap: anywhere");
  });

  it("exposes runtime controls and progress state in the panel", () => {
    expect(pluginSource).toContain("작업 상태");
    expect(pluginSource).toContain("progressPercent");
    expect(pluginSource).toContain("런타임");
    expect(pluginSource).toContain("모델");
    expect(pluginSource).toContain("추론");
    expect(pluginSource).toContain("제한");
  });

  it("keeps dense controls inside modals instead of expanding them in the side panel", () => {
    expect(pluginSource).toContain("PanelRuntimeStyleModal");
    expect(pluginSource).toContain("PanelPromptToolsModal");
    expect(pluginSource).toContain("PanelActionModal");
    expect(pluginSource).toContain("preparePanelModal");
    expect(pluginSource).toContain("codex-excalidraw-panel-toolbar");
    expect(pluginSource).toContain("codex-excalidraw-panel-composer-bar");
    expect(stylesSource).toContain("codex-excalidraw-config-modal");
    expect(stylesSource).toContain("codex-excalidraw-modal-card");
  });

  it("prevents prompt/action modal cards from collapsing into overlapping button rows", () => {
    expect(stylesSource).toContain("codex-excalidraw-config-modal-shell.modal");
    expect(stylesSource).toContain("button.codex-excalidraw-modal-card");
    expect(stylesSource).toContain("height: auto");
    expect(stylesSource).toContain("white-space: normal");
    expect(stylesSource).toContain("overflow: visible");
    expect(stylesSource).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(stylesSource).toContain("codex-excalidraw-modal-card-body");
    expect(stylesSource).toContain("codex-excalidraw-modal-card-action");
  });

  it("shows Codex CLI phase progress like reading, thinking, editing, and verifying", () => {
    expect(pluginSource).toContain("PanelPhase");
    expect(pluginSource).toContain("PANEL_PHASES");
    expect(pluginSource).toContain("읽기");
    expect(pluginSource).toContain("생각중");
    expect(pluginSource).toContain("편집");
    expect(pluginSource).toContain("검증");
    expect(pluginSource).toContain("inferCodexPhase");
    expect(pluginSource).toContain("ingestCodexChunk");
    expect(stylesSource).toContain("codex-excalidraw-panel-phase-rail");
    expect(stylesSource).toContain("codex-excalidraw-panel-activity");
  });

  it("uses Codexian settings as the default runtime source", () => {
    expect(settingsSource).toContain('codexSettingsSource: "codexian"');
    expect(settingsSource).toContain("Codexian settings (recommended)");
  });

  it("uses a longer default timeout for Codex canvas generation", () => {
    expect(settingsSource).toContain("codexTimeoutSeconds: 600");
    expect(pluginSource).toContain("this.settings.codexTimeoutSeconds <= 180");
  });

  it("shows elapsed progress while Codex is running", () => {
    expect(pluginSource).toContain("startProgress");
    expect(pluginSource).toContain("updateProgressStatus");
    expect(pluginSource).toContain("경과");
  });

  it("protects Markdown source notes by routing rewrite requests to a copy", () => {
    expect(pluginSource).toContain("Never modify a Markdown source note in place");
    expect(pluginSource).toContain("createMarkdownRevisionCopy");
    expect(pluginSource).toContain("shouldCreateMarkdownRevisionCopy");
    expect(pluginSource).toContain("_수정");
    expect(pluginSource).toContain("원본 노트는 수정하지 않았습니다");
    expect(pluginSource).toContain("수정 사본:");
  });

  it("surfaces generated output paths with open and copy actions", () => {
    expect(pluginSource).toContain("formatActionOutput");
    expect(pluginSource).toContain("결과 파일:");
    expect(pluginSource).toContain("lastOutputPath");
    expect(pluginSource).toContain("결과 열기");
    expect(pluginSource).toContain("경로 복사");
    expect(stylesSource).toContain("codex-excalidraw-panel-output-path");
  });
});
