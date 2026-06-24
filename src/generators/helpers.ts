import type { AgentTarget, ProjectProfile, ProjectRules, SkillRecommendation, SkillRecommendationCategory, SubagentProfile } from "../types.js";
import { indentLines } from "../utils/format.js";

export function markdownBlock(target: AgentTarget, body: string): string {
  return [
    `<!-- agent-workflow-scaffold:start target=${target} -->`,
    body.trim(),
    `<!-- agent-workflow-scaffold:end target=${target} -->`
  ].join("\n");
}

export function commentBlock(target: AgentTarget, body: string, comment = "#"): string {
  return [
    `${comment} agent-workflow-scaffold:start target=${target}`,
    body.trim(),
    `${comment} agent-workflow-scaffold:end target=${target}`
  ].join("\n");
}

export function renderRulesMarkdown(profile: ProjectProfile, rules: ProjectRules): string {
  return [
    "## Project Profile",
    "",
    `- Project: ${profile.displayName}`,
    `- Root: ${profile.rootPath}`,
    `- Detected type: ${profile.projectType}`,
    `- Package manager: ${profile.packageManager}`,
    `- Tech stack: ${profile.techStack.join(", ") || "unknown"}`,
    "",
    "## Workflow",
    indentLines(rules.workflow),
    "",
    "## Code Rules",
    indentLines(rules.codeStyle),
    "",
    "## Protected Paths",
    indentLines(rules.protectedPaths),
    "",
    "## Environment-Sensitive Paths",
    indentLines(rules.envSensitivePaths),
    "",
    "## Verification",
    indentLines(rules.verification),
    "",
    "## Useful Commands",
    profile.commands.install ? `- Install: \`${profile.commands.install}\`` : "- Install: none detected",
    ...profile.commands.dev?.map((command) => `- Dev: \`${command}\``) ?? [],
    ...profile.commands.build?.map((command) => `- Build: \`${command}\``) ?? [],
    ...profile.commands.lint?.map((command) => `- Lint: \`${command}\``) ?? [],
    ...profile.commands.test?.map((command) => `- Test: \`${command}\``) ?? [],
    "",
    "## Docs To Check",
    indentLines(rules.docs)
  ].join("\n");
}

