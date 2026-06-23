export type AgentTarget = "codex" | "trae" | "claude-code";
export type TargetInput = AgentTarget | "all";

export type ProjectType =
  | "auto"
  | "python-crm"
  | "umi-react"
  | "h5"
  | "management"
  | "custom";

export type PackageManager = "npm" | "pnpm" | "yarn" | "unknown";
export type AgentProvider = "builtin" | "agency-agents" | "hybrid";
export type SkillRecommendationCategory = "baseline" | "project" | "optional";
export type SkillRecommendationSource = "builtin" | "codex-user" | "agents-user" | "plugin" | "unknown";

export interface ExistingAgentConfig {
  codex: boolean;
  trae: boolean;
  claudeCode: boolean;
  rootAgents: boolean;
  claudeMd: boolean;
  mcpJson: boolean;
}

export interface ProjectProfile {
  rootPath: string;
  projectId: string;
  displayName: string;
  projectType: Exclude<ProjectType, "auto">;
  packageManager: PackageManager;
  hasPackageJson: boolean;
  hasRequirementsTxt: boolean;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  techStack: string[];
  sourceDirs: string[];
  docFiles: string[];
  existingAgentConfig: ExistingAgentConfig;
  commands: {
    install?: string;
    dev?: string[];
    build?: string[];
    test?: string[];
    lint?: string[];
  };
  rules: ProjectRules;
  subagents: SubagentProfile[];
  skillRecommendations: SkillRecommendation[];
}

export interface ProjectRules {
  overview: string[];
  workflow: string[];
  codeStyle: string[];
  protectedPaths: string[];
  envSensitivePaths: string[];
  verification: string[];
  docs: string[];
  mcp: string[];
}

export interface SubagentProfile {
  id: string;
  name: string;
  description: string;
  whenToUse: string[];
  responsibilities: string[];
  targetTools: AgentTarget[];
  source?: "builtin" | "agency-agents";
  sourcePath?: string;
  content?: string;
}

export interface LocalSkill {
  id: string;
  name: string;
  description: string;
  source: SkillRecommendationSource;
  rootPath: string;
  skillPath: string;
}

export interface SkillScanResult {
  scannedPaths: string[];
  skills: LocalSkill[];
}

export interface SkillRecommendation {
  id: string;
  name: string;
  category: SkillRecommendationCategory;
  description: string;
  reason: string;
  installPolicy: "generated" | "recommended" | "optional";
  installed: boolean;
  localPath?: string;
  source?: SkillRecommendationSource;
}

export interface AnalyzeOptions {
  rootPath?: string;
  projectType?: ProjectType;
  agentProvider?: AgentProvider;
  agencyAgentsPath?: string;
  agentRoles?: string[];
  agentDivisions?: string[];
  skillPaths?: string[];
}

export interface GenerateOptions extends AnalyzeOptions {
  target?: TargetInput;
}

export type GeneratedFileMode = "managed-text" | "structured-json" | "directory";

export interface GeneratedFile {
  target: AgentTarget;
  relativePath: string;
  content: string;
  mode: GeneratedFileMode;
  marker?: string;
  jsonMerge?: unknown;
}

export interface GenerationResult {
  profile: ProjectProfile;
  files: GeneratedFile[];
}

export interface WriteResult {
  relativePath: string;
  action: "created" | "updated" | "unchanged" | "directory";
}

export interface DoctorIssue {
  level: "error" | "warning" | "info";
  target: AgentTarget;
  relativePath: string;
  message: string;
}

export interface DoctorResult {
  ok: boolean;
  profile: ProjectProfile;
  issues: DoctorIssue[];
}
