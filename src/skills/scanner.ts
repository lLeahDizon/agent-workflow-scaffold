import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LocalSkill, SkillRecommendationSource, SkillScanResult } from "../types.js";
import { isDirectory, pathExists } from "../utils/fs.js";
import { slugifyProjectId } from "../utils/format.js";

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

const DEFAULT_SCAN_PATHS = [
  path.join(os.homedir(), ".codex", "skills"),
  path.join(os.homedir(), ".codex", "plugins", "cache"),
  path.join(os.homedir(), ".agents", "skills")
];

function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function sourceForSkill(rootPath: string, skillPath: string): SkillRecommendationSource {
  const normalizedRoot = rootPath.split(path.sep).join("/");
  const normalizedSkill = skillPath.split(path.sep).join("/");
  if (normalizedRoot.endsWith("/.codex/skills")) {
    return normalizedSkill.includes("/.codex/skills/.system/") ? "builtin" : "codex-user";
  }
  if (normalizedRoot.endsWith("/.agents/skills")) {
    return "agents-user";
  }
  if (normalizedSkill.includes("/plugins/cache/")) {
    return "plugin";
  }
  return "unknown";
}

function parseFrontmatter(markdown: string): SkillFrontmatter {
  if (!markdown.startsWith("---\n")) {
    return {};
  }

  const end = markdown.indexOf("\n---", 4);
  if (end < 0) {
    return {};
  }

  const frontmatter = markdown.slice(4, end).split(/\r?\n/);
  const result: SkillFrontmatter = {};
  for (const line of frontmatter) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (key === "name") {
      result.name = value;
    }
    if (key === "description") {
      result.description = value;
    }
  }
  return result;
}

async function findSkillFiles(rootPath: string, depth = 0): Promise<string[]> {
  if (depth > 7 || !(await isDirectory(rootPath))) {
    return [];
  }

  const skillMd = path.join(rootPath, "SKILL.md");
  if (await pathExists(skillMd)) {
    return [skillMd];
  }

  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".git"))
      .map((entry) => findSkillFiles(path.join(rootPath, entry.name), depth + 1))
  );
  return nested.flat();
}

export function defaultSkillScanPaths(): string[] {
  return DEFAULT_SCAN_PATHS;
}

export async function scanLocalSkills(scanPaths = DEFAULT_SCAN_PATHS): Promise<SkillScanResult> {
  const scannedPaths = Array.from(new Set(scanPaths.map((item) => path.resolve(expandHome(item)))));
  const skills: LocalSkill[] = [];

  for (const rootPath of scannedPaths) {
    if (!(await isDirectory(rootPath))) {
      continue;
    }

    const skillFiles = await findSkillFiles(rootPath);
    for (const skillPath of skillFiles) {
      const markdown = await readFile(skillPath, "utf8");
      const frontmatter = parseFrontmatter(markdown);
      const fallbackName = path.basename(path.dirname(skillPath));
      const name = frontmatter.name || fallbackName;
      skills.push({
        id: slugifyProjectId(name),
        name,
        description: frontmatter.description || "No description found in SKILL.md frontmatter.",
        source: sourceForSkill(rootPath, skillPath),
        rootPath,
        skillPath
      });
    }
  }

  skills.sort((left, right) => left.id.localeCompare(right.id));
  return { scannedPaths, skills };
}
