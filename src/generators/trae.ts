import type { GeneratedFile, ProjectProfile } from "../types.js";
import { markdownBlock, renderMcpServerSnippet, renderReferenceMarkdown, renderRulesMarkdown, renderSkillMarkdown, renderSkillsMarkdown, renderSubagentsMarkdown, renderWorkflowPlaybookMarkdown } from "./helpers.js";
import { buildMcpCommand } from "./mcpConfig.js";

function renderTraeAgents(profile: ProjectProfile): string {
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
        "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/subagents.md` + "` as role guidance for splitting architecture, implementation, review, and documentation work.",
        "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/skills.md` + "` to review baseline and optional skill recommendations before adding project workflow capabilities.",
        "- Use `.trae/skills/" + `${profile.projectId}-workflow/references/workflow-playbook.md` + "` for task definition, plan analysis, verification, review, Git, PR, and worktree workflow."
      ].join("\n")
    ),
    ""
  ].join("\n");
}

export function generateTrae(profile: ProjectProfile): GeneratedFile[] {
  const mcp = buildMcpCommand();
  const mcpJson = renderMcpServerSnippet(mcp.command, mcp.args, profile.rootPath);
  return [
    { target: "trae", relativePath: ".trae/AGENTS.md", content: renderTraeAgents(profile), mode: "managed-text" },
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
      content: renderSkillMarkdown(profile, "trae"),
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
    }
  ];
}
