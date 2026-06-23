import { readdir } from "node:fs/promises";
import path from "node:path";
import type {
  AnalyzeOptions,
  ExistingAgentConfig,
  PackageManager,
  ProjectProfile,
  ProjectType
} from "../types.js";
import { pathExists, readJsonIfExists } from "../utils/fs.js";
import { resolveRootPath, slugifyProjectId } from "../utils/format.js";
import { rulesForProjectType } from "../templates/projectRules.js";
import { selectSubagents } from "../templates/subagents.js";
import { loadAgencyAgents, mergeSubagents } from "../templates/agencyAgents.js";
import { recommendSkills } from "../skills/recommendations.js";
import { scanLocalSkills } from "../skills/scanner.js";

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
  volta?: { node?: string };
}

const DOC_FILE_NAMES = new Set(["README.md", "readme.md", "CHANGELOG.md", "CHANGELOG.MD"]);

async function listFiles(rootPath: string, relativeDir = ""): Promise<string[]> {
  const absoluteDir = path.join(rootPath, relativeDir);
  if (!(await pathExists(absoluteDir))) {
    return [];
  }

  const entries = await readdir(absoluteDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.posix.join(relativeDir.split(path.sep).join(path.posix.sep), entry.name))
    .filter(Boolean);
}

async function listDocFiles(rootPath: string): Promise<string[]> {
  const candidates = [
    ...(await listFiles(rootPath)),
    ...(await listFiles(rootPath, "docs")),
    ...(await listFiles(rootPath, "docs/marketing")),
    ...(await listFiles(rootPath, "docs/sales")),
    ...(await listFiles(rootPath, "docs/low-code")),
    ...(await listFiles(rootPath, "src/packages/connect-engine")),
    ...(await listFiles(rootPath, "src/packages/connect-engine/components/TriggerSelector")),
    ...(await listFiles(rootPath, "src/packages/connect-engine/pages/CustomWorkflow/Designer")),
    ...(await listFiles(rootPath, ".trae")),
    ...(await listFiles(rootPath, ".trae/documents"))
  ];

  return Array.from(
    new Set(
      candidates.filter((file) => DOC_FILE_NAMES.has(path.basename(file)) || /\.(md|mdx)$/i.test(file))
    )
  ).slice(0, 40);
}

function detectPackageManager(rootPath: string, pkg?: PackageJson): Promise<PackageManager> {
  return Promise.all([
    pathExists(path.join(rootPath, "pnpm-lock.yaml")),
    pathExists(path.join(rootPath, "yarn.lock")),
    pathExists(path.join(rootPath, "package-lock.json"))
  ]).then(([hasPnpm, hasYarn, hasNpm]) => {
    if (pkg?.packageManager?.startsWith("pnpm") || hasPnpm) {
      return "pnpm";
    }
    if (pkg?.packageManager?.startsWith("yarn") || hasYarn) {
      return "yarn";
    }
    if (pkg?.packageManager?.startsWith("npm") || hasNpm) {
      return "npm";
    }
    return "unknown";
  });
}

function detectProjectType(input: {
  requested: ProjectType;
  projectId: string;
  hasPackageJson: boolean;
  hasRequirementsTxt: boolean;
  dependencies: string[];
}): Exclude<ProjectType, "auto"> {
  if (input.requested !== "auto") {
    return input.requested;
  }
  if (input.hasRequirementsTxt && !input.hasPackageJson) {
    return "python-crm";
  }
  if (/sales-h5|h5|mobile/i.test(input.projectId) || input.dependencies.includes("antd-mobile")) {
    return "h5";
  }
  if (/management|admin/i.test(input.projectId)) {
    return "management";
  }
  if (input.dependencies.includes("umi") || input.dependencies.includes("@umijs/max")) {
    return "umi-react";
  }
  if (input.hasRequirementsTxt) {
    return "python-crm";
  }
  return "custom";
}

function detectTechStack(projectType: Exclude<ProjectType, "auto">, dependencies: string[], hasRequirementsTxt: boolean): string[] {
  const stack = new Set<string>();
  if (dependencies.includes("umi")) stack.add("Umi");
  if (dependencies.includes("@umijs/max")) stack.add("@umijs/max");
  if (dependencies.includes("react")) stack.add("React");
  if (dependencies.includes("antd")) stack.add("Ant Design");
  if (dependencies.includes("antd-mobile")) stack.add("antd-mobile");
  if (dependencies.includes("zustand")) stack.add("Zustand");
  if (dependencies.includes("ahooks")) stack.add("ahooks");
  if (dependencies.includes("@antv/x6")) stack.add("AntV X6");
  if (dependencies.includes("typescript")) stack.add("TypeScript");
  if (hasRequirementsTxt || projectType === "python-crm") {
    ["Python", "Flask", "MongoDB", "Elasticsearch", "Celery", "Redis"].forEach((item) => stack.add(item));
  }
  if (projectType === "h5") stack.add("H5");
  if (projectType === "management") stack.add("Management Console");
  return Array.from(stack);
}

