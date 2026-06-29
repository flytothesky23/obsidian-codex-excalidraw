import { describe, expect, it } from "vitest";
import { codexExecArgs, resolveCodexCommand } from "../src/codex-cli";

describe("Codex CLI command", () => {
  it("uses workspace write mode and stdin prompt", () => {
    expect(codexExecArgs()).toEqual([
      "exec",
      "-c",
      'service_tier="fast"',
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-",
    ]);
  });

  it("can pin the model and reasoning effort for semantic drawing", () => {
    expect(codexExecArgs({ model: "gpt-5.5", reasoningEffort: "xhigh" })).toEqual([
      "exec",
      "-m",
      "gpt-5.5",
      "-c",
      'service_tier="fast"',
      "-c",
      'model_reasoning_effort="xhigh"',
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-",
    ]);
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
});
