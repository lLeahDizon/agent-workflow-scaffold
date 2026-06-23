import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SubagentProfile } from "../types.js";
import { pathExists } from "../utils/fs.js";
import { slugifyProjectId } from "../utils/format.js";

interface AgencyAgentFrontmatter {
  name?: string;
  description?: string;
}

const DEFAULT_DIVISIONS = ["engineering", "design", "product", "security"];
const DEFAULT_ROLE_IDS = [
  "software-architect",
  "code-reviewer",
  "technical-writer",
  "frontend-developer",
  "backend-architect",
  "devops-automator",
  "database-optimizer"
];

function stripKnownPrefix(fileBaseName: string, division: string): string {
  return fileBaseName.startsWith(`${division}-`) ? fileBaseName.slice(division.length + 1) : fileBaseName;
}

function parseFrontmatter(content: string): AgencyAgentFrontmatter {
  if (!content.startsWith("---\n")) {
    return {};
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return {};
  }
  const body = content.slice(4, end);
  const output: AgencyAgentFrontmatter = {};
  for (const line of body.split("\n")) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    if (key === "name") {
      output.name = value;
    }
    if (key === "description") {
      output.description = value;
    }
  }
  return output;
}

function contentWithoutFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content.trim();
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return content.trim();
  }
  return content.slice(end + 4).trim();
}

async function listDivisionFiles(rootPath: string, divisions: string[]): Promise<Array<{ division: string; fileName: string; absolutePath: string }>> {
  const files: Array<{ division: string; fileName: string; absolutePath: string }> = [];
  for (const division of divisions) {
    const divisionPath = path.join(rootPath, division);
    if (!(await pathExists(divisionPath))) {
      continue;
    }
    const entries = await readdir(divisionPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({
          division,
          fileName: entry.name,
          absolutePath: path.join(divisionPath, entry.name)
        });
      }
    }
  }
  return files;
}

export async function loadAgencyAgents(input: {
  rootPath?: string;
  roleIds?: string[];
  divisions?: string[];
}): Promise<SubagentProfile[]> {
  if (!input.rootPath) {
    throw new Error("--agency-agents-path is required when --agent-provider is agency-agents or hybrid.");
  }

  const rootPath = path.resolve(input.rootPath);
  if (!(await pathExists(rootPath))) {
    throw new Error(`agency-agents path does not exist: ${rootPath}`);
  }

  const divisions = input.divisions?.length ? input.divisions : DEFAULT_DIVISIONS;
  const requestedRoleIds = new Set((input.roleIds?.length ? input.roleIds : DEFAULT_ROLE_IDS).map(slugifyProjectId));
  const files = await listDivisionFiles(rootPath, divisions);
  const selected: SubagentProfile[] = [];

  for (const file of files) {
    const fileBaseName = file.fileName.replace(/\.md$/i, "");
    const agentId = stripKnownPrefix(fileBaseName, file.division);
    const normalizedAgentId = slugifyProjectId(agentId);
    const normalizedFullId = slugifyProjectId(fileBaseName);
    if (!requestedRoleIds.has(normalizedAgentId) && !requestedRoleIds.has(normalizedFullId)) {
      continue;
    }

    const content = await readFile(file.absolutePath, "utf8");
    const frontmatter = parseFrontmatter(content);
    const name = frontmatter.name ?? agentId.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
    const description = frontmatter.description ?? `Agency Agents ${name} role from ${file.division}.`;

    selected.push({
      id: normalizedAgentId,
      name,
      description,
      whenToUse: [`Use when the task matches the ${name} role from agency-agents.`],
      responsibilities: [
        "Follow the upstream agency-agents role instructions.",
        "Apply the role through this repository's local Agent workflow rules.",
        "Preserve user-authored content outside managed blocks."
      ],
      targetTools: ["codex", "trae", "claude-code"],
      source: "agency-agents",
      sourcePath: path.relative(rootPath, file.absolutePath).split(path.sep).join(path.posix.sep),
      content: contentWithoutFrontmatter(content)
    });
  }

  if (selected.length === 0) {
    throw new Error(
      `No agency-agents roles matched. Check --agent-roles (${Array.from(requestedRoleIds).join(", ")}) and --agent-divisions (${divisions.join(", ")}).`
    );
  }

  return selected;
}

export function mergeSubagents(...groups: SubagentProfile[][]): SubagentProfile[] {
  const byId = new Map<string, SubagentProfile>();
  for (const group of groups) {
    for (const subagent of group) {
      byId.set(subagent.id, subagent);
    }
  }
  return Array.from(byId.values());
}
