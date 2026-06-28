import type { GeneratedFile, ProjectProfile } from "../types.js";
import { markdownBlock, renderHeadroomMarkdown, renderLoopEngineeringMarkdown, renderMcpServerSnippet, renderReferenceMarkdown, renderRulesMarkdown, renderSkillMarkdown, renderSkillsMarkdown, renderSubagentsMarkdown, renderTraeSubagentMarkdown, renderWorkflowPlaybookMarkdown } from "./helpers.js";
import type { GenerateForTargetsOptions } from "./index.js";
import { buildMcpCommand } from "./mcpConfig.js";

function renderTraeAgents(profile: ProjectProfile, options: GenerateForTargetsOptions = {}): string {
  return [
    "# AGENTS.md",
    "",
    "This file guides Trae agents and automation in this repository.",
    "",
    markdownBlock(
      "trae",
      [
        renderRulesMarkdown(profile, profile.rules),
        "",
        "## Trae Workflow",
        "- Treat `.trae/documents` and `.trae/specs` as historical planning context when present.",
        "- Generate feature specs under `.trae/generatedSpecs/<featureId>/`.",
        "- Keep generated files in managed sections and preserve hand-written project guidance.",
        "- Use `.trae/agents/*.md` as project Subagents definitions when Trae Beta settings has `Enable Subagents Directory` enabled.",
        "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/subagents.md` + "` as readable role guidance and as fallback context when native Subagents are not enabled.",
        "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/skills.md` + "` to review baseline and optional skill recommendations before adding project workflow capabilities.",
        "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/workflow-playbook.md` + "` for task definition, plan analysis, verification, review, Git, PR, and worktree workflow.",
        ...(options.loopEngineering
          ? [
              "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/loop-engineering.md` + "` when the user explicitly asks for Loop Engineering or a bounded agent loop."
            ]
          : []),
        ...(options.headroom?.enabled
          ? [
              "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/headroom.md` + "` when the task involves long logs, large diffs, large tool outputs, or explicit Headroom context compression. Trae 第一版只生成说明，不自动写 Headroom MCP server。"
            ]
          : [])
      ].join("\n")
    ),
    ""
  ].join("\n");
}

export function generateTrae(profile: ProjectProfile, options: GenerateForTargetsOptions = {}): GeneratedFile[] {
  const mcp = buildMcpCommand();
  const mcpJson = renderMcpServerSnippet(mcp.command, mcp.args, profile.rootPath);
  const headroom = options.headroom;
  return [
    { target: "trae", relativePath: ".trae/AGENTS.md", content: renderTraeAgents(profile, options), mode: "managed-text" },
    { target: "trae", relativePath: ".trae/generatedSpecs", content: "", mode: "directory" },
    {
      target: "trae",
      relativePath: ".trae/mcp.json",
      content: `${JSON.stringify(mcpJson, null, 2)}\n`,
      mode: "structured-json",
      jsonMerge: mcpJson
    },
    {
      target: "trae",
      relativePath: `.trae/skills/${profile.projectId}-workflow/SKILL.md`,
      content: renderSkillMarkdown(profile, "trae", options),
      mode: "managed-text"
    },
    {
      target: "trae",
      relativePath: `.trae/skills/${profile.projectId}-workflow/references/project-rules.md`,
      content: renderReferenceMarkdown(profile, "trae"),
      mode: "managed-text"
    },
    {
      target: "trae",
      relativePath: `.trae/skills/${profile.projectId}-workflow/references/subagents.md`,
      content: renderSubagentsMarkdown(profile, "trae"),
      mode: "managed-text"
    },
    {
      target: "trae",
      relativePath: `.trae/skills/${profile.projectId}-workflow/references/skills.md`,
      content: renderSkillsMarkdown(profile, "trae"),
      mode: "managed-text"
    },
    {
      target: "trae",
      relativePath: `.trae/skills/${profile.projectId}-workflow/references/workflow-playbook.md`,
      content: renderWorkflowPlaybookMarkdown(profile, "trae"),
      mode: "managed-text"
    },
    ...(options.loopEngineering
      ? [
          {
            target: "trae" as const,
            relativePath: `.trae/skills/${profile.projectId}-workflow/references/loop-engineering.md`,
            content: renderLoopEngineeringMarkdown(profile, "trae"),
            mode: "managed-text" as const
          }
        ]
      : []),
    ...(headroom?.enabled
      ? [
          {
            target: "trae" as const,
            relativePath: `.trae/skills/${profile.projectId}-workflow/references/headroom.md`,
            content: renderHeadroomMarkdown(profile, "trae", headroom),
            mode: "managed-text" as const
          }
        ]
      : []),
    ...profile.subagents.map((subagent): GeneratedFile => ({
      target: "trae",
      relativePath: `.trae/agents/${subagent.id}.md`,
      content: renderTraeSubagentMarkdown(profile, subagent),
      mode: "managed-text"
    }))
  ];
}
