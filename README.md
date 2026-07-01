# Codex Excalidraw

Generate editable Excalidraw diagrams from Obsidian Markdown notes.

This plugin also supports Obsidian Canvas JSON workflows inspired by the Claude Code x Obsidian Canvas pattern: `.canvas` files are plain JSON, so Codex can directly read, arrange, recolor, and revise them.

## Commands

- `Create Excalidraw map from current note`
- `Create Excalidraw map from folder`
- `Create Excalidraw map from selected notes`
- `Create Excalidraw map from current note with Codex CLI`
- `Create Excalidraw map from folder with Codex CLI`
- `Create Excalidraw map from selected notes with Codex CLI`
- `Create Obsidian Canvas from current note`
- `Create Obsidian Canvas from current note with Codex CLI`
- `Copy Codex drawing brief for current note`
- `Open Codex drawing side panel`
- `Revise active Excalidraw drawing with Codex panel`

The generated files are `.excalidraw.md` Markdown drawings compatible with the Obsidian Excalidraw plugin.
The non-Codex commands create a deterministic local draft. The Codex CLI commands create the same draft first, then run `codex exec` from the vault root to refine only the generated drawing file.

If the output folder is a Google Drive CloudStorage folder reached through a vault symlink, Codex may not be allowed to write that symlink target directly. In that case the plugin creates a temporary working copy under `Codex Maps/_codex_bridge`, asks Codex to edit only that copy, validates the result, then writes the validated file back to the original Google Drive location through Obsidian's vault adapter. The final drawing or Canvas still stays in the configured output folder.

## Codex side panel

The plugin opens `Codex Drawing` in the right sidebar on startup by default. The left ribbon icon also opens the panel. Use it to drive drawing work with short instructions:

- create a Korean handwritten study note from the current Markdown note
- create a semantic context diagram from the current note and linked notes
- revise the active `.excalidraw.md` drawing in place
- ask for an SVG-like clean diagram while keeping editable Excalidraw elements
- create or revise an Obsidian `.canvas` JSON file from the current Markdown note

The panel includes reusable prompt presets for readability, teacher-at-the-board notes, logic-spine extraction, whiteboard conversion, compact summaries, and content enrichment.

The panel also includes a lightweight Codex chat area. It reads the active file as context, answers in the panel, and only edits vault files when the user explicitly asks for an edit. The `Codexian 열기` action hands the active note to the installed Codexian plugin and opens Codexian's own chat panel.

## Codexian integration

By default, Codex Excalidraw uses the existing Codexian plugin runtime settings when Codexian is loaded:

- `codexCliPath`
- `codexModel`
- `reasoningEffort`
- `permissionMode`
- `environmentVariables`

Custom Codex settings in this plugin are fallback values only. The plugin does not rewrite global Codex CLI configuration and does not overwrite Codexian or Marktl operating `data.json` files.

## Obsidian Canvas mode

Canvas mode is for the workflow shown in the reference video:

- create `.canvas` files instead of `.excalidraw.md`
- keep source Markdown as openable `file` nodes
- add concept, evidence, risk, and action nodes
- use groups, preset colors, and edges for readable structure
- let Codex CLI directly revise the JSON Canvas file later

Use this when you want Obsidian-native editable canvases. Use Excalidraw mode when you want hand-drawn board-style study notes.

## Readability settings

The settings tab includes:

- visual theme: chalkboard or whiteboard
- handwriting font slot: use Excalidraw `Local Font` for Korean handwriting
- study note text scale: scales generated text, panels, and arrows together

The actual Korean handwriting TTF is still configured in the Obsidian Excalidraw plugin's Local Font settings.

On macOS, Obsidian may not inherit the terminal `PATH`. When Codexian is installed, this plugin reuses Codexian's environment variables so the same `CODEX_HOME`, `PATH`, and wrapper command are used. If Codexian is not loaded, set the custom fallback command to an absolute path such as `/Users/flytothesky/.local/bin/codexian-codex` or `/opt/homebrew/bin/codex`.

## BRAT install

Use this repository URL in BRAT after publishing it to GitHub. This plugin is intended to update through GitHub releases.

Release assets uploaded by the workflow:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`
- `checksums.txt`

## Release process

1. Make code changes.
2. Run `npm test` and `npm run build`.
3. Bump the plugin version with `npm version patch`, `npm version minor`, or an explicit version such as `npm version 0.3.0`.
4. Push the commit and tag to GitHub: `git push && git push --tags`.
5. GitHub Actions creates the release. BRAT can then update installed vaults from that release.

`npm version` updates `package.json`, `manifest.json`, and `versions.json` together. The release workflow fails if the Git tag does not match `manifest.json` and `package.json`.
