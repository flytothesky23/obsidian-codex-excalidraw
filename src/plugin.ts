import {
  FileSystemAdapter,
  getAllTags,
  ItemView,
  normalizePath,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import { buildCodexBrief } from "./codex-brief";
import { runCodexExec } from "./codex-cli";
import { buildDiagram, defaultDiagramOptions } from "./diagram";
import { createScene, renderExcalidrawMarkdown } from "./excalidraw";
import { buildNoteContext, truncate } from "./markdown";
import { FolderSuggestModal, MultiFileModal } from "./modals";
import { actionLabel, CODEX_PROMPT_PRESETS, type CodexPanelAction } from "./prompt-presets";
import { CodexExcalidrawSettingTab, DEFAULT_SETTINGS, type CodexExcalidrawSettings } from "./settings";
import type { NoteContext, NoteLink } from "./types";

const CODEX_EXCALIDRAW_PANEL_VIEW = "codex-excalidraw-panel";

export default class CodexExcalidrawPlugin extends Plugin {
  settings: CodexExcalidrawSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new CodexExcalidrawSettingTab(this.app, this));
    this.registerView(
      CODEX_EXCALIDRAW_PANEL_VIEW,
      (leaf) => new CodexExcalidrawPanelView(leaf, this),
    );

    this.addRibbonIcon("network", "Create Codex Excalidraw map", () => {
      void this.createFromCurrentNote();
    });

    this.addCommand({
      id: "open-codex-excalidraw-panel",
      name: "Open Codex Excalidraw panel",
      callback: () => {
        void this.openCodexPanel();
      },
    });

    this.addCommand({
      id: "revise-active-excalidraw-with-codex-panel",
      name: "Revise active Excalidraw drawing with Codex panel",
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!active || !isExcalidrawDrawing(active)) return false;
        if (!checking) void this.openCodexPanel();
        return true;
      },
    });

    this.addCommand({
      id: "create-from-current-note",
      name: "Create Excalidraw map from current note",
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!active) return false;
        if (!checking) void this.createFromCurrentNote();
        return true;
      },
    });

    this.addCommand({
      id: "create-from-current-note-with-codex-cli",
      name: "Create Excalidraw map from current note with Codex CLI",
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!active) return false;
        if (!checking) void this.createFromCurrentNote(true);
        return true;
      },
    });

    this.addCommand({
      id: "create-from-folder",
      name: "Create Excalidraw map from folder",
      callback: () => {
        new FolderSuggestModal(this.app, (folder) => {
          void this.createFromFolder(folder);
        }).open();
      },
    });

    this.addCommand({
      id: "create-from-folder-with-codex-cli",
      name: "Create Excalidraw map from folder with Codex CLI",
      callback: () => {
        new FolderSuggestModal(this.app, (folder) => {
          void this.createFromFolder(folder, true);
        }).open();
      },
    });

    this.addCommand({
      id: "create-from-selected-notes",
      name: "Create Excalidraw map from selected notes",
      callback: () => {
        const files = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
        new MultiFileModal(this.app, files, (selected) => {
          void this.createFromFiles(selected, "Selected notes");
        }).open();
      },
    });

    this.addCommand({
      id: "create-from-selected-notes-with-codex-cli",
      name: "Create Excalidraw map from selected notes with Codex CLI",
      callback: () => {
        const files = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
        new MultiFileModal(this.app, files, (selected) => {
          void this.createFromFiles(selected, "Selected notes", true);
        }).open();
      },
    });

    this.addCommand({
      id: "copy-codex-brief-current-note",
      name: "Copy Codex drawing brief for current note",
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!active) return false;
        if (!checking) void this.copyCodexBrief(active);
        return true;
      },
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openCodexPanel(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getRightLeaf(true);
    if (!leaf) {
      new Notice("Could not open the Codex Excalidraw side panel.");
      return;
    }
    await leaf.setViewState({ type: CODEX_EXCALIDRAW_PANEL_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async createFromCurrentNote(runCodex = false): Promise<void> {
    const active = this.app.workspace.getActiveFile();
    if (!active) {
      new Notice("Open a Markdown note first.");
      return;
    }
    const files = await this.expandLinkedNotes(active);
    await this.createFromFiles(files, active.basename, runCodex);
  }

  async copyCurrentCodexBrief(): Promise<void> {
    const active = this.app.workspace.getActiveFile();
    if (!active) {
      new Notice("Open a Markdown note first.");
      return;
    }
    await this.copyCodexBrief(active);
  }

  async runCodexPanelAction(action: CodexPanelAction, instruction: string): Promise<string> {
    const active = this.app.workspace.getActiveFile();
    if (!active) {
      throw new Error("Open a Markdown note or Excalidraw drawing first.");
    }

    if (action === "revise-active") {
      if (!isExcalidrawDrawing(active)) {
        throw new Error("Open an .excalidraw.md drawing before using current-drawing revision.");
      }
      const summary = await this.reviseActiveDrawingWithCodex(active.path, instruction);
      return summary || `Updated ${active.path}`;
    }

    if (isExcalidrawDrawing(active)) {
      throw new Error("Open a source Markdown note for new study-note or diagram generation.");
    }

    const files = await this.expandLinkedNotes(active);
    const contexts = await this.readNoteContexts(files, false);
    const label = `${active.basename} ${actionLabel(action)}`;
    const title = `${active.basename} ${actionLabel(action)}`;
    const blankMarkdown = renderExcalidrawMarkdown(createScene([]), {
      title,
      sourcePaths: contexts.map((context) => context.path),
    });
    const path = await this.writeDrawing(blankMarkdown, label);

    new Notice(`${actionLabel(action)} target created. Codex CLI is reading ${contexts.length} source note(s).`, 7000);
    const summary = await this.refineWithCodex(contexts, path, instruction, action);

    if (this.settings.openAfterCreate) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof TFile) {
        await this.openGeneratedDrawing(created);
      }
    }

    return summary || `Created ${path}`;
  }

  private async createFromFolder(folder: TFolder, runCodex = false): Promise<void> {
    const folderPrefix = folder.path && folder.path !== "/" ? `${folder.path}/` : "";
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(folderPrefix))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, this.settings.maxNotesPerDiagram);

    if (files.length === 0) {
      new Notice("No Markdown files found in that folder.");
      return;
    }
    await this.createFromFiles(files, folder.path || "Vault", runCodex);
  }

  private async createFromFiles(files: TFile[], label: string, runCodex = false): Promise<void> {
    const capped = files.slice(0, this.settings.maxNotesPerDiagram);
    const contexts = await this.readNoteContexts(capped, !runCodex);
    const title = `${label} context map`;
    let path: string;

    if (runCodex) {
      const blankMarkdown = renderExcalidrawMarkdown(createScene([]), {
        title,
        sourcePaths: contexts.map((context) => context.path),
      });
      path = await this.writeDrawing(blankMarkdown, label);
      new Notice(
        `Created semantic Codex target ${path}. Codex CLI is reading ${contexts.length} source note(s).`,
        7000,
      );
      try {
        await this.refineWithCodex(contexts, path, "", "study-note");
      } catch (error) {
        this.notifyCodexError(error);
      }
    } else {
      const result = buildDiagram(
        contexts,
        defaultDiagramOptions(
          title,
          label,
          this.settings.visualTheme,
          this.settings.handwritingFontFamily,
          this.settings.studyNoteFontScale,
        ),
      );
      path = await this.writeDrawing(result.markdown, label);
      new Notice(
        `Created ${path} with ${contexts.length} notes and ${result.relationCount} cross-note links.`,
        7000,
      );
    }

    if (this.settings.openAfterCreate) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof TFile) {
        await this.openGeneratedDrawing(created);
      }
    }
  }

  private async copyCodexBrief(active: TFile): Promise<void> {
    const files = await this.expandLinkedNotes(active);
    const contexts = await this.readNoteContexts(files);
    const targetPath = await this.nextDrawingPath(active.basename);
    const brief = buildCodexBrief(contexts, targetPath, this.codexBriefOptions());
    await navigator.clipboard.writeText(brief);
    new Notice(`Copied Codex drawing brief for ${contexts.length} note(s).`);
  }

  private async refineWithCodex(
    contexts: NoteContext[],
    targetPath: string,
    instruction = "",
    action: CodexPanelAction = "study-note",
  ): Promise<string> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Codex CLI refinement requires the desktop filesystem adapter.");
    }

    new Notice(`Codex CLI is composing ${actionLabel(action)}...`);
    const prompt = [
      buildCodexBrief(contexts, targetPath, this.codexBriefOptions()),
      "",
      "# Panel Action",
      "",
      panelActionPrompt(action),
      "",
      "# User Instruction",
      "",
      instruction.trim() || "No extra instruction. Prioritize readability, accurate synthesis, and editable Excalidraw text.",
      "",
      "# Execution",
      "",
      "Read the source Markdown files from disk first.",
      `Edit only this target drawing file: ${targetPath}`,
      "Keep the drawing as editable Excalidraw Markdown. Do not create unrelated files.",
      "If the target file contains no useful elements, build the diagram from scratch.",
      "After editing, report a concise summary of the visual logic you created and which source claims anchor it.",
    ].join("\n");

    const result = await runCodexExec({
      command: this.settings.codexCommand,
      cwd: adapter.getBasePath(),
      prompt,
      model: this.settings.codexModel,
      reasoningEffort: this.settings.codexReasoningEffort,
      timeoutMs: this.settings.codexTimeoutSeconds * 1000,
    });
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    new Notice(`Codex CLI finished. ${summary || "Drawing refined."}`, 10000);
    return summary;
  }

  private async reviseActiveDrawingWithCodex(targetPath: string, instruction: string): Promise<string> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Codex CLI revision requires the desktop filesystem adapter.");
    }

    const prompt = [
      "# Codex Excalidraw Drawing Revision",
      "",
      "You are revising an existing Obsidian Excalidraw Markdown drawing from inside the vault root.",
      `Target drawing: ${targetPath}`,
      "",
      "# Current Plugin Style Settings",
      "",
      `- Visual theme: ${this.settings.visualTheme}`,
      `- Excalidraw fontFamily: ${this.settings.handwritingFontFamily}`,
      `- Study note text scale: ${this.settings.studyNoteFontScale}`,
      "",
      "# User Instruction",
      "",
      instruction.trim() || "Improve readability and semantic clarity without changing the source meaning.",
      "",
      "# Execution",
      "",
      "Read the target drawing file first.",
      "If the drawing frontmatter contains `codex_sources`, read those Markdown source notes before revising.",
      "Edit only the target drawing file. Do not create unrelated files.",
      "Keep editable Excalidraw text, rectangles, and arrows. Do not flatten the result into an image.",
      "Fix overlapping text, tiny handwriting, raw block IDs, decorative colors, or dashboard/card clutter.",
      "Prefer a teacher-at-the-board note: reading question, conclusion, evidence spine, caveat, and next check.",
      "Use Excalidraw fontFamily 4 for Korean handwritten text when Local Font is available unless the user asks otherwise.",
      "After editing, report what changed and which source logic the revision protects.",
    ].join("\n");

    new Notice("Codex CLI is revising the active Excalidraw drawing...");
    const result = await runCodexExec({
      command: this.settings.codexCommand,
      cwd: adapter.getBasePath(),
      prompt,
      model: this.settings.codexModel,
      reasoningEffort: this.settings.codexReasoningEffort,
      timeoutMs: this.settings.codexTimeoutSeconds * 1000,
    });
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    new Notice(`Codex CLI finished. ${summary || "Active drawing revised."}`, 10000);
    return summary;
  }

  private codexBriefOptions() {
    return {
      visualTheme: this.settings.visualTheme,
      handwritingFontFamily: this.settings.handwritingFontFamily,
      studyNoteFontScale: this.settings.studyNoteFontScale,
    };
  }

  private notifyCodexError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Codex CLI failed: ${message.slice(0, 220)}`, 12000);
  }

  private async readNoteContexts(files: TFile[], truncateContent = true): Promise<NoteContext[]> {
    const contexts: NoteContext[] = [];
    for (const file of files) {
      const rawContent = await this.app.vault.cachedRead(file);
      const content = truncateContent
        ? truncate(rawContent, this.settings.maxCharactersPerNote)
        : rawContent;
      const cache = this.app.metadataCache.getFileCache(file);
      const links: NoteLink[] = (cache?.links ?? []).map((link) => {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        return {
          raw: link.original,
          target: link.link,
          display: link.displayText,
          resolvedPath: resolved?.path,
        };
      });

      contexts.push(
        buildNoteContext({
          path: file.path,
          basename: file.basename,
          folder: file.parent?.path ?? "",
          content,
          headings: cache?.headings?.map((heading) => ({
            heading: heading.heading,
            level: heading.level,
          })),
          links,
          tags: cache ? getAllTags(cache) ?? [] : [],
        }),
      );
    }
    return contexts;
  }

  private async expandLinkedNotes(active: TFile): Promise<TFile[]> {
    const seen = new Map<string, TFile>([[active.path, active]]);
    if (!this.settings.includeLinkedNotes || this.settings.linkedNoteDepth <= 0) {
      return [...seen.values()];
    }

    let frontier = [active];
    for (let depth = 0; depth < this.settings.linkedNoteDepth; depth += 1) {
      const next: TFile[] = [];
      for (const file of frontier) {
        const cache = this.app.metadataCache.getFileCache(file);
        for (const link of cache?.links ?? []) {
          const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
          if (resolved && !seen.has(resolved.path)) {
            seen.set(resolved.path, resolved);
            next.push(resolved);
          }
          if (seen.size >= this.settings.maxNotesPerDiagram) {
            return [...seen.values()];
          }
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
    return [...seen.values()];
  }

  private async writeDrawing(markdown: string, label: string): Promise<string> {
    const path = await this.nextDrawingPath(label);
    await this.ensureFolder(this.settings.outputFolder);
    await this.app.vault.create(path, markdown);
    return path;
  }

  private async nextDrawingPath(label: string): Promise<string> {
    const folder = normalizePath(this.settings.outputFolder);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
    const cleanLabel = sanitizeFileName(label || "Codex Map");
    let path = normalizePath(`${folder}/${cleanLabel} ${stamp}.excalidraw.md`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${cleanLabel} ${stamp} ${counter}.excalidraw.md`);
      counter += 1;
    }
    return path;
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    if (!normalized || normalized === "/") return;

    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing: TAbstractFile | null = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.app.vault.createFolder(current);
      } else if (!(existing instanceof TFolder)) {
        throw new Error(`${current} exists and is not a folder.`);
      }
    }
  }

  private async openGeneratedDrawing(file: TFile): Promise<void> {
    const excalidrawPlugin = (
      this.app as typeof this.app & {
        plugins?: {
          plugins?: Record<
            string,
            {
              openDrawing?: (
                drawingFile: TFile,
                location: string,
                active?: boolean,
                subpath?: string,
                justCreated?: boolean,
              ) => void | Promise<void>;
            }
          >;
        };
      }
    ).plugins?.plugins?.["obsidian-excalidraw-plugin"];

    if (excalidrawPlugin?.openDrawing) {
      await Promise.resolve(excalidrawPlugin.openDrawing(file, "new-tab", true, undefined, true));
      return;
    }

    await this.app.workspace.getLeaf("tab").openFile(file);
  }
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .replace(/[\\/:*?"<>|#[\]^]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return sanitized || "Codex Map";
}

function isExcalidrawDrawing(file: TFile): boolean {
  return file.path.endsWith(".excalidraw.md");
}

function panelActionPrompt(action: CodexPanelAction): string {
  switch (action) {
    case "study-note":
      return "Create a one-screen Korean handwritten study note that improves understanding more than the original Markdown.";
    case "context-map":
      return "Create a semantic context diagram: synthesize claims, causes, evidence, tensions, and follow-up questions across the source notes.";
    case "svg-sketch":
      return "Create an editable Excalidraw drawing with SVG-like diagram discipline: clean geometry, strong hierarchy, minimal color, and readable handwritten labels.";
    case "revise-active":
      return "Revise the active drawing according to the user's instruction while preserving source-backed meaning.";
  }
}

function summarizeCodexResult(value: string): string {
  return value
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-3)
    .join(" ")
    .slice(0, 220);
}

