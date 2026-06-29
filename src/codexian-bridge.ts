import type { App } from "obsidian";

export type CodexPermissionMode = "review" | "auto" | "yolo";
export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface CodexRuntimeConfig {
  source: "codexian" | "custom";
  command: string;
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  permissionMode: CodexPermissionMode;
  environmentVariables: string;
}

interface CodexianSettings {
  codexCliPath?: string;
  codexModel?: string;
  reasoningEffort?: string;
  permissionMode?: string;
  environmentVariables?: string;
}

export interface CodexianPluginApi {
  settings?: CodexianSettings;
  activateView?: () => void | Promise<void>;
  pinNote?: (path: string) => void | Promise<void>;
  attachCurrentNoteToChat?: () => void | Promise<void>;
  refreshOpenViews?: () => void;
}

type ObsidianAppWithPlugins = App & {
  plugins?: {
    plugins?: Record<string, unknown>;
  };
};

export function getCodexianPlugin(app: App): CodexianPluginApi | null {
  const plugin = (app as ObsidianAppWithPlugins).plugins?.plugins?.codexian;
  if (!plugin || typeof plugin !== "object") return null;
  return plugin as CodexianPluginApi;
}

export function getCodexianRuntime(app: App): CodexRuntimeConfig | null {
  const settings = getCodexianPlugin(app)?.settings;
  if (!settings) return null;

  const command = settings.codexCliPath?.trim();
  const model = settings.codexModel?.trim();
  return {
    source: "codexian",
    command: command || "codex",
    model: model || undefined,
    reasoningEffort: normalizeReasoningEffort(settings.reasoningEffort),
    permissionMode: normalizePermissionMode(settings.permissionMode),
    environmentVariables: settings.environmentVariables ?? "",
  };
}

export function normalizeReasoningEffort(value: string | undefined): CodexReasoningEffort | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") return value;
  return undefined;
}

export function normalizePermissionMode(value: string | undefined): CodexPermissionMode {
  if (value === "auto" || value === "yolo") return value;
  return "review";
}
