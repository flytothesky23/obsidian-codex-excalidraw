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

  it("exposes chat while keeping Codexian handoff internal instead of a composer shortcut", () => {
    expect(pluginSource).toContain("runCodexChat");
    expect(pluginSource).toContain("openActiveFileInCodexian");
    expect(pluginSource).toContain("Codex 대화창");
    expect(pluginSource).toContain("Codex 입력");
    expect(pluginSource).toContain("대화 보내기");
    expect(pluginSource).toContain("getCodexRuntimeSummary");
    expect(pluginSource).not.toContain('"Codexian", () =>');
    expect(pluginSource).not.toContain("Codexian 열기");
  });

  it("makes chat output copyable and selectable", () => {
    expect(pluginSource).toContain("전체 복사");
    expect(pluginSource).toContain("copyText");
    expect(pluginSource).toContain("chatTranscript");
    expect(pluginSource).not.toContain('this.addButton(messageHead, "복사"');
    expect(stylesSource).toContain("user-select: text");
    expect(stylesSource).toContain("overflow-wrap: anywhere");
  });

  it("can clear a completed chat session from the header", () => {
    expect(pluginSource).toContain("resetChatSession");
    expect(pluginSource).toContain("대화 세션 초기화");
    expect(pluginSource).toContain("this.messages = []");
    expect(pluginSource).toContain('this.currentPhase = "idle"');
    expect(pluginSource).toContain("this.lastOutputPath = \"\"");
  });

  it("keeps chat scrolling natural while preserving user-selected scroll position", () => {
    expect(pluginSource).toContain("shouldAutoScrollChat");
    expect(pluginSource).toContain("forceNextChatScroll");
    expect(pluginSource).toContain("scheduleRender");
    expect(pluginSource).toContain("cancelScheduledRender");
    expect(pluginSource).toContain("window.requestAnimationFrame");
    expect(pluginSource).toContain("chat.scrollTo");
    expect(pluginSource).toContain("if (!chat.isConnected) return");
    expect(pluginSource).toContain("current.scrollTop + current.clientHeight >= current.scrollHeight - 96");
    expect(stylesSource).toContain("scroll-behavior: smooth");
    expect(stylesSource).toContain("overflow-anchor: none");
    expect(stylesSource).toContain("contain: layout paint");
  });

  it("exposes runtime controls and agent progress state in the chat stream", () => {
    expect(pluginSource).toContain("renderAgentEvent");
    expect(pluginSource).toContain("agentSubtitle");
    expect(pluginSource).toContain("agentStatusTitle");
    expect(pluginSource).toContain("progressPercent");
    expect(pluginSource).toContain("런타임");
    expect(pluginSource).toContain("모델");
    expect(pluginSource).toContain("추론");
    expect(pluginSource).toContain("제한");
    expect(settingsSource).toContain("CODEX_MODEL_OPTIONS");
    expect(settingsSource).toContain("gpt-5.3-codex-spark");
    expect(pluginSource).toContain("codex-excalidraw-runtime-grid");
    expect(pluginSource).toContain("codex-excalidraw-runtime-select");
    expect(stylesSource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(stylesSource).toContain("codex-excalidraw-runtime-card");
  });

  it("keeps dense controls inside modals instead of expanding them in the side panel", () => {
    expect(pluginSource).toContain("PanelRuntimeStyleModal");
    expect(pluginSource).toContain("PanelPromptToolsModal");
    expect(pluginSource).toContain("PanelActionModal");
    expect(pluginSource).toContain("preparePanelModal");
    expect(pluginSource).toContain("codex-excalidraw-panel-toolbar");
    expect(pluginSource).toContain("codex-excalidraw-panel-composer-bar");
    expect(pluginSource).toContain('"모델", () =>');
    expect(pluginSource).toContain('"드로잉 / Canvas 작업"');
    expect(stylesSource).toContain("codex-excalidraw-config-modal");
    expect(stylesSource).toContain("codex-excalidraw-modal-card");
  });

  it("uses categorized prompt pickers instead of exposing every prompt at once", () => {
    expect(pluginSource).toContain("CODEX_PROMPT_CATEGORIES");
    expect(pluginSource).toContain("selectedCategory");
    expect(pluginSource).toContain("codex-excalidraw-prompt-picker");
    expect(pluginSource).toContain("codex-excalidraw-picker-controls");
    expect(pluginSource).toContain("codex-excalidraw-preset-preview");
    expect(pluginSource).toContain("buildInstruction");
    expect(pluginSource).toContain("노트의 도메인을 먼저 판별");
    expect(stylesSource).toContain("codex-excalidraw-picker-field select");
    expect(stylesSource).toContain("codex-excalidraw-preset-meta");
    expect(stylesSource).toContain("codex-excalidraw-preset-instruction");
  });

  it("shows action choices as output-aware cards with result previews and storage hints", () => {
    expect(pluginSource).toContain("PANEL_ACTION_CARDS");
    expect(pluginSource).toContain("codex-excalidraw-action-grid");
    expect(pluginSource).toContain("codex-excalidraw-action-badge");
    expect(pluginSource).toContain("codex-excalidraw-action-preview");
    expect(pluginSource).toContain("getOutputFolderForAction");
    expect(pluginSource).toContain("저장:");
    expect(pluginSource).toContain("Excalidraw");
    expect(pluginSource).toContain("Canvas");
    expect(stylesSource).toContain("button.codex-excalidraw-action-card");
    expect(stylesSource).toContain("codex-excalidraw-action-footer");
    expect(stylesSource).toContain("text-overflow: ellipsis");
  });

  it("submits chat from Cmd/Ctrl+Enter across keyboard event variants", () => {
    expect(pluginSource).toContain("function isSubmitShortcut");
    expect(pluginSource).toContain('event.code === "NumpadEnter"');
    expect(pluginSource).toContain("event.metaKey || event.ctrlKey");
    expect(pluginSource).toContain("lastShortcutSubmitAt");
    expect(pluginSource).toContain('prompt.addEventListener("keydown", submitFromShortcut, { capture: true })');
    expect(pluginSource).toContain('prompt.addEventListener("keyup", submitFromShortcut, { capture: true })');
  });

  it("lays out panel toolbar buttons as compact single-line controls", () => {
    expect(stylesSource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(stylesSource).toContain("grid-template-columns: minmax(0, 1fr) 32px");
    expect(stylesSource).toContain("overflow: hidden");
    expect(stylesSource).toContain("padding: 10px 12px 42px");
    expect(stylesSource).toContain("min-height: 74px");
    expect(stylesSource).toContain("max-height: none");
    expect(stylesSource).toContain("flex-wrap: nowrap");
    expect(stylesSource).toContain("white-space: nowrap");
    expect(stylesSource).toContain("word-break: keep-all");
    expect(stylesSource).toContain(".codex-excalidraw-panel-agent-event");
    expect(stylesSource).toContain(".codex-excalidraw-panel-agent-rail");
    expect(stylesSource).toContain(".codex-excalidraw-panel-toolbar .codex-excalidraw-panel-tool-button");
    expect(stylesSource).toContain(".codex-excalidraw-panel-composer-tools .codex-excalidraw-panel-tool-button");
    expect(pluginSource).toContain("renderPanelHeaderIllustration");
    expect(stylesSource).toContain("codex-excalidraw-panel-illustration");
    expect(stylesSource).toContain("panel-illustration-spark");
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

  it("shows Codex CLI phase progress as an integrated agent event, not a separate badge rail", () => {
    expect(pluginSource).toContain("PanelPhase");
    expect(pluginSource).toContain("읽기");
    expect(pluginSource).toContain("생각중");
    expect(pluginSource).toContain("편집");
    expect(pluginSource).toContain("검증");
    expect(pluginSource).toContain("inferCodexPhase");
    expect(pluginSource).toContain("ingestCodexChunk");
    expect(pluginSource).not.toContain("renderStatus(root)");
    expect(pluginSource).not.toContain("PANEL_PHASES");
    expect(stylesSource).not.toContain("codex-excalidraw-panel-phase-rail");
    expect(stylesSource).not.toContain("codex-excalidraw-panel-status-pill");
    expect(stylesSource).toContain("codex-excalidraw-panel-agent-progress");
    expect(stylesSource).toContain("codex-excalidraw-panel-agent-activity");
  });

  it("does not treat recoverable connector auth warnings as whole Codex failures", () => {
    expect(pluginSource).toContain("isRecoverableCodexWarning");
    expect(pluginSource).toContain("invalid_token");
    expect(pluginSource).toContain("외부 커넥터 인증 경고");
    expect(pluginSource).toContain("return stream === \"stderr\" ? \"thinking\" : null");
    expect(pluginSource).not.toContain("/(failed|error|enoent|timed out|실패|오류)/");
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
    expect(pluginSource).toContain("elapsedSeconds");
    expect(pluginSource).toContain("s /");
  });

  it("protects Markdown source notes by routing rewrite requests to a copy", () => {
    expect(pluginSource).toContain("Never modify a Markdown source note in place");
    expect(pluginSource).toContain("createMarkdownRevisionCopy");
    expect(pluginSource).toContain("MARKDOWN_REVISION_INBOX_FOLDER");
    expect(pluginSource).toContain("00_수집함");
    expect(settingsSource).toContain("markdownTemplateFolder: string");
    expect(settingsSource).toContain("visualizationOutputFolder: string");
    expect(pluginSource).toContain("getPanelMarkdownTemplateFolder");
    expect(pluginSource).toContain("getPanelVisualizationOutputFolder");
    expect(pluginSource).toContain("shouldCreateMarkdownRevisionCopy");
    expect(pluginSource).toContain("resolveMarkdownRevisionSource");
    expect(pluginSource).toContain("extractMarkdownPathCandidates");
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
    expect(pluginSource).toContain("dismissOutputPath");
    expect(pluginSource).toContain("결과 파일 카드 닫기");
    expect(pluginSource).toContain("codex-excalidraw-panel-output-dismiss");
    expect(stylesSource).toContain("codex-excalidraw-panel-output-header");
    expect(stylesSource).toContain("codex-excalidraw-panel-output-dismiss");
    expect(stylesSource).toContain("codex-excalidraw-panel-output-path");
  });
});
