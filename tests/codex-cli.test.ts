import { describe, expect, it } from "vitest";
import { codexExecArgs } from "../src/codex-cli";

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
});
