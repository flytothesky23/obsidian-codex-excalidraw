import { spawn } from "child_process";
import { existsSync } from "fs";

export interface CodexCliResult {
  stdout: string;
  stderr: string;
}

export function codexExecArgs(params: {
  model?: string;
  reasoningEffort?: string;
} = {}): string[] {
  const args = ["exec"];
  if (params.model?.trim()) {
    args.push("-m", params.model.trim());
  }
  args.push("-c", 'service_tier="fast"');
  if (params.reasoningEffort?.trim()) {
    args.push("-c", `model_reasoning_effort="${params.reasoningEffort.trim()}"`);
  }
  args.push("--sandbox", "workspace-write", "--skip-git-repo-check", "-");
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
  const requested = command?.trim() || "codex";
  if (requested !== "codex") return requested;

  for (const candidate of candidates) {
    if (candidate === "codex") continue;
    if (exists(candidate)) return candidate;
  }

  return requested;
}

export async function runCodexExec(params: {
  command: string;
  cwd: string;
  prompt: string;
  model?: string;
  reasoningEffort?: string;
  timeoutMs: number;
}): Promise<CodexCliResult> {
  return new Promise((resolve, reject) => {
    const command = resolveCodexCommand(params.command);
    const child = spawn(command, codexExecArgs({
      model: params.model,
      reasoningEffort: params.reasoningEffort,
    }), {
      cwd: params.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`Codex CLI timed out after ${Math.round(params.timeoutMs / 1000)} seconds.`));
    }, params.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
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
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Codex CLI exited with code ${code ?? "unknown"}.\n${stderr || stdout}`));
      }
    });

    child.stdin.write(params.prompt);
    child.stdin.end();
  });
}
