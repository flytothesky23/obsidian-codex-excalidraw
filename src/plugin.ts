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
      await this.refineWithCodex(contexts, path);
    } else {
      const result = buildDiagram(
        contexts,
        defaultDiagramOptions(
          title,
          label,
          this.settings.visualTheme,
          this.settings.handwritingFontFamily,
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
    const brief = buildCodexBrief(contexts, targetPath);
    await navigator.clipboard.writeText(brief);
    new Notice(`Copied Codex drawing brief for ${contexts.length} note(s).`);
  }

  private async refineWithCodex(contexts: NoteContext[], targetPath: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      new Notice("Codex CLI refinement requires the desktop filesystem adapter.");
      return;
    }

    new Notice("Codex CLI is reading source notes and composing a semantic Excalidraw drawing...");
    const prompt = [
      buildCodexBrief(contexts, targetPath),
      "",
      "# Execution",
      "",
      "Read the source Markdown files from disk first.",
      `Edit only this target drawing file: ${targetPath}`,
      "Keep the drawing as editable Excalidraw Markdown. Do not create unrelated files.",
      "If the target file contains no useful elements, build the diagram from scratch.",
      "After editing, report a concise summary of the visual logic you created and which source claims anchor it.",
    ].join("\n");

    try {
      const result = await runCodexExec({
        command: this.settings.codexCommand,
        cwd: adapter.getBasePath(),
        prompt,
        model: this.settings.codexModel,
        reasoningEffort: this.settings.codexReasoningEffort,
        timeoutMs: this.settings.codexTimeoutSeconds * 1000,
      });
      const summary = (result.stdout || result.stderr).trim().split(/\r?\n/).slice(-2).join(" ");
      new Notice(`Codex CLI finished. ${summary ? summary.slice(0, 180) : "Drawing refined."}`, 10000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Codex CLI failed: ${message.slice(0, 220)}`, 12000);
    }
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

class CodexExcalidrawPanelView extends ItemView {
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
      text: active ? active.path : "No active Markdown note",
    });

    const prompt = root.createEl("textarea");
    prompt.addClass("codex-excalidraw-panel-prompt");
    prompt.placeholder = "생성 방향 메모: 예) 칠판 필기처럼, 핵심 지표와 다음 확인사항을 더 풍부하게";

    const actions = root.createDiv({ cls: "codex-excalidraw-panel-actions" });
    this.addButton(actions, "한눈필기 생성", () => {
      void this.plugin.createFromCurrentNote(false);
    });
    this.addButton(actions, "Codex CLI로 생성", () => {
      void this.plugin.createFromCurrentNote(true);
    });
    this.addButton(actions, "브리프 복사", () => {
      void this.plugin.copyCurrentCodexBrief();
    });

    root.createEl("p", {
      cls: "codex-excalidraw-panel-note",
      text: "현재 버전은 명령 실행 패널입니다. 대화형 수정 루프는 이 view 위에 이어 붙일 수 있습니다.",
    });
  }

  private addButton(parent: HTMLElement, label: string, onClick: () => void): void {
    const button = parent.createEl("button", { text: label });
    button.addEventListener("click", onClick);
  }
}