export function renderWorkflowPlaybookMarkdown(profile: ProjectProfile, target: AgentTarget): string {
  const frontendTrial = profile.projectType === "h5" || profile.projectType === "management" || profile.projectType === "umi-react";
  const backendTrial = profile.projectType === "python-crm";
  return [
    `# ${profile.displayName} AI Coding 协作工作流`,
    "",
    markdownBlock(
      target,
      [
        "本文件用于把团队 AI Coding 协作顺序固化到项目本地配置中。",
        "",
        "主流程：定义任务 -> 计划分析 -> 小步实现 -> 自检验证 -> 人工 Review -> Git 提交与 PR -> 复盘沉淀 -> 逐步自动化。",
        "",
        "默认原则：先读事实，再做计划；先小步修改，再最小验证；高风险动作必须人工确认。"
      ].join("\n")
    ),
    "",
    "## 1. 任务定义",
    "",
    "每次开始前先补齐四段输入，减少 Agent 自行脑补：",
    "",
    "- Goal：这次要达成什么结果。",
    "- Context：相关背景、入口文件、关联需求、已有约束。",
    "- Constraints：不能改什么、兼容要求、性能/权限/安全边界。",
    "- Done when：验收标准、验证命令、需要输出的说明。",
    "",
    "推荐任务描述模板：",
    "",
    "```markdown",
    "Goal:",
    "",
    "Context:",
    "",
    "Constraints:",
    "",
    "Done when:",
    "```",
    "",
    "## 2. 计划分析",
    "",
    "以下任务先只读分析，不直接改代码：",
    "",
    "- 多文件改动或跨模块联动。",
    "- 缓存、权限、事务、状态管理相关变更。",
    "- 老代码重构、构建链路、数据库或配置变更。",
    "- 需求边界不清或验收标准不清的任务。",
    "",
    "计划阶段必须回答：",
    "",
    "- 影响范围是什么。",
    "- 风险点是什么。",
    "- 验证方式是什么。",
    "",
    "## 3. 小步实现",
    "",
    "每轮只做一个清晰子任务，例如：",
    "",
    "- 只补一个组件骨架。",
    "- 只修一个接口错误分支。",
    "- 只补一组相关测试。",
    "- 只调整一个页面请求链路。",
    "",
    "避免一次性跨多个业务域、多个 target 或多个系统做大范围修改。",
    "",
    "## 4. 自检验证",
    "",
    "修改后先输出自检说明，再进入提交：",
    "",
    "- 改了哪些文件。",
    "- 为什么改这些文件。",
    "- 已跑哪些最小验证。",
    "- 还缺哪些验证项。",
    "- 风险最高的位置在哪里。",
    "",
    "优先运行最小相关验证：类型检查、lint、单测、局部 build、脚本 dry-run。无法验证时必须说明原因。",
    "",
    "## 5. 人工 Review",
    "",
    "最小 Review 口径：",
    "",
    "- 是否符合仓库规则和本地 Agent 配置。",
    "- 是否复用了已有模式、工具函数和目录结构。",
    "- 是否引入重复实现或绕过现有抽象。",
    "- 是否存在高风险但未验证的改动。",
    "- 是否补齐必要说明、迁移说明或回滚说明。",
    "",
    "## 6. Git 提交与 PR",
    "",
    "提交前建议让 Agent 审查暂存区：",
    "",
    "```text",
    "请审查当前暂存区改动：",
    "1. 说明改动目的",
    "2. 指出潜在风险",
    "3. 列出还缺的验证项",
    "4. 建议 commit message",
    "```",
    "",
    "PR 描述至少包含：变更摘要、影响范围、验证方式、风险与回滚点。",
    "",
    "## 7. 并行会话与 worktree",
    "",
    "团队并行处理功能、Bug、重构时遵守：",
    "",
    "- 一任务一会话。",
    "- 一高风险任务一 worktree。",
    "- 不在同一会话混跑互不相关的上下文。",
    "- 不在共享分支执行危险回滚命令，优先使用 `git revert <commit_sha>`。",
    "",
    "## 8. 试点场景",
    "",
    ...(frontendTrial
      ? [
          "前端项目优先试点：",
          "",
          "- 解释路由、页面状态流和调用链。",
          "- 根据已有页面模式补组件骨架、请求层和类型。",
          "- 生成复杂页面的回归清单。",
          "- 根据已有改动生成 PR 摘要和风险说明。",
          ""
        ]
      : []),
    ...(backendTrial
      ? [
          "后端项目优先试点：",
          "",
          "- 解释 controller、service、repository 之间的数据流。",
          "- 根据已有模式补 handler、DTO、校验和单测。",
          "- 排查接口异常、事务问题、序列化问题。",
          "- 生成接口文档、迁移说明和回滚说明。",
          ""
        ]
      : []),
    "第一波不要硬推：",
    "",
    "- 没有测试兜底的核心模块重构。",
    "- 权限、安全、资金链路的自动改动。",
    "- 一次跨多个系统的大范围联动修改。",
    "- 需求和完成标准还没讲清楚的任务。",
    "",
    "## 9. 复盘沉淀",
    "",
    "重复出现的任务不要每次重新口述，优先沉淀为：",
    "",
    "- 规则文件。",
    "- hooks。",
    "- skills。",
    "- review 清单。",
    "- 自动化流程。",
    "",
    "稳定流程先沉淀为 skill；稳定到无需频繁人工干预后，再考虑 automation。"
  ].join("\n");
}

