import type { AgentTarget, HeadroomOptions, ProjectProfile, ProjectRules, SkillRecommendation, SkillRecommendationCategory, SubagentProfile } from "../types.js";
import { indentLines } from "../utils/format.js";
import { SCAFFOLD_VERSION, SCHEMA_VERSION } from "../version.js";

export function markdownBlock(target: string, body: string): string {
  const metadata = `target=${target} scaffoldVersion=${SCAFFOLD_VERSION} schemaVersion=${SCHEMA_VERSION}`;
  return [
    `<!-- agent-workflow-scaffold:start ${metadata} -->`,
    body.trim(),
    `<!-- agent-workflow-scaffold:end target=${target} -->`
  ].join("\n");
}

export function commentBlock(target: string, body: string, comment = "#"): string {
  const metadata = `target=${target} scaffoldVersion=${SCAFFOLD_VERSION} schemaVersion=${SCHEMA_VERSION}`;
  return [
    `${comment} agent-workflow-scaffold:start ${metadata}`,
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
    `- Confidence: ${profile.confidence}`,
    `- Empty project: ${profile.isEmptyProject ? "yes" : "no"}`,
    `- Manifests: ${profile.manifests.map((manifest) => `${manifest.type}:${manifest.path}`).join(", ") || "none detected"}`,
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

export function renderLoopEngineeringMarkdown(profile: ProjectProfile, target: AgentTarget): string {
  return [
    `# ${profile.displayName} Loop Engineering 可选工作流`,
    "",
    markdownBlock(
      target,
      [
        "Loop Engineering 是面向 AI 代理的循环工程范式：把一次性提示改成可观察、可校验、可停止的工作循环。",
        "",
        "本文件是可选参考配置。只有 CLI 显式传入 `--loop-engineering`，或在中文向导中确认启用时才会生成。",
        "",
        "默认不把循环工程用于自动提交、自动发布、自动合并或高风险生产操作。"
      ].join("\n")
    ),
    "",
    "## 1. 适用场景",
    "",
    "- 多轮分析才能定位的缺陷排查。",
    "- 跨多个文件的小步重构。",
    "- 需要持续验证的测试补齐、类型修复、lint 修复。",
    "- 需要 Agent 反复读取上下文、提出假设、验证假设的复杂任务。",
    "",
    "不建议用于：",
    "",
    "- 权限、安全、资金、生产配置等高风险改动的全自动闭环。",
    "- 需求边界不清、验收标准缺失的任务。",
    "- 缺少验证命令且无法人工 review 的大范围改动。",
    "",
    "## 2. 标准循环",
    "",
    "每一轮都按以下顺序执行：",
    "",
    "1. Frame：明确本轮目标、上下文、约束和停止条件。",
    "2. Inspect：读取最小必要文件、命令输出和现有配置。",
    "3. Plan：给出本轮小步计划和预期验证方式。",
    "4. Act：只做一个可回滚的小改动。",
    "5. Verify：运行最小相关验证，或说明无法验证的原因。",
    "6. Reflect：总结结果、风险、下一轮是否继续。",
    "",
    "## 3. 停止条件",
    "",
    "满足任一条件时停止循环并等待人工确认：",
    "",
    "- 已满足 Done when。",
    "- 连续两轮验证失败且失败原因未收敛。",
    "- 需要修改受保护路径、环境敏感配置、权限配置或发布配置。",
    "- 发现需求和实际代码约束冲突。",
    "- 继续执行会扩大影响范围。",
    "",
    "## 4. 建议提示模板",
    "",
    "```markdown",
    "请按 Loop Engineering 方式执行本任务。",
    "",
    "Goal:",
    "",
    "Context:",
    "",
    "Constraints:",
    "",
    "Done when:",
    "",
    "Loop limits:",
    "- 最多执行 3 轮",
    "- 每轮只做一个小改动",
    "- 每轮结束必须输出 Verify 和 Reflect",
    "- 触发停止条件时不要继续改代码",
    "```",
    "",
    "## 5. 与本项目工作流的关系",
    "",
    "- 先读 `references/project-rules.md`，再进入循环。",
    "- 中高风险任务同时读取 `references/workflow-playbook.md`。",
    "- 需要角色分工时读取 `references/subagents.md`。",
    "- 需要复用能力时读取 `references/skills.md`。",
    "",
    "Loop Engineering 只是执行节奏，不替代项目规则、人工 review 和显式写入确认。"
  ].join("\n");
}

export function renderHeadroomMarkdown(profile: ProjectProfile, target: AgentTarget, options: HeadroomOptions): string {
  return [
    `# ${profile.displayName} Headroom 可选上下文压缩`,
    "",
    markdownBlock(
      target,
      [
        "Headroom 是可选的上下文压缩和上下文代理能力，用于减少长日志、大 diff、大文件读取结果、多工具输出和 RAG 搜索结果进入 Agent 上下文时的 token 压力。",
        "",
        "本文件只有在 CLI 显式传入 `--headroom`，或目标项目 manifest 已记录 `enabledFeatures.headroom = true` 时才会生成。",
        "",
        "第一版脚手架只生成项目配置和使用说明，不自动执行 `headroom wrap`、不启动 proxy、不启动 dashboard，也不运行 `headroom mcp install`。"
      ].join("\n")
    ),
    "",
    "## 1. 当前项目配置",
    "",
    `- MCP server name: \`headroom\``,
    `- Command: \`${options.command}\``,
    `- Args: \`${options.args.join(" ")}\``,
    target === "trae"
      ? "- Trae 第一版只保留本说明文档，不自动写入 Headroom MCP server 配置。"
      : "- Codex / Claude Code 会生成项目级 Headroom MCP server 配置。",
    "",
    "## 2. 适合使用的场景",
    "",
    "- 分析长日志、构建输出、测试失败输出。",
    "- 阅读大 diff、长 PR 描述或跨模块变更摘要。",
    "- 处理大文件读取结果、多次搜索结果、RAG 检索结果。",
    "- 多 Agent 协作时需要传递压缩后的上下文摘要。",
    "",
    "## 3. 不明显省 token 的场景",
    "",
    "- 很短的问题或单文件小改动。",
    "- 客户端没有实际调用 Headroom MCP / proxy / SDK。",
    "- 普通聊天没有经过 Headroom 工具链。",
    "- 目标任务本身需要完整原文且不能压缩。",
    "",
    "启用 MCP 配置只是接入条件，不代表所有请求都会自动压缩。",
    "",
    "## 4. 本机安装",
    "",
    "推荐使用脚手架显式安装命令：",
    "",
    "```bash",
    "agent-workflow headroom install",
    "agent-workflow headroom doctor",
    "```",
    "",
    "安装会落在脚手架受管目录，不会自动修改 shell PATH。若项目配置使用默认 `headroom` 命令，请确保该命令在当前客户端进程 PATH 中可用。",
    "",
    "## 5. Dashboard / Proxy",
    "",
    "浏览器 dashboard 和 proxy 属于 Headroom 运行时能力，不属于第一版脚手架自动管理范围。",
    "",
    "如需查看 dashboard 或使用 proxy，请按 Headroom 官方文档手动启动对应能力。项目 `doctor --headroom` 不检查 dashboard/proxy 是否正在运行。"
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

export function renderSkillMarkdown(profile: ProjectProfile, target: AgentTarget, options: { loopEngineering?: boolean; headroom?: HeadroomOptions } = {}): string {
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
        ...(options.loopEngineering
          ? [
              "Read `references/loop-engineering.md` when the user explicitly asks for Loop Engineering, bounded loops, or iterative Agent execution.",
              ""
            ]
          : []),
        ...(options.headroom?.enabled
          ? [
              "Read `references/headroom.md` when the task involves long logs, large diffs, large tool outputs, or explicit Headroom context compression.",
              ""
            ]
          : []),
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

export function renderMcpServerSnippet(command: string, args: string[], cwd?: string, serverName = "agent-workflow-scaffold"): Record<string, unknown> {
  return {
    mcpServers: {
      [serverName]: {
        command,
        args,
        ...(cwd ? { cwd } : {})
      }
    }
  };
}

export function renderMcpServersSnippet(servers: Array<{ name: string; command: string; args: string[]; cwd?: string }>): Record<string, unknown> {
  return {
    mcpServers: Object.fromEntries(
      servers.map((server) => [
        server.name,
        {
          command: server.command,
          args: server.args,
          ...(server.cwd ? { cwd: server.cwd } : {})
        }
      ])
    )
  };
}
