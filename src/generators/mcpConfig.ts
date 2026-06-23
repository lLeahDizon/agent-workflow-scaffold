import type { AgentTarget, ProjectProfile } from "../types.js";
import { renderMcpServerSnippet } from "./helpers.js";

export function buildMcpCommand(): { command: string; args: string[] } {
  return {
    command: "npx",
    args: ["-y", "@tungee/agent-workflow-scaffold", "mcp", "serve"]
  };
}

export function renderMcpConfig(target: AgentTarget, profile: ProjectProfile): string {
  const command = buildMcpCommand();
  const config = renderMcpServerSnippet(command.command, command.args, profile.rootPath);
  if (target === "codex") {
    return [
      "[mcp_servers.agent-workflow-scaffold]",
      `command = "${command.command}"`,
      `args = [${command.args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
      `cwd = "${profile.rootPath.replaceAll("\\", "\\\\")}"`
    ].join("\n");
  }
  return `${JSON.stringify(config, null, 2)}\n`;
}