function buildCommands(packageManager: PackageManager, scripts: Record<string, string>, hasRequirementsTxt: boolean) {
  const runner = packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm run";
  const commandFor = (name: string) => (packageManager === "npm" || packageManager === "unknown" ? `npm run ${name}` : `${runner} ${name}`);
  const scriptNames = Object.keys(scripts);
  const dev = scriptNames.filter((name) => /^start|^dev/.test(name)).slice(0, 6).map(commandFor);
  const build = scriptNames.filter((name) => /^build/.test(name)).slice(0, 8).map(commandFor);
  const test = scriptNames.filter((name) => /test/.test(name)).slice(0, 4).map(commandFor);
  const lint = scriptNames.filter((name) => /lint/.test(name)).slice(0, 4).map(commandFor);

  return {
    install: packageManager === "pnpm" ? "pnpm install" : packageManager === "yarn" ? "yarn install" : hasRequirementsTxt ? "pip install -r requirements.txt" : "npm install",
    dev,
    build,
    test,
    lint
  };
}

async function detectExistingConfig(rootPath: string): Promise<ExistingAgentConfig> {
  return {
    codex: await pathExists(path.join(rootPath, ".codex", "config.toml")),
    trae: await pathExists(path.join(rootPath, ".trae", "AGENTS.md")),
    claudeCode: await pathExists(path.join(rootPath, ".claude", "settings.json")),
    rootAgents: await pathExists(path.join(rootPath, "AGENTS.md")),
    claudeMd: await pathExists(path.join(rootPath, "CLAUDE.md")),
    mcpJson: await pathExists(path.join(rootPath, ".mcp.json"))
  };
}

async function detectSourceDirs(rootPath: string): Promise<string[]> {
  const candidates = [
    "src",
    "service",
    "sales",
    "marketing",
    "low_code",
    "app_center",
    "customer_guard",
    "ui-lowcode-common",
    "docs"
  ];
  const existing = await Promise.all(candidates.map(async (dir) => ((await pathExists(path.join(rootPath, dir))) ? dir : undefined)));
  return existing.filter((item): item is string => Boolean(item));
}

export async function analyzeProject(options: AnalyzeOptions = {}): Promise<ProjectProfile> {
  const rootPath = resolveRootPath(options.rootPath);
  const requestedType = options.projectType ?? "auto";
  const packageJsonPath = path.join(rootPath, "package.json");
  const pkg = await readJsonIfExists<PackageJson>(packageJsonPath);
  const hasPackageJson = Boolean(pkg);
  const hasRequirementsTxt = await pathExists(path.join(rootPath, "requirements.txt"));
  const projectId = slugifyProjectId(pkg?.name ?? path.basename(rootPath));
  const scripts = pkg?.scripts ?? {};
  const dependencies = Object.keys({ ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }).sort();
  const projectType = detectProjectType({
    requested: requestedType,
    projectId,
    hasPackageJson,
    hasRequirementsTxt,
    dependencies
  });
  const packageManager = await detectPackageManager(rootPath, pkg);
  const profile: ProjectProfile = {
    rootPath,
    projectId,
    displayName: pkg?.name ?? path.basename(rootPath),
    projectType,
    packageManager,
    hasPackageJson,
    hasRequirementsTxt,
    scripts,
    dependencies: Object.keys(pkg?.dependencies ?? {}).sort(),
    devDependencies: Object.keys(pkg?.devDependencies ?? {}).sort(),
    techStack: detectTechStack(projectType, dependencies, hasRequirementsTxt),
    sourceDirs: await detectSourceDirs(rootPath),
    docFiles: await listDocFiles(rootPath),
    existingAgentConfig: await detectExistingConfig(rootPath),
    commands: buildCommands(packageManager, scripts, hasRequirementsTxt),
    rules: rulesForProjectType(projectType),
    subagents: [],
    skillRecommendations: []
  };
  const builtinSubagents = selectSubagents(profile);
  const agentProvider = options.agentProvider ?? "builtin";
  if (agentProvider === "builtin") {
    profile.subagents = builtinSubagents;
  } else {
    const agencySubagents = await loadAgencyAgents({
      rootPath: options.agencyAgentsPath,
      roleIds: options.agentRoles,
      divisions: options.agentDivisions
    });
    profile.subagents = agentProvider === "hybrid" ? mergeSubagents(builtinSubagents, agencySubagents) : agencySubagents;
  }

  const localSkills = await scanLocalSkills(options.skillPaths);
  profile.skillRecommendations = recommendSkills(profile, localSkills.skills);

  return profile;
}
