import { FuzzySuggestModal, Modal, Notice, Setting, TFile, TFolder } from "obsidian";

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: ConstructorParameters<typeof FuzzySuggestModal<TFolder>>[0],
    private onChoose: (folder: TFolder) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a folder to map");
  }

  getItems(): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  getItemText(folder: TFolder): string {
    return folder.path || "/";
  }

  onChooseItem(folder: TFolder): void {
    this.onChoose(folder);
  }
}

export class MultiFileModal extends Modal {
  private selected = new Set<string>();
  private filter = "";
  private listEl!: HTMLElement;

  constructor(
    app: ConstructorParameters<typeof Modal>[0],
    private files: TFile[],
    private onSubmit: (files: TFile[]) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("codex-excalidraw-modal");
    contentEl.createEl("h2", { text: "Select notes for Excalidraw map" });

    new Setting(contentEl).setName("Filter").addText((text) => {
      text.setPlaceholder("Type to filter by path").onChange((value) => {
        this.filter = value.toLowerCase();
        this.renderList();
      });
    });

    const controls = contentEl.createDiv({ cls: "codex-excalidraw-controls" });
    controls.createEl("button", { text: "Select visible" }).addEventListener("click", () => {
      for (const file of this.visibleFiles()) {
        this.selected.add(file.path);
      }
      this.renderList();
    });
    controls.createEl("button", { text: "Clear" }).addEventListener("click", () => {
      this.selected.clear();
      this.renderList();
    });

    this.listEl = contentEl.createDiv({ cls: "codex-excalidraw-file-list" });
    this.renderList();

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Generate")
          .setCta()
          .onClick(() => {
            const selectedFiles = this.files.filter((file) => this.selected.has(file.path));
            if (selectedFiles.length === 0) {
              new Notice("Select at least one note.");
              return;
            }
            this.close();
            this.onSubmit(selectedFiles);
          }),
      )
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderList(): void {
    this.listEl.empty();
    const files = this.visibleFiles().slice(0, 200);
    for (const file of files) {
      const row = this.listEl.createDiv({ cls: "codex-excalidraw-file-row" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selected.has(file.path);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selected.add(file.path);
        } else {
          this.selected.delete(file.path);
        }
      });
      row.createSpan({ text: file.path });
    }
    if (files.length === 0) {
      this.listEl.createEl("p", { text: "No matching Markdown files." });
    }
  }

  private visibleFiles(): TFile[] {
    return this.files.filter((file) => file.path.toLowerCase().includes(this.filter));
  }
}
