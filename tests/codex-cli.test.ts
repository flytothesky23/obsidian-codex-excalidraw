import { describe, expect, it } from "vitest";
import {
  buildCodexEnvironment,
  codexExecArgs,
  parseEnvironmentVariables,
  resolveCodexCommand,
} from "../src/codex-cli";

describe("Codex CLI command", () => {
  it("uses Codexian-style workspace write mode and stdin prompt", () => {
    expect(codexExecArgs()).toEqual([
      "exec",
      "--color",
      "never",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-",
    ]);
  });

  it("can pin the model and reasoning effort for semantic drawing", () => {
    expect(codexExecArgs({
      model: "gpt-5.5",
      reasoningEffort: "xhigh",
      cwd: "/vault",
      outputLastMessagePath: "/tmp/last.md",
    })).toEqual([
      "exec",
      "--color",
      "never",
      "--output-last-message",
      "/tmp/last.md",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "--cd",
      "/vault",
      "--model",
      "gpt-5.5",
      "--config",
      'model_reasoning_effort="xhigh"',
      "-",
    ]);
  });

  it("maps permission modes to Codex CLI flags", () => {
    expect(codexExecArgs({ permissionMode: "auto" })).toContain("--full-auto");
    expect(codexExecArgs({ permissionMode: "yolo" })).toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("resolves bare codex to the first executable absolute path", () => {
    const command = resolveCodexCommand(
      "codex",
      ["/missing/codexian-codex", "/opt/homebrew/bin/codex", "codex"],
      (path) => path === "/opt/homebrew/bin/codex",
    );

    expect(command).toBe("/opt/homebrew/bin/codex");
  });

  it("preserves an explicit Codex command path", () => {
    expect(resolveCodexCommand("/custom/bin/codex", ["/opt/homebrew/bin/codex"], () => true)).toBe("/custom/bin/codex");
  });

  it("parses Codexian-style environment variables", () => {
    expect(parseEnvironmentVariables("CODEX_HOME=/Users/me/.codex\n# ignored\nPATH=/opt/homebrew/bin")).toEqual({
      CODEX_HOME: "/Users/me/.codex",
      PATH: "/opt/homebrew/bin",
    });
  });

  it("adds the resolved command directory to PATH", () => {
    const env = buildCodexEnvironment("PATH=/usr/bin", "/Users/me/.local/bin/codexian-codex");
    expect(env.PATH?.split(":").slice(0, 2)).toEqual(["/Users/me/.local/bin", "/usr/bin"]);
  });
});
