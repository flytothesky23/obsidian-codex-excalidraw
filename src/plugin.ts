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
    const active = this.app.workspace.getActiveFile();
    if (!active) {
      throw new Error("Open a Markdown note or Excalidraw drawing first.");
    }

    if (action === "obsidian-canvas") {
      if (isCanvasFile(active)) {
        const summary = await this.reviseActiveCanvasWithCodex(active.path, instruction);
        return formatActionOutput(summary || "현재 Canvas 수정 완료", active.path);
      }
      if (isExcalidrawDrawing(active)) {
        throw new Error("Open a source Markdown note or an existing .canvas file for Obsidian Canvas work.");
      }
      const files = await this.expandLinkedNotes(active);
      const path = await this.createCanvasFromFiles(files, active.basename, true, instruction);
      return formatActionOutput("Obsidian Canvas 생성 완료", path);
    }

    if (action === "revise-active") {
      if (!isExcalidrawDrawing(active)) {
        throw new Error("Open an .excalidraw.md drawing before using current-drawing revision.");
      }
      const summary = await this.reviseActiveDrawingWithCodex(active.path, instruction);
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
    const summary = await this.refineWithCodex(contexts, path, instruction, action);

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
    const markdownRevisionCopy = active instanceof TFile && isPlainMarkdownNote(active) && shouldCreateMarkdownRevisionCopy(trimmedInstruction)
      ? await this.createMarkdownRevisionCopy(active)
      : null;
    const activeContent = active instanceof TFile
      ? truncate(await this.app.vault.cachedRead(active), this.settings.maxCharactersPerNote)
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
      active && markdownRevisionCopy ? `Original Markdown note is read-only for this request: ${active.path}` : "",
      "If the user explicitly asks to edit the current drawing, Canvas, or SVG/Excalidraw target, edit only that visual target file unless they name another file.",
      "If the user is asking a question, answer directly and do not modify files.",
      "When creating or revising visual notes, prefer readable teacher-board structure: question, provisional conclusion, evidence, tension, caveat, next check.",
      "",
      "# Active File",
      "",
      active ? active.path : "No active file.",
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
        `원본 노트는 수정하지 않았습니다: ${active?.path ?? "unknown"}`,
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
        await this.refineCanvasWithCodex(contexts, path, instruction);
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
    const path = await this.nextMarkdownSiblingPath(source, `${source.basename}_수정`);
    const created = await this.app.vault.create(path, content);
    if (!(created instanceof TFile)) {
      throw new Error(`Failed to create Markdown revision copy: ${path}`);
    }
    new Notice(`원본 보호: ${path} 사본을 만들고 이 파일만 수정합니다.`, 9000);
    return created;
  }

  private async nextMarkdownSiblingPath(source: TFile, basename: string): Promise<string> {
    const folder = source.parent?.path ?? "";
    let counter = 1;
    let path = normalizePath(folder ? `${folder}/${basename}.md` : `${basename}.md`);
    while (this.app.vault.getAbstractFileByPath(path)) {
      counter += 1;
      path = normalizePath(folder ? `${folder}/${basename} ${counter}.md` : `${basename} ${counter}.md`);
    }
    return path;
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

    const result = await this.runCodex(prompt);
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
    const result = await this.runCodex(prompt);
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    new Notice(`Codex CLI finished. ${summary || "Active drawing revised."}`, 10000);
    return summary;
  }

  private async refineCanvasWithCodex(
    contexts: NoteContext[],
    targetPath: string,
    instruction = "",
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
    const result = await this.runCodex(prompt);
    const stats = await this.validateCanvasTarget(targetPath);
    const summary = summarizeCodexResult(result.stdout || result.stderr);
    const verified = `검증: 텍스트 ${stats.textNodeCount}개, 원문 ${stats.fileNodeCount}개, 연결 ${stats.edgeCount}개`;
    new Notice(`Codex CLI finished. ${summary || "Canvas refined."} ${verified}`, 10000);
    return [summary, verified].filter(Boolean).join("\n");
  }

  private async reviseActiveCanvasWithCodex(targetPath: string, instruction: string): Promise<string> {
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
    const result = await this.runCodex(prompt);
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
      return "Create a one-screen Korean handwritten study note that improves understanding more than the original Markdown.";
    case "obsidian-canvas":
      return "Create or revise an Obsidian JSON Canvas: arrange file nodes, concept nodes, groups, colors, and edges so Claude/Codex can keep editing the plain JSON.";
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

interface PanelMessage {
  role: "user" | "assistant";
  text: string;
}

class CodexExcalidrawPanelView extends ItemView {
  private promptValue = "";
  private statusText = "";
  private isRunning = false;
  private messages: PanelMessage[] = [];
  private progressTimer: number | null = null;
  private runningStartedAt = 0;
  private runningLabel = "";
  private lastOutputPath = "";

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
    contentEl.empty();
    const root = contentEl.createDiv({ cls: "codex-excalidraw-panel" });
    root.createEl("h2", { text: "Codex Drawing" });

    const active = this.plugin.app.workspace.getActiveFile();
    root.createDiv({
      cls: "codex-excalidraw-panel-current",
      text: active ? active.path : "No active Markdown note or Excalidraw drawing",
    });
    root.createDiv({
      cls: "codex-excalidraw-panel-runtime",
      text: this.plugin.getCodexRuntimeSummary(),
    });

    this.renderStatus(root);
    this.renderControls(root);
    this.renderChat(root);
    this.renderComposer(root);

    const presetWrap = root.createDiv({ cls: "codex-excalidraw-panel-presets" });
    presetWrap.createDiv({ cls: "codex-excalidraw-panel-section-title", text: "프롬프트 도구" });
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
    actions.createDiv({ cls: "codex-excalidraw-panel-section-title", text: "드로잉 / Canvas 작업" });
    this.addButton(actions, "노트→한눈필기", () => {
      void this.plugin.createFromCurrentNote(false);
    }, this.isRunning);
    this.addButton(actions, "Codex 한눈필기", () => {
      void this.runPanelAction("study-note");
    }, this.isRunning);
    this.addButton(actions, "Obsidian Canvas", () => {
      void this.runPanelAction("obsidian-canvas");
    }, this.isRunning);
    this.addButton(actions, "Codex 맥락도", () => {
      void this.runPanelAction("context-map");
    }, this.isRunning);
    this.addButton(actions, "현재 드로잉 수정", () => {
      void this.runPanelAction("revise-active");
    }, this.isRunning);
    this.addButton(actions, "SVG식 도식", () => {
      void this.runPanelAction("svg-sketch");
    }, this.isRunning);
    this.addButton(actions, "브리프 복사", () => {
      void this.plugin.copyCurrentCodexBrief();
    }, this.isRunning);

    root.createEl("p", {
      cls: "codex-excalidraw-panel-note",
      text: "Codexian 설정을 우선 사용합니다. Markdown 원본은 읽기 전용으로 두고, 재구성·수정 요청은 같은 폴더의 _수정.md 사본에 적용합니다.",
    });
  }

  private renderStatus(root: HTMLElement): void {
    const status = root.createDiv({
      cls: `codex-excalidraw-panel-status codex-excalidraw-panel-status-${this.isRunning ? "running" : "idle"}`,
    });
    status.createDiv({ cls: "codex-excalidraw-panel-section-title", text: "작업 상태" });
    status.createDiv({
      cls: "codex-excalidraw-panel-status-main",
      text: this.statusText || "대기 중",
    });
    const progress = status.createDiv({ cls: "codex-excalidraw-panel-progress" });
    const fill = progress.createDiv({ cls: "codex-excalidraw-panel-progress-fill" });
    fill.style.width = `${this.progressPercent()}%`;
    if (this.lastOutputPath) {
      const output = status.createDiv({ cls: "codex-excalidraw-panel-output" });
      output.createDiv({ cls: "codex-excalidraw-panel-output-path", text: this.lastOutputPath });
      const actions = output.createDiv({ cls: "codex-excalidraw-panel-output-actions" });
      this.addButton(actions, "결과 열기", () => {
        void this.plugin.openVaultPath(this.lastOutputPath);
      }, this.isRunning);
      this.addButton(actions, "경로 복사", () => {
        void this.copyText(this.lastOutputPath, "결과 경로");
      }, this.isRunning);
    }
  }

  private progressPercent(): number {
    if (!this.isRunning || this.runningStartedAt <= 0) return 0;
    const elapsed = Math.max(0, Date.now() - this.runningStartedAt);
    const limit = Math.max(1, this.plugin.settings.codexTimeoutSeconds * 1000);
    return Math.min(100, Math.round((elapsed / limit) * 100));
  }

  private renderChat(root: HTMLElement): void {
    const shell = root.createDiv({ cls: "codex-excalidraw-panel-chat-shell" });
    const header = shell.createDiv({ cls: "codex-excalidraw-panel-chat-header" });
    header.createSpan({ cls: "codex-excalidraw-panel-chat-title", text: "Codex 대화창" });
    const chatActions = header.createDiv({ cls: "codex-excalidraw-panel-chat-actions" });
    chatActions.createSpan({
      cls: "codex-excalidraw-panel-chat-subtitle",
      text: this.isRunning ? "실행 중" : "현재 노트 맥락",
    });
    if (this.messages.length > 0) {
      this.addButton(chatActions, "전체 복사", () => {
        void this.copyText(this.chatTranscript(), "전체 대화");
      }, this.isRunning);
    }

    const chat = shell.createDiv({ cls: "codex-excalidraw-panel-chat-log" });
    if (this.messages.length === 0) {
      chat.createDiv({
        cls: "codex-excalidraw-panel-chat-empty",
        text: "아직 대화가 없습니다. 아래 입력창에 질문이나 수정 지시를 쓰고 `대화 보내기`를 누르세요.",
      });
      return;
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
      this.addButton(messageHead, "복사", () => {
        void this.copyText(message.text, message.role === "user" ? "내 메시지" : "Codex 응답");
      }, !message.text.trim());
      bubble.createEl("pre", {
        cls: "codex-excalidraw-panel-message-text",
        text: message.text || (message.role === "assistant" ? "응답 수신 중..." : ""),
      });
    }
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
    this.render();
  }

  private renderComposer(root: HTMLElement): void {
    const composer = root.createDiv({ cls: "codex-excalidraw-panel-composer" });
    composer.createDiv({ cls: "codex-excalidraw-panel-section-title", text: "Codex 입력" });

    const prompt = composer.createEl("textarea");
    prompt.addClass("codex-excalidraw-panel-prompt");
    prompt.value = this.promptValue;
    prompt.placeholder = "예) 이 Canvas를 영상처럼 원문 파일 노드 + 개념 노드 + 근거 노드 구조로 다시 정리해줘";
    prompt.disabled = this.isRunning;
    prompt.addEventListener("input", () => {
      this.promptValue = prompt.value;
    });
    prompt.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void this.runChat();
      }
    });

    const composerActions = composer.createDiv({ cls: "codex-excalidraw-panel-composer-actions" });
    this.addButton(composerActions, this.isRunning ? "Codex 실행 중..." : "대화 보내기", () => {
      void this.runChat();
    }, this.isRunning);
    this.addButton(composerActions, "Codexian 열기", () => {
      void this.plugin.openActiveFileInCodexian();
    }, this.isRunning);
  }

  private addButton(parent: HTMLElement, label: string, onClick: () => void, disabled = false): void {
    const button = parent.createEl("button", { text: label });
    button.disabled = disabled;
    button.addEventListener("click", onClick);
  }

  private renderControls(root: HTMLElement): void {
    const controls = root.createDiv({ cls: "codex-excalidraw-panel-controls" });
    controls.createDiv({ cls: "codex-excalidraw-panel-section-title", text: "실행 / 스타일" });

    const sourceRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    sourceRow.createSpan({ text: "런타임" });
    const sourceSelect = sourceRow.createEl("select");
    addOption(sourceSelect, "codexian", "Codexian");
    addOption(sourceSelect, "custom", "Custom");
    sourceSelect.value = this.plugin.settings.codexSettingsSource;
    sourceSelect.addEventListener("change", () => {
      this.plugin.settings.codexSettingsSource = sourceSelect.value === "custom" ? "custom" : "codexian";
      void this.plugin.saveSettings().then(() => this.render());
    });
    sourceRow.createSpan({ cls: "codex-excalidraw-panel-scale-value", text: "" });

    const modelRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    modelRow.createSpan({ text: "모델" });
    const modelInput = modelRow.createEl("input");
    modelInput.type = "text";
    modelInput.value = this.plugin.settings.codexModel;
    modelInput.placeholder = "gpt-5.5";
    modelInput.addEventListener("change", () => {
      this.plugin.settings.codexSettingsSource = "custom";
      this.plugin.settings.codexModel = modelInput.value.trim() || DEFAULT_SETTINGS.codexModel;
      this.statusText = "모델 설정 변경: Custom runtime 사용";
      void this.plugin.saveSettings().then(() => this.render());
    });
    modelRow.createSpan({ cls: "codex-excalidraw-panel-scale-value", text: "" });

    const effortRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    effortRow.createSpan({ text: "추론" });
    const effortSelect = effortRow.createEl("select");
    for (const effort of ["low", "medium", "high", "xhigh"]) addOption(effortSelect, effort, effort);
    effortSelect.value = this.plugin.settings.codexReasoningEffort;
    effortSelect.addEventListener("change", () => {
      this.plugin.settings.codexSettingsSource = "custom";
      this.plugin.settings.codexReasoningEffort = effortSelect.value as typeof this.plugin.settings.codexReasoningEffort;
      this.statusText = "추론 설정 변경: Custom runtime 사용";
      void this.plugin.saveSettings().then(() => this.render());
    });
    effortRow.createSpan({ cls: "codex-excalidraw-panel-scale-value", text: "" });

    const timeoutRow = controls.createDiv({ cls: "codex-excalidraw-panel-control-row" });
    timeoutRow.createSpan({ text: "제한" });
    const timeoutInput = timeoutRow.createEl("input");
    timeoutInput.type = "range";
    timeoutInput.min = "60";
    timeoutInput.max = "1200";
    timeoutInput.step = "60";
    timeoutInput.value = String(this.plugin.settings.codexTimeoutSeconds);
    const timeoutValue = timeoutRow.createSpan({
      cls: "codex-excalidraw-panel-scale-value",
      text: `${this.plugin.settings.codexTimeoutSeconds}s`,
    });
    timeoutInput.addEventListener("input", () => {
      const nextTimeout = Number.parseInt(timeoutInput.value, 10) || DEFAULT_SETTINGS.codexTimeoutSeconds;
      this.plugin.settings.codexTimeoutSeconds = nextTimeout;
      timeoutValue.setText(`${nextTimeout}s`);
      void this.plugin.saveSettings();
    });

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
    if (this.isRunning) return;
    this.startProgress(`${actionLabel(action)} 실행 중`);
    try {
      const summary = await this.plugin.runCodexPanelAction(action, this.promptValue);
      this.stopProgress();
      this.statusText = summary || `${actionLabel(action)} 완료`;
      this.lastOutputPath = extractOutputPath(summary) || this.lastOutputPath;
    } catch (error) {
      this.stopProgress();
      const message = error instanceof Error ? error.message : String(error);
      this.statusText = `실패: ${message.slice(0, 220)}`;
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
    this.startProgress("Codex 대화 응답 생성 중");

    try {
      const history = this.messages.slice(0, -2);
      const finalText = await this.plugin.runCodexChat(message, (chunk, stream) => {
        if (stream === "stdout") {
          assistantMessage.text = `${assistantMessage.text}${chunk}`.slice(-6000);
        } else {
          this.statusText = chunk.trim().slice(-240) || "Codex 실행 중...";
        }
        this.render();
      }, history);
      this.stopProgress();
      assistantMessage.text = finalText;
      this.lastOutputPath = extractOutputPath(finalText) || this.lastOutputPath;
      this.statusText = "Codex 응답 완료";
    } catch (error) {
      this.stopProgress();
      const text = error instanceof Error ? error.message : String(error);
      assistantMessage.text = `실패: ${text}`;
      this.statusText = `실패: ${text.slice(0, 220)}`;
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
    const elapsed = Math.max(0, Math.round((Date.now() - this.runningStartedAt) / 1000));
    this.statusText = [
      `${this.runningLabel}... 경과 ${elapsed}s / 최대 ${this.plugin.settings.codexTimeoutSeconds}s`,
      this.plugin.getCodexRuntimeSummary(),
      "긴 Canvas/드로잉 생성은 Codex가 파일을 읽고 쓰는 동안 이 패널에서 대기합니다.",
    ].join("\n");
  }
}

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement("option");
  option.value = value;
  option.text = label;
  select.appendChild(option);
}
