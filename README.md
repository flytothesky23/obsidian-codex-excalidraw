# Codex Excalidraw

Generate editable Excalidraw diagrams from Obsidian Markdown notes.

## Commands

- `Create Excalidraw map from current note`
- `Create Excalidraw map from folder`
- `Create Excalidraw map from selected notes`
- `Create Excalidraw map from current note with Codex CLI`
- `Create Excalidraw map from folder with Codex CLI`
- `Create Excalidraw map from selected notes with Codex CLI`
- `Copy Codex drawing brief for current note`
- `Open Codex Excalidraw panel`

The generated files are `.excalidraw.md` Markdown drawings compatible with the Obsidian Excalidraw plugin.
The non-Codex commands create a deterministic local draft. The Codex CLI commands create the same draft first, then run `codex exec` from the vault root to refine only the generated drawing file.

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
3. Bump the plugin version with `npm version patch`, `npm version minor`, or an explicit version such as `npm version 0.2.1`.
4. Push the commit and tag to GitHub: `git push && git push --tags`.
5. GitHub Actions creates the release. BRAT can then update installed vaults from that release.

`npm version` updates `package.json`, `manifest.json`, and `versions.json` together. The release workflow fails if the Git tag does not match `manifest.json` and `package.json`.