export function renderSubagentsMarkdown(profile: ProjectProfile, target: AgentTarget): string {
  const lines = [
    `# ${profile.displayName} Subagents`,
    "",
    markdownBlock(
      target,
      [
        "These Subagents describe the recommended role split for this repository's Agent workflow.",
        "",
        target === "claude-code"
          ? "Claude Code also receives project-level `.claude/agents/*.md` definitions generated from these profiles."
          : "This target uses the profiles as workflow guidance. Do not assume native runtime delegation unless the target tool supports it.",
        "",
        "## Recommended Subagents"
      ].join("\n")
    )
  ];

  for (const subagent of profile.subagents) {
    lines.push(
      "",
      `## ${subagent.name}`,
      "",
      `- ID: \`${subagent.id}\``,
      `- Source: ${subagent.source ?? "builtin"}${subagent.sourcePath ? ` (${subagent.sourcePath})` : ""}`,
      `- Description: ${subagent.description}`,
      "- When to use:",
      indentLines(subagent.whenToUse),
      "- Responsibilities:",
      indentLines(subagent.responsibilities),
      ...(subagent.source === "agency-agents"
        ? [
            "- Upstream instructions:",
            "",
            "````markdown",
            subagent.content ?? "",
            "````"
          ]
        : [])
    );
  }

  return lines.join("\n");
}

function skillStatus(skill: SkillRecommendation): string {
  if (skill.installPolicy === "generated") {
    return "generated by this scaffold";
  }
  return skill.installed ? `available locally${skill.source ? ` (${skill.source})` : ""}` : "not found locally";
}

function renderSkillGroup(profile: ProjectProfile, category: SkillRecommendationCategory): string[] {
  const labels: Record<SkillRecommendationCategory, string> = {
    baseline: "Baseline Skills",
    project: "Project Skill Authoring",
    optional: "Optional Skills"
  };
  const skills = profile.skillRecommendations.filter((skill) => skill.category === category);
  const lines = [`## ${labels[category]}`, ""];
  if (skills.length === 0) {
    return [...lines, "- None recommended for this project profile."];
  }

  for (const skill of skills) {
    lines.push(
      `### ${skill.name}`,
      "",
      `- ID: \`${skill.id}\``,
      `- Policy: ${skill.installPolicy}`,
      `- Status: ${skillStatus(skill)}`,
      `- Description: ${skill.description}`,
      `- Reason: ${skill.reason}`,
      ...(skill.localPath ? [`- Local path: \`${skill.localPath}\``] : []),
      ""
    );
  }

  return lines;
}

export function renderSkillsMarkdown(profile: ProjectProfile, target: AgentTarget): string {
  return [
    `# ${profile.displayName} Skill Recommendations`,
    "",
    markdownBlock(
      target,
      [
        "These recommendations map the project profile to reusable Agent skills.",
        "",
        "The scaffold only generates the project-local workflow skill. It does not copy, install, or mutate user-global skills by default.",
        "",
        "`installed` status is based on local `SKILL.md` discovery under the configured skill scan paths."
      ].join("\n")
    ),
    "",
    ...renderSkillGroup(profile, "baseline"),
    "",
    ...renderSkillGroup(profile, "project"),
    "",
    ...renderSkillGroup(profile, "optional")
  ].join("\n");
}

export function renderSkillMarkdown(profile: ProjectProfile, target: AgentTarget): string {
  const skillName = `${profile.projectId}-workflow`;
  return [
    "---",
    `name: "${skillName}"`,
    `description: "Use when working in ${profile.displayName} to follow project-specific workflow, verification, generated-file, hook, MCP, and Agent configuration rules."`,
    "---",
    "",
    `# ${profile.displayName} Workflow`,
    "",
    markdownBlock(
      target,
      [
        "Use this skill when a task touches this repository's implementation, generated Agent configuration, MCP setup, or project workflow rules.",
        "",
        "Before editing, inspect the relevant source files and existing Agent configs. Preserve user changes and avoid generated outputs listed in the project rules.",
        "",
        "Read `references/project-rules.md` for detailed project conventions before making non-trivial changes.",
        "",
        "Read `references/workflow-playbook.md` before medium or high risk tasks, and follow its task definition, plan, review, Git, PR, and worktree workflow.",
        "",
        "Read `references/subagents.md` when a task should be split across architecture, implementation, review, or documentation roles.",
        "",
        "Read `references/skills.md` to understand baseline and optional skills that fit this project. Do not install or copy user-global skills unless the user explicitly asks."
      ].join("\n")
    )
  ].join("\n");
}

