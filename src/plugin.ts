import {
  FileSystemAdapter,
  getAllTags,
  ItemView,
  Modal,
  normalizePath,
  Notice,
  Plugin,
  Setting,
  setIcon,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import { lstatSync } from "fs";
import { join } from "path";
import { assertReadableCanvas, buildCanvas, parseAndValidateCanvas } from "./canvas";
import { buildCanvasBrief } from "./canvas-brief";
import { buildCodexBrief } from "./codex-brief";
import { runCodexExec } from "./codex-cli";
import {
  getCodexianPlugin,
  getCodexianRuntime,
  type CodexRuntimeConfig,
} from "./codexian-bridge";
import { buildDiagram, defaultDiagramOptions } from "./diagram";
import { createScene, renderExcalidrawMarkdown } from "./excalidraw";
import { buildNoteContext, truncate } from "./markdown";
import { FolderSuggestModal, MultiFileModal } from "./modals";
import {
  actionLabel,
  CODEX_PROMPT_CATEGORIES,
  CODEX_PROMPT_PRESETS,
  firstPresetForCategory,
  getPromptCategory,
  type CodexPanelAction,
  type CodexPromptCategoryId,
  type CodexPromptPreset,
} from "./prompt-presets";
import { CodexExcalidrawSettingTab, DEFAULT_SETTINGS, type CodexExcalidrawSettings } from "./settings";
import type { NoteContext, NoteLink } from "./types";

const CODEX_EXCALIDRAW_PANEL_VIEW = "codex-excalidraw-panel";
const MARKDOWN_REVISION_INBOX_FOLDER = "00_수집함";
type PanelActionCardId = CodexPanelAction | "basic-study-note" | "copy-brief";

export default class CodexExcalidrawPlugin extends Plugin {
  settings: CodexExcalidrawSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new CodexExcalidrawSettingTab(this.app, this));
    this.registerView(
      CODEX_EXCALIDRAW_PANEL_VIEW,
      (leaf) => new CodexExcalidrawPanelView(leaf, this),
    );

    this.addRibbonIcon("panel-right-open", "Open Codex drawing panel", () => {
      void this.openCodexPanel();
    });

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.autoOpenPanel) {
        void this.openCodexPanel(false);
      }
    });

    this.addCommand({
      id: "open-codex-excalidraw-panel",
      name: "Open Codex drawing side panel",
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
      id: "create-canvas-from-current-note",
      name: "Create Obsidian Canvas from current note",
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!active) return false;
        if (!checking) void this.createCanvasFromCurrentNote();
        return true;
      },
    });

    this.addCommand({
      id: "create-canvas-from-current-note-with-codex-cli",
      name: "Create Obsidian Canvas from current note with Codex CLI",
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!active) return false;
        if (!checking) void this.createCanvasFromCurrentNote(true);
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
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (!loaded?.codexTimeoutSeconds || this.settings.codexTimeoutSeconds <= 180) {
      this.settings.codexTimeoutSeconds = DEFAULT_SETTINGS.codexTimeoutSeconds;
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openCodexPanel(showNotice = true): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CODEX_EXCALIDRAW_PANEL_VIEW)[0];
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getRightLeaf(true);
    if (!leaf) {
      if (showNotice) {
        new Notice("Could not open the Codex drawing side panel.");
      }
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

  async createCanvasFromCurrentNote(runCodex = false, instruction = ""): Promise<void> {
    const active = this.app.workspace.getActiveFile();
    if (!active) {
      new Notice("Open a Markdown note first.");
      return;
    }
    if (isExcalidrawDrawing(active) || isCanvasFile(active)) {
      new Notice("Open a source Markdown note before creating a new Canvas.");
      return;
    }

    const files = await this.expandLinkedNotes(active);
    await this.createCanvasFromFiles(files, active.basename, runCodex, instruction);
  }

  async runCodexPanelAction(action: CodexPanelAction, instruction: string): Promise<string> {
    return this.runCodexPanelActionWithCallbacks(action, instruction);
  }

  async runCodexPanelActionWithCallbacks(
    action: CodexPanelAction,
    instruction: string,
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
  ): Promise<string> {
    const active = this.app.workspace.getActiveFile();
    if (!active) {
      throw new Error("Open a Markdown note or Excalidraw drawing first.");
    }

    if (action === "obsidian-canvas") {
      if (isCanvasFile(active)) {
        const summary = await this.reviseActiveCanvasWithCodex(active.path, instruction, onUpdate);
        return formatActionOutput(summary || "현재 Canvas 수정 완료", active.path);
      }
      if (isExcalidrawDrawing(active)) {
        throw new Error("Open a source Markdown note or an existing .canvas file for Obsidian Canvas work.");
      }
      const files = await this.expandLinkedNotes(active);
      const path = await this.createCanvasFromFiles(files, active.basename, true, instruction, onUpdate);
      return formatActionOutput("Obsidian Canvas 생성 완료", path);
    }

    if (action === "revise-active") {
      if (!isExcalidrawDrawing(active)) {
        throw new Error("Open an .excalidraw.md drawing before using current-drawing revision.");
      }
      const summary = await this.reviseActiveDrawingWithCodex(active.path, instruction, onUpdate);
      return formatActionOutput(summary || "현재 드로잉 수정 완료", active.path);
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
    const outputFolder = this.getCodexWritableOutputFolder();
    this.noticeWhenUsingSafeOutputFolder(outputFolder);
    const path = await this.writeDrawing(blankMarkdown, label, outputFolder);

    new Notice(`${actionLabel(action)} target created. Codex CLI is reading ${contexts.length} source note(s).`, 7000);
    const summary = await this.refineWithCodex(contexts, path, instruction, action, onUpdate);

    if (this.settings.openAfterCreate) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof TFile) {
        await this.openGeneratedDrawing(created);
      }
    }

    return formatActionOutput(summary || `${actionLabel(action)} 완료`, path);
  }

  async runCodexChat(
    instruction: string,
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
    previousMessages: Array<{ role: "user" | "assistant"; text: string }> = [],
  ): Promise<string> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Codex chat requires the desktop filesystem adapter.");
    }
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      throw new Error("Codex에게 보낼 지시를 입력하세요.");
    }

    const active = this.app.workspace.getActiveFile();
    const markdownRevisionSource = shouldCreateMarkdownRevisionCopy(trimmedInstruction)
      ? this.resolveMarkdownRevisionSource(trimmedInstruction, active instanceof TFile ? active : null, adapter)
      : null;
    const markdownRevisionCopy = markdownRevisionSource
      ? await this.createMarkdownRevisionCopy(markdownRevisionSource)
      : null;
    const contextFile = markdownRevisionSource ?? (active instanceof TFile ? active : null);
    const activeContent = contextFile instanceof TFile
      ? truncate(await this.app.vault.cachedRead(contextFile), this.settings.maxCharactersPerNote)
      : "";
    const prompt = [
      "# Codex Drawing Side Panel Chat",
      "",
      "You are running inside an Obsidian vault from the Codex drawing side panel.",
      "Answer in Korean unless the user asks otherwise.",
      "Use the current vault files as the working source of truth.",
      "Never modify a Markdown source note in place.",
      markdownRevisionCopy
        ? `A safe Markdown copy has already been created for this request. If the user is asking to rewrite or reorganize Markdown, edit only this copy: ${markdownRevisionCopy.path}`
        : "If the user asks to rewrite or reorganize Markdown and no safe copy target is listed, answer with the proposed structure instead of editing the source note.",
      markdownRevisionSource && markdownRevisionCopy ? `Original Markdown note is read-only for this request: ${markdownRevisionSource.path}` : "",
      "If the user explicitly asks to edit the current drawing, Canvas, or SVG/Excalidraw target, edit only that visual target file unless they name another file.",
      "If the user is asking a question, answer directly and do not modify files.",
      "When creating or revising visual notes, prefer readable teacher-board structure: question, provisional conclusion, evidence, tension, caveat, next check.",
      "",
      "# Active File",
      "",
      contextFile ? contextFile.path : "No active file.",
      "",
      "# Active File Content",
      "",
      activeContent || "No active file content loaded.",
      "",
      "# Recent Side Panel Conversation",
      "",
      previousMessages.length
        ? previousMessages
          .slice(-8)
          .map((message) => `${message.role === "user" ? "User" : "Codex"}: ${truncate(message.text, 1200)}`)
          .join("\n\n")
        : "No previous side-panel messages.",
      "",
      "# User Message",
      "",
      trimmedInstruction,
    ].join("\n");

    const result = await this.runCodex(prompt, {
      onStdout: (chunk) => onUpdate?.(chunk, "stdout"),
      onStderr: (chunk) => onUpdate?.(chunk, "stderr"),
    });
    const finalText = (result.stdout || result.stderr).trim() || "Codex 응답이 비어 있습니다.";
    if (markdownRevisionCopy) {
      await this.openVaultPath(markdownRevisionCopy.path);
      return [
        finalText,
        "",
        `원본 노트는 수정하지 않았습니다: ${markdownRevisionSource?.path ?? "unknown"}`,
        `수정 사본: ${markdownRevisionCopy.path}`,
      ].join("\n");
    }
    return finalText;
  }

  async openVaultPath(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice(`Cannot find generated file: ${path}`, 9000);
      return;
    }
    if (isExcalidrawDrawing(file)) {
      await this.openGeneratedDrawing(file);
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(file);
  }

  async openActiveFileInCodexian(): Promise<void> {
    const codexian = getCodexianPlugin(this.app);
    if (!codexian) {
      new Notice("Codexian plugin is not loaded in this vault.");
      return;
    }

    const active = this.app.workspace.getActiveFile();
    if (active?.extension === "md" && codexian.pinNote) {
      await Promise.resolve(codexian.pinNote(active.path));
    } else if (codexian.attachCurrentNoteToChat) {
      await Promise.resolve(codexian.attachCurrentNoteToChat());
    }

    await Promise.resolve(codexian.activateView?.());
    codexian.refreshOpenViews?.();
    new Notice("Codexian panel opened with the current note context.");
  }

  getCodexRuntimeSummary(): string {
    const runtime = this.getCodexRuntime();
    const label = runtime.source === "codexian" ? "Codexian" : "Custom";
    return `${label}: ${runtime.command} · ${runtime.model ?? "configured model"} · ${runtime.reasoningEffort ?? "configured reasoning"} · ${runtime.permissionMode}`;
  }

  getPanelVisualOutputFolder(): string {
    return this.getCodexWritableOutputFolder();
  }

  getPanelMarkdownTemplateFolder(): string {
    return normalizePath(this.settings.markdownTemplateFolder || DEFAULT_SETTINGS.markdownTemplateFolder || MARKDOWN_REVISION_INBOX_FOLDER);
  }

  getPanelVisualizationOutputFolder(): string {
    return normalizePath(this.settings.visualizationOutputFolder || DEFAULT_SETTINGS.visualizationOutputFolder);
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

  private async createCanvasFromFiles(
    files: TFile[],
    label: string,
    runCodex = false,
    instruction = "",
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
  ): Promise<string> {
    const capped = files.slice(0, this.settings.maxNotesPerDiagram);
    const contexts = await this.readNoteContexts(capped, !runCodex);
    const title = `${label} Obsidian Canvas`;
    const result = buildCanvas(contexts, title);
    const outputFolder = runCodex ? this.getCodexWritableOutputFolder() : this.settings.outputFolder;
    if (runCodex) this.noticeWhenUsingSafeOutputFolder(outputFolder);
    const path = await this.writeCanvas(result.json, label, outputFolder);
    await this.validateCanvasTarget(path);
    new Notice(`Created ${path} with ${result.nodeCount} canvas nodes and ${result.edgeCount} edges.`, 7000);

    if (runCodex) {
      try {
        await this.refineCanvasWithCodex(contexts, path, instruction, onUpdate);
      } catch (error) {
        this.notifyCodexError(error);
      }
    }

    if (this.settings.openAfterCreate) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof TFile) {
        await this.app.workspace.getLeaf("tab").openFile(created);
      }
    }

    return path;
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
      const outputFolder = this.getCodexWritableOutputFolder();
      this.noticeWhenUsingSafeOutputFolder(outputFolder);
      path = await this.writeDrawing(blankMarkdown, label, outputFolder);
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
    const targetPath = await this.nextDrawingPath(active.basename, this.getCodexWritableOutputFolder());
    const brief = buildCodexBrief(contexts, targetPath, this.codexBriefOptions());
    await navigator.clipboard.writeText(brief);
    new Notice(`Copied Codex drawing brief for ${contexts.length} note(s).`);
  }

  private async createMarkdownRevisionCopy(source: TFile): Promise<TFile> {
    const content = await this.app.vault.cachedRead(source);
    await this.ensureFolder(this.getPanelMarkdownTemplateFolder());
    const path = await this.nextMarkdownRevisionPath(`${source.basename}_수정`);
    const created = await this.app.vault.create(path, content);
    if (!(created instanceof TFile)) {
      throw new Error(`Failed to create Markdown revision copy: ${path}`);
    }
    new Notice(`원본 보호: ${path} 사본을 만들고 이 파일만 수정합니다.`, 9000);
    return created;
  }

  private async nextMarkdownRevisionPath(basename: string): Promise<string> {
    const folder = this.getPanelMarkdownTemplateFolder();
    let counter = 1;
    let path = normalizePath(`${folder}/${basename}.md`);
    while (this.app.vault.getAbstractFileByPath(path)) {
      counter += 1;
      path = normalizePath(`${folder}/${basename} ${counter}.md`);
    }
    return path;
  }

  private resolveMarkdownRevisionSource(
    instruction: string,
    active: TFile | null,
    adapter: FileSystemAdapter,
  ): TFile | null {
    const basePath = normalizePath(adapter.getBasePath());
    for (const candidate of extractMarkdownPathCandidates(instruction)) {
      const vaultPath = toVaultRelativeMarkdownPath(candidate, basePath);
      const file = vaultPath
        ? this.app.vault.getAbstractFileByPath(vaultPath)
        : this.findMarkdownFileByAbsolutePath(candidate, adapter);
      if (file instanceof TFile && isPlainMarkdownNote(file)) {
        return file;
      }
    }
    return active && isPlainMarkdownNote(active) ? active : null;
  }

  private findMarkdownFileByAbsolutePath(candidate: string, adapter: FileSystemAdapter): TFile | null {
    const normalizedCandidate = normalizePath(decodePathCandidate(candidate));
    if (!normalizedCandidate.startsWith("/")) return null;
    const comparableCandidate = normalizedCandidate.normalize("NFC");
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!isPlainMarkdownNote(file)) continue;
      const fullPath = normalizePath(adapter.getFullPath(file.path));
      if (fullPath === normalizedCandidate || fullPath.normalize("NFC") === comparableCandidate) {
        return file;
      }
    }
    return null;
  }

  private async refineWithCodex(
    contexts: NoteContext[],
    targetPath: string,
    instruction = "",
    action: CodexPanelAction = "study-note",
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
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

    const result = await this.runCodex(prompt, {
      onStdout: (chunk) => onUpdate?.(chunk, "stdout"),
      onStderr: (chunk) => onUpdate?.(chunk, "stderr"),
    });
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    new Notice(`Codex CLI finished. ${summary || "Drawing refined."}`, 10000);
    return summary;
  }

  private async reviseActiveDrawingWithCodex(
    targetPath: string,
    instruction: string,
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
  ): Promise<string> {
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
    const result = await this.runCodex(prompt, {
      onStdout: (chunk) => onUpdate?.(chunk, "stdout"),
      onStderr: (chunk) => onUpdate?.(chunk, "stderr"),
    });
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    new Notice(`Codex CLI finished. ${summary || "Active drawing revised."}`, 10000);
    return summary;
  }

  private async refineCanvasWithCodex(
    contexts: NoteContext[],
    targetPath: string,
    instruction = "",
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
  ): Promise<string> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Codex CLI Canvas refinement requires the desktop filesystem adapter.");
    }

    const prompt = [
      buildCanvasBrief(contexts, targetPath),
      "",
      "# User Instruction",
      "",
      instruction.trim() || "영상의 Obsidian Canvas 방식처럼 원문 파일 노드와 개념 노드를 연결하고, 흩어진 생각을 읽기 쉬운 구조로 자동 정렬해줘.",
      "",
      "# Execution",
      "",
      "Read the source Markdown files and target canvas from disk first.",
      `Edit only this target canvas file: ${targetPath}`,
      "Do not create another `.canvas` file in the vault root or any fallback folder. If the target path cannot be written, report failure instead of creating an alternate file.",
      "Keep it as valid Obsidian JSON Canvas. Do not generate Excalidraw Markdown for this action.",
      "Remove or replace placeholder nodes. Every text node must contain readable Korean content anchored to the source notes.",
    ].join("\n");

    new Notice("Codex CLI is composing an Obsidian Canvas JSON file...");
    const result = await this.runCodex(prompt, {
      onStdout: (chunk) => onUpdate?.(chunk, "stdout"),
      onStderr: (chunk) => onUpdate?.(chunk, "stderr"),
    });
    const stats = await this.validateCanvasTarget(targetPath);
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    const verified = `검증: 텍스트 ${stats.textNodeCount}개, 원문 ${stats.fileNodeCount}개, 연결 ${stats.edgeCount}개`;
    new Notice(`Codex CLI finished. ${summary || "Canvas refined."} ${verified}`, 10000);
    return [summary, verified].filter(Boolean).join("\n");
  }

  private async reviseActiveCanvasWithCodex(
    targetPath: string,
    instruction: string,
    onUpdate?: (chunk: string, stream: "stdout" | "stderr") => void,
  ): Promise<string> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Codex CLI Canvas revision requires the desktop filesystem adapter.");
    }

    const prompt = [
      "# Obsidian Canvas Revision",
      "",
      "You are revising an existing Obsidian `.canvas` JSON file from inside the vault root.",
      `Target canvas: ${targetPath}`,
      "",
      "# User Instruction",
      "",
      instruction.trim() || "Rearrange, recolor, and clarify the existing Canvas while preserving useful user nodes.",
      "",
      "# Execution",
      "",
      "Read the target canvas file first.",
      "Read any `file` node Markdown paths that are relevant before revising.",
      "Edit only the target `.canvas` file.",
      "Do not create another `.canvas` file. If the target is not writable, report failure instead of creating an alternate file.",
      "Keep valid JSON Canvas with top-level `nodes` and `edges` arrays.",
      "Every node and edge id must be unique 16-character lowercase hex.",
      "Every edge must reference existing nodes.",
      "Use Obsidian Canvas strengths: file nodes, concept text nodes, groups, colors, and readable auto-layout.",
      "Remove placeholder nodes and make every text node meaningful Korean reading content.",
      "Do not create SVG, HTML, PNG, or Excalidraw Markdown for this action.",
      "After editing, report the structure changes.",
    ].join("\n");

    new Notice("Codex CLI is revising the active Obsidian Canvas...");
    const result = await this.runCodex(prompt, {
      onStdout: (chunk) => onUpdate?.(chunk, "stdout"),
      onStderr: (chunk) => onUpdate?.(chunk, "stderr"),
    });
    const stats = await this.validateCanvasTarget(targetPath);
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    const verified = `검증: 텍스트 ${stats.textNodeCount}개, 원문 ${stats.fileNodeCount}개, 연결 ${stats.edgeCount}개`;
    new Notice(`Codex CLI finished. ${summary || "Canvas revised."} ${verified}`, 10000);
    return [summary, verified].filter(Boolean).join("\n");
  }

  private codexBriefOptions() {
    return {
      visualTheme: this.settings.visualTheme,
      handwritingFontFamily: this.settings.handwritingFontFamily,
      studyNoteFontScale: this.settings.studyNoteFontScale,
    };
  }

  private async runCodex(
    prompt: string,
    callbacks: {
      onStdout?: (chunk: string) => void;
      onStderr?: (chunk: string) => void;
    } = {},
  ) {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Codex CLI requires the desktop filesystem adapter.");
    }
    const runtime = this.getCodexRuntime();
    return runCodexExec({
      command: runtime.command,
      cwd: adapter.getBasePath(),
      prompt,
      model: runtime.model,
      reasoningEffort: runtime.reasoningEffort,
      permissionMode: runtime.permissionMode,
      environmentVariables: runtime.environmentVariables,
      timeoutMs: this.settings.codexTimeoutSeconds * 1000,
      onStdout: callbacks.onStdout,
      onStderr: callbacks.onStderr,
    });
  }

  private getCodexRuntime(): CodexRuntimeConfig {
    const codexianRuntime = this.settings.codexSettingsSource !== "custom"
      ? getCodexianRuntime(this.app)
      : null;
    if (codexianRuntime) return codexianRuntime;

    return {
      source: "custom",
      command: this.settings.codexCommand,
      model: this.settings.codexModel,
      reasoningEffort: this.settings.codexReasoningEffort,
      permissionMode: this.settings.codexPermissionMode,
      environmentVariables: this.settings.codexEnvironmentVariables,
    };
  }

  private notifyCodexError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Codex CLI failed: ${message.slice(0, 220)}`, 12000);
  }

  private async validateCanvasTarget(path: string): Promise<{ textNodeCount: number; fileNodeCount: number; edgeCount: number }> {
    const raw = await this.app.vault.adapter.read(path);
    const canvas = parseAndValidateCanvas(raw);
    return assertReadableCanvas(canvas);
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

  private async writeDrawing(markdown: string, label: string, folder = this.settings.outputFolder): Promise<string> {
    const path = await this.nextDrawingPath(label, folder);
    await this.ensureFolder(folder);
    await this.app.vault.create(path, markdown);
    return path;
  }

  private async writeCanvas(json: string, label: string, folder = this.settings.outputFolder): Promise<string> {
    const path = await this.nextCanvasPath(label, folder);
    await this.ensureFolder(folder);
    await this.app.vault.create(path, json);
    return path;
  }

  private async nextDrawingPath(label: string, outputFolder = this.settings.outputFolder): Promise<string> {
    const folder = normalizePath(outputFolder);
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

  private async nextCanvasPath(label: string, outputFolder = this.settings.outputFolder): Promise<string> {
    const folder = normalizePath(outputFolder);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
    const cleanLabel = sanitizeFileName(label || "Codex Canvas");
    let path = normalizePath(`${folder}/${cleanLabel} ${stamp}.canvas`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${cleanLabel} ${stamp} ${counter}.canvas`);
      counter += 1;
    }
    return path;
  }

  private getCodexWritableOutputFolder(): string {
    const configured = normalizePath(this.settings.outputFolder || DEFAULT_SETTINGS.outputFolder);
    if (this.isSymlinkedVaultPath(configured)) return "Codex Maps";
    return configured;
  }

  private noticeWhenUsingSafeOutputFolder(folder: string): void {
    const configured = normalizePath(this.settings.outputFolder || DEFAULT_SETTINGS.outputFolder);
    if (folder !== configured) {
      new Notice(`Codex 작업 대상은 symlink 출력 폴더를 피해 ${folder}에 생성합니다.`, 9000);
    }
  }

  private isSymlinkedVaultPath(relativePath: string): boolean {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return false;
    const parts = normalizePath(relativePath).split("/").filter(Boolean);
    if (parts.length === 0) return false;

    let current = adapter.getBasePath();
    for (const part of parts) {
      current = join(current, part);
      try {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink()) return true;
      } catch {
        return false;
      }
    }
    return false;
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

