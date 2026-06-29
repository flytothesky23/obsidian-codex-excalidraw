import { spawn } from "child_process";

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

export async function runCodexExec(params: {
  command: string;
  cwd: string;
  prompt: string;
  model?: string;
  reasoningEffort?: string;
  timeoutMs: number;
}): Promise<CodexCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(params.command, codexExecArgs({
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
      reject(error);
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