export function renderReferenceMarkdown(profile: ProjectProfile, target: AgentTarget): string {
  return [
    `# ${profile.displayName} Project Rules`,
    "",
    markdownBlock(target, renderRulesMarkdown(profile, profile.rules))
  ].join("\n");
}

export function renderClaudeSubagentMarkdown(profile: ProjectProfile, subagent: SubagentProfile): string {
  const tools = ["Read", "Grep", "Glob", "LS", "Bash"];
  const body =
    subagent.source === "agency-agents" && subagent.content
      ? [
          `# ${subagent.name}`,
          "",
          `Project: ${profile.displayName}`,
          "",
          `Source: agency-agents${subagent.sourcePath ? ` (${subagent.sourcePath})` : ""}`,
          "",
          "## Project Workflow Overlay",
          "",
          "- Apply the upstream role through this repository's local `CLAUDE.md` and `.claude/skills` workflow guidance.",
          "- Preserve user-authored content outside `agent-workflow-scaffold` managed blocks.",
          "- Report verification performed and any remaining risk.",
          "",
          "## Upstream Agency Agent Instructions",
          "",
          subagent.content
        ].join("\n")
      : [
          `# ${subagent.name}`,
          "",
          `Project: ${profile.displayName}`,
          "",
          "## When To Use",
          "",
          indentLines(subagent.whenToUse),
          "",
          "## Responsibilities",
          "",
          indentLines(subagent.responsibilities),
          "",
          "## Project Workflow",
          "",
          "- Read `CLAUDE.md` and `.claude/skills` project workflow guidance before changing files.",
          "- Preserve user-authored content outside `agent-workflow-scaffold` managed blocks.",
          "- Report verification performed and any remaining risk."
        ].join("\n");
  return [
    "---",
    `name: ${subagent.id}`,
    `description: ${subagent.description}`,
    `tools: ${tools.join(", ")}`,
    "---",
    "",
    markdownBlock("claude-code", body)
  ].join("\n");
}

export function renderTraeSubagentMarkdown(profile: ProjectProfile, subagent: SubagentProfile): string {
  const tools = ["Read", "Grep", "Glob", "LS", "Bash"];
  const body =
    subagent.source === "agency-agents" && subagent.content
      ? [
          `# ${subagent.name}`,
          "",
          `Project: ${profile.displayName}`,
          "",
          `Source: agency-agents${subagent.sourcePath ? ` (${subagent.sourcePath})` : ""}`,
          "",
          "## Project Workflow Overlay",
          "",
          "- Apply the upstream role through this repository's local `.trae/AGENTS.md` and `.trae/skills` workflow guidance.",
          "- Preserve user-authored content outside `agent-workflow-scaffold` managed blocks.",
          "- Report verification performed and any remaining risk.",
          "",
          "## Upstream Agency Agent Instructions",
          "",
          subagent.content
        ].join("\n")
      : [
          `# ${subagent.name}`,
          "",
          `Project: ${profile.displayName}`,
          "",
          "## When To Use",
          "",
          indentLines(subagent.whenToUse),
          "",
          "## Responsibilities",
          "",
          indentLines(subagent.responsibilities),
          "",
          "## Project Workflow",
          "",
          "- Read `.trae/AGENTS.md` and `.trae/skills` project workflow guidance before changing files.",
          "- Preserve user-authored content outside `agent-workflow-scaffold` managed blocks.",
          "- Report verification performed and any remaining risk."
        ].join("\n");
  return [
    "---",
    `name: ${subagent.id}`,
    `description: ${subagent.description}`,
    `tools: ${tools.join(", ")}`,
    "---",
    "",
    markdownBlock("trae", body)
  ].join("\n");
}

export function renderMcpServerSnippet(command: string, args: string[], cwd?: string): Record<string, unknown> {
  return {
    mcpServers: {
      "agent-workflow-scaffold": {
        command,
        args,
        ...(cwd ? { cwd } : {})
      }
    }
  };
}