function isCanvasFile(file: TFile): boolean {
  return file.path.endsWith(".canvas");
}

function isPlainMarkdownNote(file: TFile): boolean {
  return file.extension === "md" && !isExcalidrawDrawing(file);
}

function shouldCreateMarkdownRevisionCopy(instruction: string): boolean {
  const normalized = instruction.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  const mentionsSourceText = /(본문|노트|문서|파일|회의록|원문|내용)/.test(normalized);
  const rewriteIntent = /(수정|고쳐|바꿔|변경|재구성|다시 구성|구조화|정리|보강|작성|리라이트|rewrite|reorganize|restructure)/i
    .test(normalized);
  const directRewrite = /(재구성하라|다시 구성하라|구조로.*구성|구조로.*정리|수정해|고쳐줘|바꿔줘|보강해)/.test(normalized);
  return (mentionsSourceText && rewriteIntent) || directRewrite;
}

function extractMarkdownPathCandidates(instruction: string): string[] {
  const candidates = new Set<string>();
  for (const match of instruction.matchAll(/(?:\/|[A-Za-z]:\\)[^\r\n`"'<>\]]+?\.md/g)) {
    candidates.add(match[0].trim());
  }
  for (const rawLine of instruction.split(/\r?\n/)) {
    const line = rawLine.trim();
    const end = line.indexOf(".md");
    if (end < 0) continue;
    const candidate = line.slice(0, end + 3).replace(/^[-*\s`"'<(]+/, "").trim();
    if (candidate.includes("/") || candidate.includes("\\")) {
      candidates.add(candidate);
    }
  }
  return [...candidates];
}

function toVaultRelativeMarkdownPath(candidate: string, basePath: string): string | null {
  const decoded = decodePathCandidate(candidate);
  const normalized = normalizePath(decoded);
  if (!normalized.endsWith(".md")) return null;
  if (normalized.startsWith(`${basePath}/`)) {
    return normalizePath(normalized.slice(basePath.length + 1));
  }
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    return null;
  }
  return normalized;
}

function decodePathCandidate(candidate: string): string {
  let decoded = candidate.trim().replace(/^["'`<]+|["'`>]+$/g, "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original candidate when it is not URL encoded.
  }
  return decoded;
}

function formatActionOutput(summary: string, path: string): string {
  return [
    summary.trim(),
    "",
    `결과 파일: ${path}`,
  ].filter(Boolean).join("\n");
}

function extractOutputPath(value: string): string {
  const match = value.match(/(?:결과 파일|수정 사본):\s*([^\n]+)/);
  return match?.[1]?.trim() ?? "";
}

function panelActionPrompt(action: CodexPanelAction): string {
  switch (action) {
    case "study-note":
      return [
        "Create a one-screen Korean handwritten study note that improves understanding more than the original Markdown.",
        "First infer the source note's domain and genre. Do not reuse fixed business-report labels, freight vocabulary, PSBall, W25, or KPI panels unless they are actually in the source.",
        "Choose the simplest visual form that fits the source: teacher-board explanation, concept map, decision spine, timeline, risk matrix, or checklist.",
        "The first visible line must be the reader's real question. The center must carry the provisional conclusion. Supporting boxes must explain why the conclusion changes, not merely restate facts.",
        "Use editable Excalidraw text and shapes. Keep Korean handwriting readable: generous margins, no overlaps, no tiny text, no raw IDs.",
      ].join("\n");
    case "obsidian-canvas":
      return [
        "Create or revise an Obsidian JSON Canvas that acts as an editable knowledge map, not a decorative dashboard.",
        "Keep source Markdown file nodes openable. Add concept, evidence, uncertainty, and next-action nodes only when they are anchored to the source.",
        "Use groups to separate source material, interpretation, risks, and follow-up. Every edge label should explain the relationship, not just say related.",
        "Remove placeholder nodes. Make the JSON valid and easy for future AI passes to rearrange.",
      ].join("\n");
    case "context-map":
      return [
        "Create a semantic context diagram that helps a reader understand the note faster than reading the Markdown.",
        "Infer the note genre first, then pick a structure. Valid structures include cause-effect spine, decision tree, evidence map, operating flow, timeline, or risk matrix.",
        "Synthesize claims, causes, evidence, tensions, caveats, and follow-up questions. Do not copy paragraphs into boxes.",
        "End with the condition that would change the conclusion or the next evidence required.",
      ].join("\n");
    case "svg-sketch":
      return [
        "Create an editable Excalidraw drawing with SVG-like diagram discipline: clean geometry, strong hierarchy, minimal color, and readable Korean labels.",
        "Use spatial hierarchy before color. Use no more than three accent colors and no decorative fills unless they encode meaning.",
        "Every shape must have a reason: source, concept, decision, risk, evidence, or next action.",
        "The result must remain editable Excalidraw, not a pasted image.",
      ].join("\n");
    case "revise-active":
      return [
        "Revise the active drawing according to the user's instruction while preserving source-backed meaning.",
        "Before editing, read the current drawing and any `codex_sources`. Diagnose the top three visual defects: unreadable text, weak hierarchy, missing insight, bad layout, or unsupported claims.",
        "Fix those defects directly. Do not add decorative complexity. Keep all Korean text readable at normal zoom.",
        "Report what changed and which source logic remains protected.",
      ].join("\n");
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

interface PanelMessage {
  role: "user" | "assistant";
  text: string;
}

type PanelPhase = "idle" | "preparing" | "reading" | "thinking" | "editing" | "verifying" | "complete" | "failed";

class CodexExcalidrawPanelView extends ItemView {
  private promptValue = "";
  private statusText = "";
  private isRunning = false;
  private messages: PanelMessage[] = [];
  private progressTimer: number | null = null;
  private runningStartedAt = 0;
  private runningLabel = "";
  private lastOutputPath = "";
  private activityLines: string[] = [];
  private currentPhase: PanelPhase = "idle";
  private phaseDetail = "대기 중";
  private lastShortcutSubmitAt = 0;
  private forceNextChatScroll = false;

  constructor(leaf: WorkspaceLeaf, private plugin: CodexExcalidrawPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CODEX_EXCALIDRAW_PANEL_VIEW;
  }

  getDisplayText(): string {
    return "Codex Drawing";
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

  async onClose(): Promise<void> {
    this.stopProgress();
  }

  private render(): void {
    const { contentEl } = this;
    const shouldScrollChat = this.shouldAutoScrollChat();
    contentEl.empty();
    const root = contentEl.createDiv({ cls: "codex-excalidraw-panel" });

    this.renderHeader(root);
    this.renderChat(root, shouldScrollChat);
    this.renderComposer(root);
  }

  private renderHeader(root: HTMLElement): void {
    const active = this.plugin.app.workspace.getActiveFile();
    const header = root.createDiv({ cls: "codex-excalidraw-panel-header" });
    const identity = header.createDiv({ cls: "codex-excalidraw-panel-identity" });
    identity.createEl("h2", { text: "Codex Drawing" });
    identity.createDiv({
      cls: "codex-excalidraw-panel-current",
      text: active ? active.path : "No active Markdown note or Excalidraw drawing",
    });

    const tools = header.createDiv({ cls: "codex-excalidraw-panel-toolbar" });
    this.addToolButton(tools, "sliders-horizontal", "모델", () => {
      new PanelRuntimeStyleModal(this.plugin.app, this.plugin, this).open();
    }, this.isRunning, "모델 / 스타일");
    this.addToolButton(tools, "wand-sparkles", "프롬프트", () => {
      new PanelPromptToolsModal(this.plugin.app, this).open();
    }, this.isRunning, "프롬프트 도구");
    this.addToolButton(tools, "network", "작업", () => {
      new PanelActionModal(this.plugin.app, this).open();
    }, this.isRunning, "드로잉 / Canvas 작업");

    const meta = root.createDiv({ cls: "codex-excalidraw-panel-meta" });
    meta.createSpan({ text: this.compactRuntimeSummary() });
  }

  private compactRuntimeSummary(): string {
    const source = this.plugin.settings.codexSettingsSource === "custom" ? "Custom" : "Codexian";
    const theme = this.plugin.settings.visualTheme === "whiteboard" ? "화이트보드" : "칠판";
    const font = fontLabel(this.plugin.settings.handwritingFontFamily);
    return [
      source,
      this.plugin.settings.codexModel || "configured model",
      this.plugin.settings.codexReasoningEffort,
      this.plugin.settings.codexPermissionMode,
      theme,
      font,
      `${this.plugin.settings.codexTimeoutSeconds}s`,
    ].join(" · ");
  }

  private progressPercent(): number {
    if (!this.isRunning || this.runningStartedAt <= 0) return 0;
    const elapsed = Math.max(0, Date.now() - this.runningStartedAt);
    const limit = Math.max(1, this.plugin.settings.codexTimeoutSeconds * 1000);
    return Math.min(100, Math.round((elapsed / limit) * 100));
  }

  private renderChat(root: HTMLElement, shouldScrollChat: boolean): void {
    const shell = root.createDiv({
      cls: `codex-excalidraw-panel-chat-shell codex-excalidraw-panel-agent-shell ${
        this.isRunning ? "codex-excalidraw-panel-agent-shell-running" : ""
      }`,
    });
    const header = shell.createDiv({ cls: "codex-excalidraw-panel-chat-header" });
    header.createSpan({ cls: "codex-excalidraw-panel-chat-title", text: "Codex 대화창" });
    const chatActions = header.createDiv({ cls: "codex-excalidraw-panel-chat-actions" });
    chatActions.createSpan({
      cls: "codex-excalidraw-panel-chat-subtitle",
      text: this.agentSubtitle(),
    });
    if (this.messages.length > 0) {
      this.addButton(chatActions, "전체 복사", () => {
        void this.copyText(this.chatTranscript(), "전체 대화");
      }, this.isRunning);
    }

    const chat = shell.createDiv({ cls: "codex-excalidraw-panel-chat-log codex-excalidraw-panel-agent-log" });
    if (this.messages.length === 0) {
      this.renderAgentEvent(chat);
      chat.createDiv({
        cls: "codex-excalidraw-panel-chat-empty",
        text: "아래 입력창에서 Codex에게 질문하거나 현재 노트·드로잉·Canvas 수정 방향을 지시하세요. 실행 상태와 응답은 이 대화 스트림에 함께 누적됩니다.",
      });
    }

    for (const message of this.messages) {
      const bubble = chat.createDiv({
        cls: `codex-excalidraw-panel-message codex-excalidraw-panel-message-${message.role}`,
      });
      const messageHead = bubble.createDiv({ cls: "codex-excalidraw-panel-message-head" });
      messageHead.createDiv({
        cls: "codex-excalidraw-panel-message-role",
        text: message.role === "user" ? "나" : "Codex",
      });
      bubble.createEl("pre", {
        cls: "codex-excalidraw-panel-message-text",
        text: message.text || (message.role === "assistant" ? "응답 수신 중..." : ""),
      });
    }
    if (this.messages.length > 0) {
      this.renderAgentEvent(chat);
    }
    if (this.lastOutputPath) {
      this.renderOutputEvent(chat);
    }
    if (shouldScrollChat) {
      window.requestAnimationFrame(() => {
        chat.scrollTo({
          top: chat.scrollHeight,
          behavior: this.isRunning ? "auto" : "smooth",
        });
      });
    }
  }

  private shouldAutoScrollChat(): boolean {
    if (this.forceNextChatScroll) {
      this.forceNextChatScroll = false;
      return true;
    }
    const current = this.contentEl.querySelector(".codex-excalidraw-panel-chat-log");
    if (!(current instanceof HTMLElement)) return true;
    return current.scrollTop + current.clientHeight >= current.scrollHeight - 96;
  }

  private renderAgentEvent(chat: HTMLElement): void {
    const event = chat.createDiv({
      cls: `codex-excalidraw-panel-agent-event codex-excalidraw-panel-agent-event-${this.currentPhase}`,
    });
    const rail = event.createDiv({ cls: "codex-excalidraw-panel-agent-rail" });
    rail.createSpan({ cls: "codex-excalidraw-panel-agent-marker" });

    const body = event.createDiv({ cls: "codex-excalidraw-panel-agent-body" });
    body.createDiv({ cls: "codex-excalidraw-panel-agent-kicker", text: "Codex CLI" });
    body.createDiv({ cls: "codex-excalidraw-panel-agent-title", text: this.agentStatusTitle() });
    body.createDiv({ cls: "codex-excalidraw-panel-agent-detail", text: this.phaseDetail });

    const statusLines = (this.statusText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (statusLines.length > 0) {
      const details = body.createDiv({ cls: "codex-excalidraw-panel-agent-details" });
      for (const line of statusLines) {
        details.createDiv({ text: line });
      }
    }

    if (this.isRunning) {
      const progress = body.createDiv({ cls: "codex-excalidraw-panel-agent-progress" });
      const fill = progress.createDiv({ cls: "codex-excalidraw-panel-agent-progress-fill" });
      fill.style.width = `${this.progressPercent()}%`;
    }

    const recentLines = this.activityLines.slice(-5);
    if (recentLines.length > 0) {
      const activity = body.createDiv({ cls: "codex-excalidraw-panel-agent-activity" });
      for (const line of recentLines) {
        activity.createDiv({ cls: "codex-excalidraw-panel-agent-activity-line", text: line });
      }
    }
  }

  private renderOutputEvent(chat: HTMLElement): void {
    const output = chat.createDiv({ cls: "codex-excalidraw-panel-output codex-excalidraw-panel-agent-output" });
    output.createDiv({ cls: "codex-excalidraw-panel-agent-kicker", text: "결과 파일" });
    output.createDiv({ cls: "codex-excalidraw-panel-output-path", text: this.lastOutputPath });
    const actions = output.createDiv({ cls: "codex-excalidraw-panel-output-actions" });
    this.addButton(actions, "결과 열기", () => {
      void this.plugin.openVaultPath(this.lastOutputPath);
    }, this.isRunning);
    this.addButton(actions, "경로 복사", () => {
      void this.copyText(this.lastOutputPath, "결과 경로");
    }, this.isRunning);
  }

  private agentSubtitle(): string {
    if (this.isRunning) {
      return `${phaseLabel(this.currentPhase)} 중 · ${this.elapsedSeconds()}s / ${this.plugin.settings.codexTimeoutSeconds}s`;
    }
    if (this.currentPhase === "complete") return "최근 작업 완료";
    if (this.currentPhase === "failed") return "최근 작업 실패";
    return "현재 노트 맥락";
  }

  private agentStatusTitle(): string {
    if (this.isRunning) return this.runningLabel || `${phaseLabel(this.currentPhase)} 중`;
    if (this.currentPhase === "complete") return "작업 완료";
    if (this.currentPhase === "failed") return "작업 실패";
    return "대기 중";
  }

  private elapsedSeconds(): number {
    if (this.runningStartedAt <= 0) return 0;
    return Math.max(0, Math.round((Date.now() - this.runningStartedAt) / 1000));
  }

  private chatTranscript(): string {
    return this.messages
      .map((message) => `${message.role === "user" ? "나" : "Codex"}:\n${message.text}`)
      .join("\n\n");
  }

  private async copyText(text: string, label: string): Promise<void> {
    const value = text.trim();
    if (!value) return;
    await navigator.clipboard.writeText(value);
    this.statusText = `${label} 복사됨`;
    this.pushActivity(this.statusText);
    this.render();
  }

  private pushActivity(text: string): void {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    const time = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    this.activityLines = [...this.activityLines, `${time} · ${normalized}`].slice(-8);
  }

  private setPhase(phase: PanelPhase, detail?: string): void {
    this.currentPhase = phase;
    this.phaseDetail = detail ?? phaseLabel(phase);
  }

  private ingestCodexChunk(chunk: string, stream: "stdout" | "stderr"): void {
    const normalized = chunk.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    const phase = inferCodexPhase(normalized, stream);
    if (phase) {
      this.setPhase(phase, `${phaseLabel(phase)} · ${normalized.slice(-140)}`);
    }
    this.pushActivity(codexStatusLine(normalized, stream) || normalized.slice(-180));
  }

  private renderComposer(root: HTMLElement): void {
    const composer = root.createDiv({ cls: "codex-excalidraw-panel-composer" });
    const label = composer.createDiv({ cls: "codex-excalidraw-panel-section-title", text: "Codex 입력" });
    label.createSpan({ text: " · " });
    label.createSpan({ cls: "codex-excalidraw-panel-composer-hint", text: "Cmd/Ctrl+Enter 전송" });

    const prompt = composer.createEl("textarea");
    prompt.addClass("codex-excalidraw-panel-prompt");
    prompt.value = this.promptValue;
    prompt.placeholder = "현재 노트나 드로잉을 어떻게 바꿀지 지시하세요";
    prompt.disabled = this.isRunning;
    prompt.addEventListener("input", () => {
      this.promptValue = prompt.value;
    });
    const submitFromShortcut = (event: KeyboardEvent) => {
      if (!isSubmitShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - this.lastShortcutSubmitAt < 650) return;
      this.lastShortcutSubmitAt = now;
      this.promptValue = prompt.value;
      void this.runChat();
    };
    prompt.addEventListener("keydown", submitFromShortcut, { capture: true });
    prompt.addEventListener("keyup", submitFromShortcut, { capture: true });

    const composerBar = composer.createDiv({ cls: "codex-excalidraw-panel-composer-bar" });
    const leftTools = composerBar.createDiv({ cls: "codex-excalidraw-panel-composer-tools" });
    this.addToolButton(leftTools, "sliders-horizontal", "모델", () => {
      new PanelRuntimeStyleModal(this.plugin.app, this.plugin, this).open();
    }, this.isRunning, "모델 / 스타일");
    this.addToolButton(leftTools, "wand-sparkles", "프롬프트", () => {
      new PanelPromptToolsModal(this.plugin.app, this).open();
    }, this.isRunning, "프롬프트 도구");
    this.addToolButton(leftTools, "network", "작업", () => {
      new PanelActionModal(this.plugin.app, this).open();
    }, this.isRunning, "드로잉 / Canvas 작업");

    const rightTools = composerBar.createDiv({ cls: "codex-excalidraw-panel-composer-send" });
    const sendButton = rightTools.createEl("button", {
      cls: "codex-excalidraw-panel-send-button",
      attr: {
        "aria-label": "대화 보내기",
        title: "대화 보내기",
      },
    });
    sendButton.disabled = this.isRunning;
    setIcon(sendButton, "arrow-up");
    sendButton.addEventListener("click", () => {
      void this.runChat();
    });
  }

  private addButton(parent: HTMLElement, label: string, onClick: () => void, disabled = false): void {
    const button = parent.createEl("button", { text: label });
    button.disabled = disabled;
    button.addEventListener("click", onClick);
  }

  private addToolButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
    disabled = false,
    title = label,
  ): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls: "codex-excalidraw-panel-tool-button",
      attr: {
        "aria-label": title,
        title,
      },
    });
    const iconEl = button.createSpan({ cls: "codex-excalidraw-panel-tool-icon" });
    setIcon(iconEl, icon);
    button.createSpan({ cls: "codex-excalidraw-panel-tool-label", text: label });
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
  }

  async runNoteStudyAction(): Promise<void> {
    if (this.isRunning) return;
    this.startProgress("노트→한눈필기 생성 중");
    this.setPhase("reading", "현재 노트와 링크 맥락을 읽는 중");
    try {
      await this.plugin.createFromCurrentNote(false);
      this.stopProgress();
      this.setPhase("complete", "기본 Excalidraw 생성 완료");
      this.statusText = "노트→한눈필기 생성 완료";
      this.pushActivity("노트→한눈필기 생성 완료");
    } catch (error) {
      this.stopProgress();
      this.setPhase("failed", "생성 실패");
      const message = error instanceof Error ? error.message : String(error);
      this.statusText = `실패: ${message.slice(0, 220)}`;
      this.pushActivity(this.statusText);
      new Notice(this.statusText, 12000);
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  async copyBriefAction(): Promise<void> {
    if (this.isRunning) return;
    try {
      this.setPhase("reading", "현재 노트의 Codex 브리프를 구성하는 중");
      await this.plugin.copyCurrentCodexBrief();
      this.setPhase("complete", "브리프 복사 완료");
      this.statusText = "브리프 복사 완료";
      this.pushActivity("브리프 복사 완료");
    } catch (error) {
      this.setPhase("failed", "브리프 복사 실패");
      const message = error instanceof Error ? error.message : String(error);
      this.statusText = `실패: ${message.slice(0, 220)}`;
      this.pushActivity(this.statusText);
      new Notice(this.statusText, 12000);
    }
    this.render();
  }

  applyPromptPreset(label: string, instruction: string): void {
    this.promptValue = [this.promptValue.trim(), instruction]
      .filter(Boolean)
      .join("\n");
    this.statusText = `프롬프트 추가: ${label}`;
    this.pushActivity(this.statusText);
    this.render();
  }

  setStatus(text: string): void {
    this.statusText = text;
    this.pushActivity(text);
    this.render();
  }

  getOutputFolderForPrompt(preset: CodexPromptPreset): string {
    if (preset.category === "md-template") return this.plugin.getPanelMarkdownTemplateFolder();
    if (preset.category === "dataview-visual") return this.plugin.getPanelVisualizationOutputFolder();
    return this.plugin.getPanelVisualOutputFolder();
  }

  getOutputFolderForAction(action: PanelActionCardId): string {
    switch (action) {
      case "basic-study-note":
        return normalizePath(this.plugin.settings.outputFolder || DEFAULT_SETTINGS.outputFolder);
      case "revise-active":
        return "현재 열려 있는 Excalidraw 파일";
      case "copy-brief":
        return "클립보드";
      case "obsidian-canvas":
      case "study-note":
      case "context-map":
      case "svg-sketch":
      default:
        return this.plugin.getPanelVisualOutputFolder();
    }
  }

  async runPanelAction(action: CodexPanelAction): Promise<void> {
    if (this.isRunning) return;
    this.startProgress(`${actionLabel(action)} 실행 중`);
    try {
      const summary = await this.plugin.runCodexPanelActionWithCallbacks(action, this.promptValue, (chunk, stream) => {
        this.ingestCodexChunk(chunk, stream);
        this.render();
      });
      this.stopProgress();
      this.setPhase("complete", `${actionLabel(action)} 완료`);
      this.statusText = summary || `${actionLabel(action)} 완료`;
      this.lastOutputPath = extractOutputPath(summary) || this.lastOutputPath;
      this.pushActivity(`${actionLabel(action)} 완료`);
    } catch (error) {
      this.stopProgress();
      this.setPhase("failed", `${actionLabel(action)} 실패`);
      const message = error instanceof Error ? error.message : String(error);
      this.statusText = `실패: ${message.slice(0, 220)}`;
      this.pushActivity(this.statusText);
      new Notice(this.statusText, 12000);
    } finally {
      this.isRunning = false;
    }
    this.render();
  }

  private async runChat(): Promise<void> {
    if (this.isRunning) return;
    const message = this.promptValue.trim();
    if (!message) {
      this.statusText = "Codex에게 보낼 지시를 입력하세요.";
      this.render();
      return;
    }

    this.messages.push({ role: "user", text: message });
    const assistantMessage: PanelMessage = { role: "assistant", text: "" };
    this.messages.push(assistantMessage);
    this.promptValue = "";
    this.forceNextChatScroll = true;
    this.startProgress("Codex 대화 응답 생성 중");

    try {
      const history = this.messages.slice(0, -2);
      const finalText = await this.plugin.runCodexChat(message, (chunk, stream) => {
        this.ingestCodexChunk(chunk, stream);
        if (stream === "stdout") {
          assistantMessage.text = `${assistantMessage.text}${chunk}`.slice(-6000);
        } else {
          this.statusText = codexStatusLine(chunk, stream) || "Codex 실행 중...";
          this.pushActivity(this.statusText);
        }
        this.render();
      }, history);
      this.stopProgress();
      this.setPhase("complete", "Codex 응답 완료");
      assistantMessage.text = finalText;
      this.lastOutputPath = extractOutputPath(finalText) || this.lastOutputPath;
      this.statusText = "Codex 응답 완료";
      this.pushActivity(this.statusText);
    } catch (error) {
      this.stopProgress();
      this.setPhase("failed", "Codex 응답 실패");
      const text = error instanceof Error ? error.message : String(error);
      assistantMessage.text = `실패: ${text}`;
      this.statusText = `실패: ${text.slice(0, 220)}`;
      this.pushActivity(this.statusText);
      new Notice(this.statusText, 12000);
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  private startProgress(label: string): void {
    this.stopProgress();
    this.isRunning = true;
    this.runningLabel = label;
    this.runningStartedAt = Date.now();
    this.setPhase("preparing", `${label} 준비 중`);
    this.forceNextChatScroll = true;
    this.pushActivity(label);
    this.updateProgressStatus();
    this.progressTimer = window.setInterval(() => {
      this.updateProgressStatus();
      this.render();
    }, 5000);
    this.render();
  }

  private stopProgress(): void {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private updateProgressStatus(): void {
    const elapsed = this.elapsedSeconds();
    this.statusText = [
      `${this.runningLabel}... 경과 ${elapsed}s / 최대 ${this.plugin.settings.codexTimeoutSeconds}s`,
      this.plugin.getCodexRuntimeSummary(),
      "긴 Canvas/드로잉 생성은 Codex가 파일을 읽고 쓰는 동안 이 패널에서 대기합니다.",
    ].join("\n");
  }
}

class PanelRuntimeStyleModal extends Modal {
  private draft: CodexExcalidrawSettings;

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private plugin: CodexExcalidrawPlugin,
    private view: CodexExcalidrawPanelView,
  ) {
    super(app);
    this.draft = { ...plugin.settings };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    preparePanelModal(this, contentEl);
    contentEl.createEl("h2", { text: "실행 / 스타일" });
    contentEl.createEl("p", {
      cls: "codex-excalidraw-config-note",
      text: "패널에는 현재값만 작게 표시하고, 실행 모델과 드로잉 스타일은 여기서 저장합니다.",
    });

    let sourceDropdown: { setValue(value: string): unknown } | null = null;

    new Setting(contentEl)
      .setName("런타임")
      .setDesc("Codexian 설정을 우선 사용합니다. 모델을 직접 바꾸면 Custom fallback으로 전환됩니다.")
      .addDropdown((dropdown) => {
        sourceDropdown = dropdown;
        dropdown
          .addOptions({
            codexian: "Codexian",
            custom: "Custom",
          })
          .setValue(this.draft.codexSettingsSource)
          .onChange((value) => {
            this.draft.codexSettingsSource = value === "custom" ? "custom" : "codexian";
          });
      });

    new Setting(contentEl)
      .setName("모델")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.codexModel)
          .setValue(this.draft.codexModel)
          .onChange((value) => {
            this.draft.codexSettingsSource = "custom";
            sourceDropdown?.setValue("custom");
            this.draft.codexModel = value.trim() || DEFAULT_SETTINGS.codexModel;
          }),
      );

    new Setting(contentEl)
      .setName("추론")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            low: "low",
            medium: "medium",
            high: "high",
            xhigh: "xhigh",
          })
          .setValue(this.draft.codexReasoningEffort)
          .onChange((value) => {
            this.draft.codexSettingsSource = "custom";
            sourceDropdown?.setValue("custom");
            this.draft.codexReasoningEffort = value as CodexExcalidrawSettings["codexReasoningEffort"];
          }),
      );

    new Setting(contentEl)
      .setName("권한")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            review: "review",
            auto: "auto",
            yolo: "yolo",
          })
          .setValue(this.draft.codexPermissionMode)
          .onChange((value) => {
            this.draft.codexSettingsSource = "custom";
            sourceDropdown?.setValue("custom");
            this.draft.codexPermissionMode = value as CodexExcalidrawSettings["codexPermissionMode"];
          }),
      );

    let timeoutLabel: HTMLElement | null = null;
    const timeoutSetting = new Setting(contentEl)
      .setName("제한")
      .setDesc("Codex CLI가 노트를 읽고 결과 파일을 쓰는 최대 시간입니다.")
      .addSlider((slider) =>
        slider
          .setLimits(60, 1200, 60)
          .setValue(this.draft.codexTimeoutSeconds)
          .onChange((value) => {
            this.draft.codexTimeoutSeconds = value;
            timeoutLabel?.setText(`${value}s`);
          }),
      );
    timeoutLabel = timeoutSetting.controlEl.createSpan({
      cls: "codex-excalidraw-modal-value",
      text: `${this.draft.codexTimeoutSeconds}s`,
    });

    new Setting(contentEl)
      .setName("테마")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            chalkboard: "칠판",
            whiteboard: "화이트보드",
          })
          .setValue(this.draft.visualTheme)
          .onChange((value) => {
            this.draft.visualTheme = value === "whiteboard" ? "whiteboard" : "chalkboard";
          }),
      );

    new Setting(contentEl)
      .setName("폰트")
      .setDesc("한글 손글씨는 Excalidraw Local Font에 실제 TTF가 지정되어 있어야 가장 자연스럽습니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "4": "Local Font",
            "1": "Virgil",
            "2": "Normal",
            "3": "Code",
          })
          .setValue(String(this.draft.handwritingFontFamily))
          .onChange((value) => {
            this.draft.handwritingFontFamily = Number.parseInt(value, 10) || DEFAULT_SETTINGS.handwritingFontFamily;
          }),
      );

    let scaleLabel: HTMLElement | null = null;
    const scaleSetting = new Setting(contentEl)
      .setName("글자")
      .setDesc("생성되는 Excalidraw 텍스트, 박스, 화살표 비율을 함께 조정합니다.")
      .addSlider((slider) =>
        slider
          .setLimits(0.75, 1.5, 0.05)
          .setValue(this.draft.studyNoteFontScale)
          .onChange((value) => {
            this.draft.studyNoteFontScale = roundPanelScale(value);
            scaleLabel?.setText(`${this.draft.studyNoteFontScale.toFixed(2)}x`);
          }),
      );
    scaleLabel = scaleSetting.controlEl.createSpan({
        cls: "codex-excalidraw-modal-value codex-excalidraw-modal-value-scale",
        text: `${this.draft.studyNoteFontScale.toFixed(2)}x`,
      });

    const footer = contentEl.createDiv({ cls: "codex-excalidraw-modal-footer" });
    footer.createEl("button", { text: "취소" }).addEventListener("click", () => this.close());
    const save = footer.createEl("button", { text: "저장" });
    save.addClass("mod-cta");
    save.addEventListener("click", () => {
      void this.save();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async save(): Promise<void> {
    Object.assign(this.plugin.settings, this.draft);
    await this.plugin.saveSettings();
    this.view.setStatus("실행 / 스타일 설정 저장됨");
    this.close();
  }
}

class PanelPromptToolsModal extends Modal {
  private selectedCategory: CodexPromptCategoryId = CODEX_PROMPT_CATEGORIES[0].id;
  private selectedPreset: CodexPromptPreset = firstPresetForCategory(this.selectedCategory);
  private previewEl: HTMLElement | null = null;

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private view: CodexExcalidrawPanelView,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    preparePanelModal(this, contentEl);
    this.renderModalHero(contentEl, "프롬프트 도구", "상황별 업무 템플릿과 시각화 프롬프트를 선택해 현재 입력창에 추가합니다.", "wand-sparkles", "✨");

    const picker = contentEl.createDiv({ cls: "codex-excalidraw-prompt-picker" });
    const controls = picker.createDiv({ cls: "codex-excalidraw-picker-controls" });
    const categoryField = this.createPickerField(controls, "카테고리", "노트 템플릿, DataviewJS/시각화, 드로잉 보정 중 선택합니다.");
    const categorySelect = categoryField.createEl("select");
    for (const category of CODEX_PROMPT_CATEGORIES) {
      categorySelect.createEl("option", {
        text: `${category.emoji} ${category.label}`,
        value: category.id,
      });
    }

    const presetField = this.createPickerField(controls, "템플릿", "선택한 카테고리에 맞는 프롬프트 방식만 표시합니다.");
    const presetSelect = presetField.createEl("select");
    const populatePresetSelect = () => {
      presetSelect.empty();
      const presets = CODEX_PROMPT_PRESETS.filter((preset) => preset.category === this.selectedCategory);
      for (const preset of presets) {
        presetSelect.createEl("option", {
          text: `${preset.emoji} ${preset.label}`,
          value: preset.id,
        });
      }
      presetSelect.value = this.selectedPreset.id;
    };
    categorySelect.value = this.selectedCategory;
    populatePresetSelect();
    categorySelect.addEventListener("change", () => {
      this.selectedCategory = categorySelect.value as CodexPromptCategoryId;
      this.selectedPreset = firstPresetForCategory(this.selectedCategory);
      populatePresetSelect();
      this.renderPresetPreview();
    });
    presetSelect.addEventListener("change", () => {
      this.selectedPreset = CODEX_PROMPT_PRESETS.find((preset) => preset.id === presetSelect.value) ?? this.selectedPreset;
      this.renderPresetPreview();
    });

    this.previewEl = picker.createDiv({ cls: "codex-excalidraw-preset-preview" });
    this.renderPresetPreview();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private createPickerField(parent: HTMLElement, label: string, description: string): HTMLElement {
    const field = parent.createDiv({ cls: "codex-excalidraw-picker-field" });
    field.createDiv({ cls: "codex-excalidraw-picker-label", text: label });
    field.createDiv({ cls: "codex-excalidraw-picker-desc", text: description });
    return field;
  }

  private renderPresetPreview(): void {
    if (!this.previewEl) return;
    this.previewEl.empty();
    const category = getPromptCategory(this.selectedPreset.category);
    const outputFolder = this.view.getOutputFolderForPrompt(this.selectedPreset);

    const top = this.previewEl.createDiv({ cls: "codex-excalidraw-preset-topline" });
    const iconWrap = top.createDiv({ cls: "codex-excalidraw-preset-icon" });
    iconWrap.createSpan({ cls: "codex-excalidraw-preset-emoji", text: this.selectedPreset.emoji });
    const svgIcon = iconWrap.createSpan({ cls: "codex-excalidraw-preset-svg" });
    setIcon(svgIcon, this.selectedPreset.icon);
    const title = top.createDiv({ cls: "codex-excalidraw-preset-title-block" });
    title.createDiv({ cls: "codex-excalidraw-modal-card-kicker", text: `${category.emoji} ${category.label}` });
    title.createDiv({ cls: "codex-excalidraw-preset-title", text: this.selectedPreset.label });
    title.createDiv({ cls: "codex-excalidraw-preset-desc", text: this.selectedPreset.description });

    const meta = this.previewEl.createDiv({ cls: "codex-excalidraw-preset-meta" });
    this.addMeta(meta, "종류", this.selectedPreset.kind);
    this.addMeta(meta, "저장", outputFolder);
    this.addMeta(meta, "힌트", this.selectedPreset.outputHint);

    const preview = this.previewEl.createDiv({ cls: "codex-excalidraw-preset-instruction" });
    preview.createDiv({ cls: "codex-excalidraw-modal-card-kicker", text: "프롬프트 미리보기" });
    preview.createDiv({ text: truncate(this.selectedPreset.instruction, 420) });

    const footer = this.previewEl.createDiv({ cls: "codex-excalidraw-modal-footer" });
    footer.createEl("button", { text: "닫기" }).addEventListener("click", () => this.close());
    const add = footer.createEl("button", { text: "입력창에 추가" });
    add.addClass("mod-cta");
    add.addEventListener("click", () => {
      this.view.applyPromptPreset(this.selectedPreset.label, this.buildInstruction(this.selectedPreset, outputFolder));
      this.close();
    });
  }

  private addMeta(parent: HTMLElement, label: string, value: string): void {
    const item = parent.createDiv({ cls: "codex-excalidraw-preset-meta-item" });
    item.createSpan({ text: label });
    item.createEl("strong", { text: value });
  }

  private buildInstruction(preset: CodexPromptPreset, outputFolder: string): string {
    return [
      preset.instruction,
      "",
      "# 저장/작업 기준",
      `- 이 프롬프트의 권장 산출물: ${preset.kind}`,
      `- 저장 또는 새 파일 생성이 필요한 경우 우선 폴더: ${outputFolder}`,
      "- 원본 Markdown 노트는 직접 덮어쓰지 말고, 수정이 필요하면 안전한 사본이나 새 산출물에 적용하라.",
      "- 노트의 도메인을 먼저 판별하고, 특정 경영분석/운임/PSBall 같은 예시 용어를 원문에 없으면 절대 끌어오지 말라.",
      "- 결과는 예쁘기보다 판단과 이해가 빨라야 하며, 마지막에 무엇이 좋아졌는지 3줄 이내로 보고하라.",
    ].join("\n");
  }

  private renderModalHero(contentEl: HTMLElement, title: string, subtitle: string, icon: string, emoji: string): void {
    const hero = contentEl.createDiv({ cls: "codex-excalidraw-modal-hero" });
    const mark = hero.createDiv({ cls: "codex-excalidraw-modal-hero-mark" });
    mark.createSpan({ cls: "codex-excalidraw-modal-hero-emoji", text: emoji });
    const iconEl = mark.createSpan({ cls: "codex-excalidraw-modal-hero-icon" });
    setIcon(iconEl, icon);
    const copy = hero.createDiv({ cls: "codex-excalidraw-modal-hero-copy" });
    copy.createEl("h2", { text: title });
    copy.createEl("p", { text: subtitle });
  }
}

class PanelActionModal extends Modal {
  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private view: CodexExcalidrawPanelView,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    preparePanelModal(this, contentEl);
    this.renderModalHero(contentEl, "드로잉 / Canvas 작업", "현재 활성 노트나 드로잉을 기준으로 만들 결과물의 형태를 고르세요.", "network", "🗺️");

    const grid = contentEl.createDiv({ cls: "codex-excalidraw-action-grid" });
    for (const card of PANEL_ACTION_CARDS) {
      this.addActionCard(grid, card);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addActionCard(parent: HTMLElement, spec: PanelActionCardSpec): void {
    const card = parent.createEl("button", { cls: "codex-excalidraw-action-card" });
    card.setAttr("type", "button");
    card.setAttr("aria-label", `${spec.label} 실행`);
    const head = card.createDiv({ cls: "codex-excalidraw-action-card-head" });
    const iconWrap = head.createDiv({ cls: "codex-excalidraw-action-icon" });
    iconWrap.createSpan({ cls: "codex-excalidraw-action-emoji", text: spec.emoji });
    const icon = iconWrap.createSpan({ cls: "codex-excalidraw-action-svg" });
    setIcon(icon, spec.icon);
    const title = head.createDiv({ cls: "codex-excalidraw-action-title-block" });
    title.createDiv({ cls: "codex-excalidraw-modal-card-title", text: spec.label });
    title.createDiv({ cls: "codex-excalidraw-modal-card-desc", text: spec.description });
    head.createSpan({
      cls: `codex-excalidraw-action-badge codex-excalidraw-action-badge-${spec.badge.toLowerCase()}`,
      text: spec.badge,
    });

    const preview = card.createDiv({ cls: `codex-excalidraw-action-preview codex-excalidraw-action-preview-${spec.previewKind}` });
    for (const line of spec.previewLines) {
      preview.createSpan({ text: line });
    }

    const footer = card.createDiv({ cls: "codex-excalidraw-action-footer" });
    footer.createSpan({ cls: "codex-excalidraw-action-folder", text: `저장: ${this.view.getOutputFolderForAction(spec.id)}` });
    footer.createSpan({ cls: "codex-excalidraw-modal-card-action", text: "실행" });

    card.addEventListener("click", () => {
      this.close();
      this.runAction(spec.id);
    });
  }

  private runAction(id: PanelActionCardId): void {
    switch (id) {
      case "basic-study-note":
        void this.view.runNoteStudyAction();
        return;
      case "copy-brief":
        void this.view.copyBriefAction();
        return;
      case "study-note":
      case "obsidian-canvas":
      case "context-map":
      case "revise-active":
      case "svg-sketch":
        void this.view.runPanelAction(id);
    }
  }

  private renderModalHero(contentEl: HTMLElement, title: string, subtitle: string, icon: string, emoji: string): void {
    const hero = contentEl.createDiv({ cls: "codex-excalidraw-modal-hero" });
    const mark = hero.createDiv({ cls: "codex-excalidraw-modal-hero-mark" });
    mark.createSpan({ cls: "codex-excalidraw-modal-hero-emoji", text: emoji });
    const iconEl = mark.createSpan({ cls: "codex-excalidraw-modal-hero-icon" });
    setIcon(iconEl, icon);
    const copy = hero.createDiv({ cls: "codex-excalidraw-modal-hero-copy" });
    copy.createEl("h2", { text: title });
    copy.createEl("p", { text: subtitle });
  }
}

interface PanelActionCardSpec {
  id: PanelActionCardId;
  label: string;
  emoji: string;
  icon: string;
  badge: "Excalidraw" | "Canvas" | "Brief";
  previewKind: "board" | "canvas" | "flow" | "revise" | "svg" | "brief";
  previewLines: string[];
  description: string;
}

const PANEL_ACTION_CARDS: PanelActionCardSpec[] = [
  {
    id: "basic-study-note",
    label: "노트→한눈필기",
    emoji: "✍️",
    icon: "notebook-pen",
    badge: "Excalidraw",
    previewKind: "board",
    previewLines: ["질문", "결론", "근거"],
    description: "Codex 없이 현재 노트 기반 기본 Excalidraw 필기를 빠르게 생성합니다.",
  },
  {
    id: "study-note",
    label: "Codex 한눈필기",
    emoji: "👩‍🏫",
    icon: "graduation-cap",
    badge: "Excalidraw",
    previewKind: "board",
    previewLines: ["질문", "잠정 결론", "다음 확인"],
    description: "Codex가 원문을 읽고 선생님 필기식 Excalidraw로 재구성합니다.",
  },
  {
    id: "obsidian-canvas",
    label: "Obsidian Canvas",
    emoji: "🧩",
    icon: "panel-top",
    badge: "Canvas",
    previewKind: "canvas",
    previewLines: ["원문", "개념", "근거"],
    description: "원문 파일 노드와 개념·근거 노드를 연결한 JSON Canvas를 생성/수정합니다.",
  },
  {
    id: "context-map",
    label: "Codex 맥락도",
    emoji: "🧭",
    icon: "route",
    badge: "Excalidraw",
    previewKind: "flow",
    previewLines: ["질문", "원인", "검증"],
    description: "질문, 결론, 원인, 근거, 불확실성, 검증 흐름으로 맥락도를 만듭니다.",
  },
  {
    id: "revise-active",
    label: "현재 드로잉 수정",
    emoji: "🛠️",
    icon: "pencil-ruler",
    badge: "Excalidraw",
    previewKind: "revise",
    previewLines: ["겹침 제거", "글자 확대", "의미 보강"],
    description: "열려 있는 Excalidraw 드로잉을 현재 입력 지시대로 다시 정리합니다.",
  },
  {
    id: "svg-sketch",
    label: "SVG식 도식",
    emoji: "💠",
    icon: "shapes",
    badge: "Excalidraw",
    previewKind: "svg",
    previewLines: ["정렬", "위계", "간결"],
    description: "기하학적으로 정돈된 SVG식 Excalidraw 도식을 생성합니다.",
  },
  {
    id: "copy-brief",
    label: "브리프 복사",
    emoji: "📋",
    icon: "clipboard-copy",
    badge: "Brief",
    previewKind: "brief",
    previewLines: ["원문", "요구사항", "검증"],
    description: "현재 노트 기반 Codex 작업 브리프를 클립보드로 복사합니다.",
  },
];

function preparePanelModal(modal: Modal, contentEl: HTMLElement): void {
  modal.modalEl.addClass("codex-excalidraw-config-modal-shell");
  contentEl.addClass("codex-excalidraw-config-modal");
}

function phaseLabel(phase: PanelPhase): string {
  switch (phase) {
    case "preparing":
      return "준비";
    case "reading":
      return "읽기";
    case "thinking":
      return "생각중";
    case "editing":
      return "편집";
    case "verifying":
      return "검증";
    case "complete":
      return "완료";
    case "failed":
      return "실패";
    case "idle":
    default:
      return "대기";
  }
}

function inferCodexPhase(text: string, stream: "stdout" | "stderr"): PanelPhase | null {
  const normalized = text.toLowerCase();
  if (isRecoverableCodexWarning(normalized)) return stream === "stderr" ? "thinking" : null;
  if (/(spawn .*enoent|enoent|timed out|exit code|codex cli failed|failed:|실패:)/.test(normalized)) return "failed";
  if (/(test|verify|verified|validation|validate|검증|확인|파싱|parse)/.test(normalized)) return "verifying";
  if (/(apply_patch|patch|write|written|edit|edited|modified|created|updated|delete|remove|rename|수정|편집|생성|저장|삭제)/.test(normalized)) {
    return "editing";
  }
  if (/(read|reading|open|opened|cat |sed |rg |grep|source|context|file|note|vault|읽|원문|노트|파일|맥락)/.test(normalized)) {
    return "reading";
  }
  if (stream === "stderr" || /(thinking|reason|analy|plan|compose|synthes|생각|추론|분석|구성)/.test(normalized)) {
    return "thinking";
  }
  return null;
}

function codexStatusLine(text: string, stream: "stdout" | "stderr"): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (isRecoverableCodexWarning(normalized.toLowerCase())) {
    return "외부 커넥터 인증 경고가 있었지만 Codex 실행은 계속 중입니다.";
  }
  return stream === "stderr" ? normalized.slice(-180) : normalized.slice(-180);
}

function isRecoverableCodexWarning(normalized: string): boolean {
  return /(invalid_token|missing or invalid access token|protected-resource|oauth|mcp)/.test(normalized)
    && !/(spawn .*enoent|enoent|timed out|exit code|fatal|codex cli failed)/.test(normalized);
}

function isSubmitShortcut(event: KeyboardEvent): boolean {
  if (event.isComposing) return false;
  const submitKey = event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter";
  return submitKey && (event.metaKey || event.ctrlKey);
}

function roundPanelScale(value: number): number {
  return Math.round(value * 100) / 100;
}

function fontLabel(value: number): string {
  switch (value) {
    case 1:
      return "Virgil";
    case 2:
      return "Normal";
    case 3:
      return "Code";
    case 4:
    default:
      return "Local Font";
  }
}