class CodexExcalidrawPanelView extends ItemView {
  private promptValue = "";
  private statusText = "";

  constructor(leaf: WorkspaceLeaf, private plugin: CodexExcalidrawPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CODEX_EXCALIDRAW_PANEL_VIEW;
  }

  getDisplayText(): string {
    return "Codex Excalidraw";
  }

  getIcon(): string {
    return "network";
  }

  async onOpen(): Promise<void> {
    this.render();
    this.registerEvent(
      this.plugin.app.workspace.on("active-leaf-change", () => {
        this.render();
      }),
    );
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    const root = contentEl.createDiv({ cls: "codex-excalidraw-panel" });
    root.createEl("h2", { text: "Codex Excalidraw" });

    const active = this.plugin.app.workspace.getActiveFile();
    root.createDiv({
      cls: "codex-excalidraw-panel-current",
      text: active ? active.path : "No active Markdown note or Excalidraw drawing",
    });

    this.renderControls(root);

    const prompt = root.createEl("textarea");
    prompt.addClass("codex-excalidraw-panel-prompt");
    prompt.value = this.promptValue;
    prompt.placeholder = "Codex에게 지시: 예) 글씨와 여백을 키우고, 질문-결론-근거-반례-다음 확인사항 구조로 다시 정리해줘";
    prompt.addEventListener("input", () => {
      this.promptValue = prompt.value;
    });

    const presetWrap = root.createDiv({ cls: "codex-excalidraw-panel-presets" });
    for (const preset of CODEX_PROMPT_PRESETS) {
      this.addButton(presetWrap, preset.label, () => {
        this.promptValue = [this.promptValue.trim(), preset.instruction]
          .filter(Boolean)
          .join("\n");
        this.statusText = `프롬프트 추가: ${preset.label}`;
        this.render();
      });
    }

    const actions = root.createDiv({ cls: "codex-excalidraw-panel-actions" });
    this.addButton(actions, "노트→한눈필기", () => {
      void this.plugin.createFromCurrentNote(false);
    });
    this.addButton(actions, "Codex 한눈필기", () => {
      void this.runPanelAction("study-note");
    });
    this.addButton(actions, "Codex 맥락도", () => {
      void this.runPanelAction("context-map");
    });
    this.addButton(actions, "현재 드로잉 수정", () => {
      void this.runPanelAction("revise-active");
    });
    this.addButton(actions, "SVG식 도식", () => {
      void this.runPanelAction("svg-sketch");
    });
    this.addButton(actions, "브리프 복사", () => {
      void this.plugin.copyCurrentCodexBrief();
    });

    if (this.statusText) {
      root.createDiv({ cls: "codex-excalidraw-panel-status", text: this.statusText });
    }

    root.createEl("p", {
      cls: "codex-excalidraw-panel-note",
      text: "Codex CLI는 한 번의 지시마다 실행됩니다. 현재 노트에서는 새 드로잉을 만들고, .excalidraw.md에서는 현재 드로잉을 직접 수정합니다.",
    });
  }

