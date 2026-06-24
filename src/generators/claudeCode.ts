import type { GeneratedFile, ProjectProfile } from "../types.js";
import { markdownBlock, renderClaudeSubagentMarkdown, renderLoopEngineeringMarkdown, renderMcpServerSnippet, renderReferenceMarkdown, renderRulesMarkdown, renderSkillMarkdown, renderSkillsMarkdown, renderSubagentsMarkdown, renderWorkflowPlaybookMarkdown } from "./helpers.js";
import type { GenerateForTargetsOptions } from "./index.js";
import { buildMcpCommand } from "./mcpConfig.js";
import { SCAFFOLD_VERSION, SCHEMA_VERSION } from "../version.js";

function renderClaudeMd(profile: ProjectProfile, options: GenerateForTargetsOptions = {}): string {
  return [
    "# CLAUDE.md",
    "",
    "Repository guidance for Claude Code.",
    "",
    markdownBlock(
      "claude-code",
      [
        renderRulesMarkdown(profile, profile.rules),
        "",
        "## Claude Code Workflow",
        "- Use project-local instructions before global habits.",
        "- Use `.claude/skills` for reusable project workflows.",
        "- Use `.mcp.json` for the generated Agent Workflow MCP server configuration.",
        "- Use `.claude/agents` project subagents for role-specific architecture, implementation, review, and documentation work.",
        "- Use `.claude/skills/" + `${profile.projectId}-workflow/references/skills.md` + "` to review baseline and optional skill recommendations before adding project workflow capabilities.",
        "- Use `.claude/skills/" + `${profile.projectId}-workflow/references/workflow-playbook.md` + "` for task definition, plan analysis, verification, review, Git, PR, and worktree workflow.",
        ...(options.loopEngineering
          ? [
              "- Use `.claude/skills/" + `${profile.projectId}-workflow/references/loop-engineering.md` + "` when the user explicitly asks for Loop Engineering or a bounded agent loop."
            ]
          : [])
      ].join("\n")
    ),
    ""
  ].join("\n");
}

function claudeSettings(profile: ProjectProfile, options: GenerateForTargetsOptions = {}): Record<string, unknown> {
  const agentWorkflowScaffold: Record<string, unknown> = {
    scaffoldVersion: SCAFFOLD_VERSION,
    schemaVersion: SCHEMA_VERSION,
    projectId: profile.projectId,
    projectType: profile.projectType,
    subagents: profile.subagents.map((subagent) => subagent.id),
    skillRecommendations: profile.skillRecommendations.map((skill) => skill.id),
    managed: true
  };
  if (options.loopEngineering) {
    agentWorkflowScaffold.optionalWorkflows = {
      loopEngineering: true
    };
  }
  return {
    agentWorkflowScaffold: {
      ...agentWorkflowScaffold
    }
  };
}

function commandDoc(profile: ProjectProfile): string {
  return [
    "# Agent Workflow",
    "",
    markdownBlock(
      "claude-code",
      [
        `Run project analysis with \`npx @tungee/agent-workflow-scaffold analyze --root ${profile.rootPath}\`.`,
        "",
        "Use this command when you need to refresh Agent workflow configuration or inspect generated output:",
        "",
        "```bash",
        "npx @tungee/agent-workflow-scaffold init --target claude-code",
        "npx @tungee/agent-workflow-scaffold diff --target claude-code",
        "npx @tungee/agent-workflow-scaffold doctor --target claude-code",
        "```"
      ].join("\n")
    ),
    ""
  ].join("\n");
}

export function generateClaudeCode(profile: ProjectProfile, options: GenerateForTargetsOptions = {}): GeneratedFile[] {
  const mcp = buildMcpCommand();
  const mcpJson = renderMcpServerSnippet(mcp.command, mcp.args, profile.rootPath);
  const settings = claudeSettings(profile, options);
  return [
    { target: "claude-code", relativePath: "CLAUDE.md", content: renderClaudeMd(profile, options), mode: "managed-text" },
    {
      target: "claude-code",
      relativePath: ".claude/settings.json",
      content: `${JSON.stringify(settings, null, 2)}\n`,
      mode: "structured-json",
      jsonMerge: settings
    },
    {
      target: "claude-code",
      relativePath: `.claude/skills/${profile.projectId}-workflow/SKILL.md`,
      content: renderSkillMarkdown(profile, "claude-code", options),
      mode: "managed-text"
    },
    {
      target: "claude-code",
      relativePath: `.claude/skills/${profile.projectId}-workflow/references/project-rules.md`,
      content: renderReferenceMarkdown(profile, "claude-code"),
      mode: "managed-text"
    },
    {
      target: "claude-code",
      relativePath: `.claude/skills/${profile.projectId}-workflow/references/subagents.md`,
      content: renderSubagentsMarkdown(profile, "claude-code"),
      mode: "managed-text"
    },
    {
      target: "claude-code",
      relativePath: `.claude/skills/${profile.projectId}-workflow/references/skills.md`,
      content: renderSkillsMarkdown(profile, "claude-code"),
      mode: "managed-text"
    },
    {
      target: "claude-code",
      relativePath: `.claude/skills/${profile.projectId}-workflow/references/workflow-playbook.md`,
      content: renderWorkflowPlaybookMarkdown(profile, "claude-code"),
      mode: "managed-text"
    },
    ...(options.loopEngineering
      ? [
          {
            target: "claude-code" as const,
            relativePath: `.claude/skills/${profile.projectId}-workflow/references/loop-engineering.md`,
            content: renderLoopEngineeringMarkdown(profile, "claude-code"),
            mode: "managed-text" as const
          }
        ]
      : []),
    ...profile.subagents.map((subagent): GeneratedFile => ({
      target: "claude-code",
      relativePath: `.claude/agents/${subagent.id}.md`,
      content: renderClaudeSubagentMarkdown(profile, subagent),
      mode: "managed-text"
    })),
    {
      target: "claude-code",
      relativePath: ".claude/commands/agent-workflow.md",
      content: commandDoc(profile),
      mode: "managed-text"
    },
    {
      target: "claude-code",
      relativePath: ".mcp.json",
      content: `${JSON.stringify(mcpJson, null, 2)}\n`,
      mode: "structured-json",
      jsonMerge: mcpJson
    }
  ];
}
