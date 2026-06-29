# Project Agent Rules

This repository develops an Obsidian plugin that may invoke Codex CLI from inside Obsidian. Do not damage the user's global Codex or Codexian runtime configuration while working on this project.

## Never Change

- Do not change `/Users/flytothesky/.codex/config.toml` `service_tier` to `priority` or `default`.
- Current Codex CLI accepts only `fast` or `flex` for `service_tier`.
- Changing `service_tier` to `priority` or `default` immediately breaks Obsidian Codexian infographic generation.
- Do not delete, bypass, or replace `/Users/flytothesky/.local/bin/codexian-codex`.
- Do not reset or overwrite Codexian/Marktl operation settings such as `data.json` under `ObsidianLocalConfigs`.

## Allowed Invocation

- When invoking Codex CLI directly, use the existing `/opt/homebrew/bin/codex` or `/Users/flytothesky/.local/bin/codexian-codex`.
- If image generation is needed, add `--enable image_generation`.
- If `service_tier` must be set for a local command, use only `fast` or `flex`.
- Before touching global Codex settings, inspect the current value and create a backup first.

## Verification

- `rg -n "service_tier" /Users/flytothesky/.codex/config.toml` must report `fast` or `flex`.
- If Codexian image generation reports `unknown variant priority/default`, immediately suspect `service_tier` contamination.
