import { App, PluginSettingTab, Setting } from "obsidian";
import type CodexExcalidrawPlugin from "./plugin";

export interface CodexExcalidrawSettings {
  outputFolder: string;
  visualTheme: "chalkboard" | "whiteboard";
  handwritingFontFamily: number;
  studyNoteFontScale: number;
  includeLinkedNotes: boolean;
  linkedNoteDepth: number;
  maxNotesPerDiagram: number;
  maxCharactersPerNote: number;
  openAfterCreate: boolean;
  codexCommand: string;
  codexModel: string;
  codexReasoningEffort: "low" | "medium" | "high" | "xhigh";
  codexTimeoutSeconds: number;
}

export const DEFAULT_SETTINGS: CodexExcalidrawSettings = {
  outputFolder: "Excalidraw/Codex Maps",
  visualTheme: "chalkboard",
  handwritingFontFamily: 4,
  studyNoteFontScale: 1,
  includeLinkedNotes: true,
  linkedNoteDepth: 1,
  maxNotesPerDiagram: 40,
  maxCharactersPerNote: 12000,
  openAfterCreate: true,
  codexCommand: "codex",
  codexModel: "gpt-5.5",
  codexReasoningEffort: "xhigh",
  codexTimeoutSeconds: 180,
};

export class CodexExcalidrawSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CodexExcalidrawPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("codex-excalidraw-settings");

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Generated .excalidraw.md files are created here.")
      .addText((text) =>
        text
          .setPlaceholder("Excalidraw/Codex Maps")
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value.trim() || DEFAULT_SETTINGS.outputFolder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Visual theme")
      .setDesc("Choose the default drawing style for generated study notes.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            chalkboard: "Chalkboard",
            whiteboard: "Whiteboard",
          })
          .setValue(this.plugin.settings.visualTheme)
          .onChange(async (value) => {
            this.plugin.settings.visualTheme = value as CodexExcalidrawSettings["visualTheme"];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Handwriting font slot")
      .setDesc("Use Local Font for Korean handwriting. Change the actual TTF in the Excalidraw plugin font settings.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "4": "Local Font (recommended for Korean)",
            "1": "Virgil / default handwritten",
            "2": "Normal",
            "3": "Code",
          })
          .setValue(String(this.plugin.settings.handwritingFontFamily))
          .onChange(async (value) => {
            this.plugin.settings.handwritingFontFamily = Number.parseInt(value, 10) || DEFAULT_SETTINGS.handwritingFontFamily;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Study note text scale")
      .setDesc("Scales generated Excalidraw text, panels, and arrows together so handwritten Korean stays readable.")
      .addSlider((slider) =>
        slider
          .setLimits(0.75, 1.5, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.studyNoteFontScale)
          .onChange(async (value) => {
            this.plugin.settings.studyNoteFontScale = roundScale(value);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Include linked notes")
      .setDesc("For current-note diagrams, include first-degree linked Markdown notes when available.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeLinkedNotes).onChange(async (value) => {
          this.plugin.settings.includeLinkedNotes = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Linked note depth")
      .setDesc("Depth 1 is recommended. Higher values can create very large drawings.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.linkedNoteDepth)
          .onChange(async (value) => {
            this.plugin.settings.linkedNoteDepth = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Maximum notes per diagram")
      .setDesc("Caps folder and linked-note expansion so generated diagrams stay readable.")
      .addSlider((slider) =>
        slider
          .setLimits(5, 100, 5)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.maxNotesPerDiagram)
          .onChange(async (value) => {
            this.plugin.settings.maxNotesPerDiagram = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Maximum characters per note")
      .setDesc("Content is truncated before analysis to keep large vaults responsive.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxCharactersPerNote)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed) && parsed > 500) {
            this.plugin.settings.maxCharactersPerNote = parsed;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName("Open generated drawing")
      .setDesc("Open the generated file after creation.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openAfterCreate).onChange(async (value) => {
          this.plugin.settings.openAfterCreate = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Codex CLI command")
      .setDesc("Used by the “with Codex CLI” commands. Keep this as `codex` unless your binary lives elsewhere.")
      .addText((text) =>
        text.setValue(this.plugin.settings.codexCommand).onChange(async (value) => {
          this.plugin.settings.codexCommand = value.trim() || DEFAULT_SETTINGS.codexCommand;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Codex CLI model")
      .setDesc("Model used for semantic drawing generation.")
      .addText((text) =>
        text.setValue(this.plugin.settings.codexModel).onChange(async (value) => {
          this.plugin.settings.codexModel = value.trim() || DEFAULT_SETTINGS.codexModel;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Codex reasoning effort")
      .setDesc("Use xhigh for source-reading diagrams where structure should be inferred, not templated.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            low: "low",
            medium: "medium",
            high: "high",
            xhigh: "xhigh",
          })
          .setValue(this.plugin.settings.codexReasoningEffort)
          .onChange(async (value) => {
            this.plugin.settings.codexReasoningEffort = value as CodexExcalidrawSettings["codexReasoningEffort"];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Codex CLI timeout")
      .setDesc("Maximum seconds to let Codex read source notes and compose the drawing.")
      .addSlider((slider) =>
        slider
          .setLimits(30, 600, 30)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.codexTimeoutSeconds)
          .onChange(async (value) => {
            this.plugin.settings.codexTimeoutSeconds = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}