  private addButton(parent: HTMLElement, label: string, onClick: () => void): void {
    const button = parent.createEl("button", { text: label });
    button.addEventListener("click", onClick);
  }

  private renderControls(root: HTMLElement): void {
    const controls = root.createDiv({ cls: "codex-excalidraw-panel-controls" });

    const themeRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    themeRow.createSpan({ text: "테마" });
    const themeSelect = themeRow.createEl("select");
    addOption(themeSelect, "chalkboard", "칠판");
    addOption(themeSelect, "whiteboard", "화이트보드");
    themeSelect.value = this.plugin.settings.visualTheme;
    themeSelect.addEventListener("change", () => {
      this.plugin.settings.visualTheme = themeSelect.value === "whiteboard" ? "whiteboard" : "chalkboard";
      void this.plugin.saveSettings();
    });

    const fontRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    fontRow.createSpan({ text: "폰트" });
    const fontSelect = fontRow.createEl("select");
    addOption(fontSelect, "4", "Local Font");
    addOption(fontSelect, "1", "Virgil");
    addOption(fontSelect, "2", "Normal");
    addOption(fontSelect, "3", "Code");
    fontSelect.value = String(this.plugin.settings.handwritingFontFamily);
    fontSelect.addEventListener("change", () => {
      this.plugin.settings.handwritingFontFamily = Number.parseInt(fontSelect.value, 10) || DEFAULT_SETTINGS.handwritingFontFamily;
      void this.plugin.saveSettings();
    });

    const scaleRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    scaleRow.createSpan({ text: "글자" });
    const scaleInput = scaleRow.createEl("input");
    scaleInput.type = "range";
    scaleInput.min = "0.75";
    scaleInput.max = "1.50";
    scaleInput.step = "0.05";
    scaleInput.value = String(this.plugin.settings.studyNoteFontScale);
    const scaleValue = scaleRow.createSpan({
      cls: "codex-excalidraw-panel-scale-value",
      text: `${this.plugin.settings.studyNoteFontScale.toFixed(2)}x`,
    });
    scaleInput.addEventListener("input", () => {
      const nextScale = Math.round(Number.parseFloat(scaleInput.value) * 100) / 100;
      this.plugin.settings.studyNoteFontScale = nextScale;
      scaleValue.setText(`${nextScale.toFixed(2)}x`);
      void this.plugin.saveSettings();
    });
  }

  private async runPanelAction(action: CodexPanelAction): Promise<void> {
    this.statusText = `${actionLabel(action)} 실행 중...`;
    this.render();
    try {
      const summary = await this.plugin.runCodexPanelAction(action, this.promptValue);
      this.statusText = summary || `${actionLabel(action)} 완료`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusText = `실패: ${message.slice(0, 220)}`;
      new Notice(this.statusText, 12000);
    }
    this.render();
  }
}

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement("option");
  option.value = value;
  option.text = label;
  select.appendChild(option);
}
