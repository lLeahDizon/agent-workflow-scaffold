import type { ProjectProfile, SubagentProfile } from "../types.js";

type ProfileInput = Pick<ProjectProfile, "projectType" | "techStack" | "hasRequirementsTxt">;

const BASE_SUBAGENTS: SubagentProfile[] = [
  {
    id: "workflow-orchestrator",
    name: "Workflow Orchestrator",
    description: "Coordinates project analysis, planning, implementation boundaries, verification, and handoff notes.",
    whenToUse: [
      "Use at the start of non-trivial repository tasks.",
      "Use when a task touches multiple modules, generated Agent config, MCP config, or release workflow."
    ],
    responsibilities: [
      "Read project guidance and summarize the relevant rules before implementation.",
      "Break work into scoped steps and identify verification commands.",
      "Keep generated Agent workflow files and hand-written guidance separate."
    ],
    targetTools: ["codex", "trae", "claude-code"],
    source: "builtin"
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Reviews changes for correctness, regressions, maintainability, security, and missing verification.",
    whenToUse: [
      "Use before finalizing code or generated workflow changes.",
      "Use when changes affect shared utilities, API contracts, hooks, MCP config, or project rules."
    ],
    responsibilities: [
      "Prioritize findings by severity and cite concrete files or generated artifacts.",
      "Check that managed blocks did not overwrite user-authored content.",
      "Call out missing tests or residual verification risk."
    ],
    targetTools: ["codex", "trae", "claude-code"],
    source: "builtin"
  },
  {
    id: "technical-writer",
    name: "Technical Writer",
    description: "Maintains project-facing instructions, CLI docs, changelog entries, and workflow reference material.",
    whenToUse: [
      "Use when generated instructions, README, CLI manuals, changelog, or skill references change.",
      "Use when converting project conventions into stable Agent workflow documentation."
    ],
    responsibilities: [
      "Keep docs aligned with actual CLI behavior.",
      "Separate implemented behavior from planned behavior.",
      "Update changelog entries with version, date, category, and concise descriptions."
    ],
    targetTools: ["codex", "trae", "claude-code"],
    source: "builtin"
  }
];

const FRONTEND_SUBAGENT: SubagentProfile = {
  id: "frontend-implementer",
  name: "Frontend Implementer",
  description: "Handles React/Umi/H5 UI implementation while preserving local routing, service, style, and build conventions.",
  whenToUse: [
    "Use for React, Umi, H5, Ant Design, antd-mobile, routing, service, or style changes.",
    "Use when UI behavior needs browser or mobile WebView verification."
  ],
  responsibilities: [
    "Follow existing component, service, state, and style patterns.",
    "Preserve platform-specific navigation, route parameters, and generated Umi outputs.",
    "Recommend the smallest relevant lint, build, or manual UI check."
  ],
  targetTools: ["codex", "trae", "claude-code"],
  source: "builtin"
};

const BACKEND_SUBAGENT: SubagentProfile = {
  id: "backend-implementer",
  name: "Backend Implementer",
  description: "Handles backend logic, API, data model, worker, and integration changes with project-specific verification.",
  whenToUse: [
    "Use for Python backend, API, model, database, cache, queue, or integration changes.",
    "Use when server-side behavior or data contracts affect frontend or external consumers."
  ],
  responsibilities: [
    "Keep handlers thin and business logic in local project modules.",
    "Protect config and credential-sensitive paths.",
    "Recommend targeted syntax, import, unit, migration, or integration checks."
  ],
  targetTools: ["codex", "trae", "claude-code"],
  source: "builtin"
};

export function selectSubagents(profile: ProfileInput): SubagentProfile[] {
  const selected = [...BASE_SUBAGENTS];
  const hasFrontendStack = profile.techStack.some((item) => /react|umi|antd|h5|management/i.test(item));
  const hasBackendStack = profile.hasRequirementsTxt || profile.projectType === "python-crm" || profile.techStack.some((item) => /python|flask|mongodb|redis|celery|elasticsearch/i.test(item));

  if (hasFrontendStack || ["h5", "management", "umi-react"].includes(profile.projectType)) {
    selected.push(FRONTEND_SUBAGENT);
  }

  if (hasBackendStack) {
    selected.push(BACKEND_SUBAGENT);
  }

  return selected;
}
