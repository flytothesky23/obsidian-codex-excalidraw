import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Codex drawing panel entry points", () => {
  const pluginSource = readFileSync("src/plugin.ts", "utf8");
  const settingsSource = readFileSync("src/settings.ts", "utf8");

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
    expect(pluginSource).toContain("대화 보내기");
    expect(pluginSource).toContain("Codexian 열기");
    expect(pluginSource).toContain("getCodexRuntimeSummary");
  });

  it("uses Codexian settings as the default runtime source", () => {
    expect(settingsSource).toContain('codexSettingsSource: "codexian"');
    expect(settingsSource).toContain("Codexian settings (recommended)");
  });
});
