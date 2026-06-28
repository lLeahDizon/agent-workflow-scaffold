import type { AgentTarget, HeadroomOptions, ProjectProfile } from "../types.js";
import { renderMcpServersSnippet, renderMcpServerSnippet } from "./helpers.js";

export function buildMcpCommand(): { command: string; args: string[] } {
  return {
    command: "npx",
    args: ["-y", "@tungee/agent-workflow-scaffold", "mcp", "serve"]
  };
}

function tomlServer(name: string, command: string, args: string[], cwd?: string): string {
  return [
    `[mcp_servers.${name}]`,
    `command = ${JSON.stringify(command)}`,
    `args = [${args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
    ...(cwd ? [`cwd = ${JSON.stringify(cwd)}`] : [])
  ].join("\n");
}

export function renderMcpConfig(target: AgentTarget, profile: ProjectProfile, headroom?: HeadroomOptions): string {
  const command = buildMcpCommand();
  const config = target === "trae"
    ? renderMcpServerSnippet(command.command, command.args, profile.rootPath)
    : renderMcpServersSnippet([
        { name: "agent-workflow-scaffold", command: command.command, args: command.args, cwd: profile.rootPath },
        ...(headroom?.enabled ? [{ name: "headroom", command: headroom.command, args: headroom.args }] : [])
      ]);
  if (target === "codex") {
    return [
      tomlServer("agent-workflow-scaffold", command.command, command.args, profile.rootPath),
      ...(headroom?.enabled ? ["", tomlServer("headroom", headroom.command, headroom.args)] : [])
    ].join("\n");
  }
  return `${JSON.stringify(config, null, 2)}\n`;
}
