import { spawn } from "child_process";
import { existsSync, readFileSync, rmSync } from "fs";
import { tmpdir, homedir } from "os";
import { delimiter, dirname, join, sep } from "path";
import type { CodexPermissionMode } from "./codexian-bridge";

export interface CodexCliResult {
  stdout: string;
  stderr: string;
}

export function codexExecArgs(params: {
  model?: string;
  reasoningEffort?: string;
  permissionMode?: CodexPermissionMode;
  cwd?: string;
  outputLastMessagePath?: string;
} = {}): string[] {
  const args = ["exec", "--color", "never"];
  if (params.outputLastMessagePath?.trim()) {
    args.push("--output-last-message", params.outputLastMessagePath.trim());
  }
  if (params.permissionMode === "yolo") {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else if (params.permissionMode === "auto") {
    args.push("--full-auto");
  } else {
    args.push("--sandbox", "workspace-write");
  }
  args.push("--skip-git-repo-check");
  if (params.cwd?.trim()) {
    args.push("--cd", params.cwd.trim());
  }
  if (params.model?.trim()) {
    args.push("--model", params.model.trim());
  }
  if (params.reasoningEffort?.trim()) {
    args.push("--config", `model_reasoning_effort="${params.reasoningEffort.trim()}"`);
  }
  args.push("-");
  return args;
}

export const CODEX_COMMAND_CANDIDATES = [
  "/Users/flytothesky/.local/bin/codexian-codex",
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
  "codex",
];

export function resolveCodexCommand(
  command: string | undefined,
  candidates = CODEX_COMMAND_CANDIDATES,
  exists: (path: string) => boolean = existsSync,
): string {
  const requested = expandHome(command?.trim() || "codex");
  if (requested !== "codex") return requested;

  for (const candidate of candidates) {
    if (candidate === "codex") continue;
    if (exists(candidate)) return candidate;
  }

  return requested;
}

export function parseEnvironmentVariables(value: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (key) env[key] = rawValue;
  }
  return env;
}

export function buildCodexEnvironment(environmentVariables = "", command?: string): NodeJS.ProcessEnv {
  const parsed = parseEnvironmentVariables(environmentVariables);
  const env: NodeJS.ProcessEnv = { ...process.env, ...parsed };
  const pathEntries = [
    ...(env.PATH ?? "").split(delimiter),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];

  const expandedCommand = expandHome(command ?? "");
  if (expandedCommand.includes(sep)) {
    pathEntries.unshift(dirname(expandedCommand));
  }

  env.PATH = uniquePath(pathEntries);
  return env;
}

export async function runCodexExec(params: {
  command: string;
  cwd: string;
  prompt: string;
  model?: string;
  reasoningEffort?: string;
  permissionMode?: CodexPermissionMode;
  environmentVariables?: string;
  timeoutMs: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}): Promise<CodexCliResult> {
  return new Promise((resolve, reject) => {
    const command = resolveCodexCommand(params.command);
    const outputLastMessagePath = join(
      tmpdir(),
      `codex-excalidraw-last-message-${Date.now()}-${Math.random().toString(36).slice(2)}.md`,
    );
    const env = buildCodexEnvironment(params.environmentVariables, command);
    const child = spawn(command, codexExecArgs({
      model: params.model,
      reasoningEffort: params.reasoningEffort,
      permissionMode: params.permissionMode,
      cwd: params.cwd,
      outputLastMessagePath,
    }), {
      cwd: params.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      rmSync(outputLastMessagePath, { force: true });
      reject(new Error(`Codex CLI timed out after ${Math.round(params.timeoutMs / 1000)} seconds.`));
    }, params.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      params.onStdout?.(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      params.onStderr?.(text);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      rmSync(outputLastMessagePath, { force: true });
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(`Codex CLI executable not found: ${command}. Set the plugin Codex CLI command to /Users/flytothesky/.local/bin/codexian-codex or /opt/homebrew/bin/codex.`));
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const lastMessage = readOutputLastMessage(outputLastMessagePath);
      rmSync(outputLastMessagePath, { force: true });
      if (code === 0) {
        resolve({ stdout: lastMessage || stdout, stderr });
      } else {
        reject(new Error(`Codex CLI exited with code ${code ?? "unknown"}.\n${stderr || stdout}`));
      }
    });

    child.stdin.write(params.prompt);
    child.stdin.end();
  });
}

function readOutputLastMessage(path: string): string {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

function expandHome(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith(`~${sep}`)) return join(homedir(), value.slice(2));
  return value;
}

function uniquePath(entries: string[]): string {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output.join(delimiter);
}
