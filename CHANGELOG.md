# Changelog

本项目从 `0.0.1` 开始记录版本变更。后续每次对 CLI 行为、生成文件结构、项目分析模型、Agent provider、MCP server、文档或操作手册做可发布改动时，都需要新增版本号和对应说明。

## 版本维护规则

- 每次可发布改动都新增一个版本条目，不把新变更追加到旧版本中。
- 版本号遵循 SemVer。当前早期阶段从 `0.0.1` 开始，后续小步改动优先递增 patch，例如 `0.0.2`、`0.0.3`。
- 每个版本条目必须包含日期、变更分类和清晰描述。
- 推荐分类：`Added`、`Changed`、`Fixed`、`Docs`、`Tests`、`Internal`。
- 发布前同步更新 `package.json`、`package-lock.json`、MCP server version 和本文档。

## [0.0.11] - 2026-06-23

### Added

- `setup --interactive` 和 `init --interactive` 在选择 `agency-agents` 或 `hybrid` 但未填写路径时，会继续询问处理方式。
- agency-agents 路径缺失时可选择改用 `builtin`、输入已有本地路径，或明确授权自动 clone 到 `~/.cache/agent-workflow-scaffold/agency-agents`。

### Changed

- 非交互命令仍保持严格校验：选择 `agency-agents` 或 `hybrid` 时必须显式提供 `--agency-agents-path`。

### Docs

- README、中文 CLI 手册和长期维护方案补充 agency-agents 交互式配置说明。

## [0.0.10] - 2026-06-23

### Added

- 新增项目级 `.npmrc`，将 `@tungee` scope 和默认 registry 指向 `https://npm.tangees.com/`。
- 新增 `publishConfig.registry` 和 `publishConfig.access`，明确内部 npm registry 发布目标。
- 新增 `prepack` 和 `prepublishOnly` 脚本，打包和发布前自动执行构建与检查。

### Docs

- README 和发版指南补充 `npm.tangees.com` 发布流程。
- 中文 CLI 手册补充私有 npm registry 发布注意事项。

## [0.0.9] - 2026-06-23

### Added

- 新增 `agent-workflow setup` 一键串行配置流程。
- `setup` 会依次执行项目分析、skill 推荐、生成文件预览或写入，以及写入后的 `doctor` 检查。
- `setup --interactive` 可复用中文问答式初始化收集配置。

### Changed

- `setup` 默认仍是预览模式，只有传入 `--write` 或交互确认后才会写入文件。

### Docs

- README 新增 setup flow 说明。
- 中文 CLI 手册新增 `setup` 章节，并将首次接入推荐流程改为优先使用 `setup`。
- 长期维护方案文档更新 setup 已实现能力。

## [0.0.8] - 2026-06-23

### Fixed

- Claude Code 目标不再生成 `.claude/settings.json.permissions`，避免覆盖用户已有 `allow`、`deny`、`ask` 权限配置。
- `diff`、`doctor`、`write` 增加目标路径 containment 校验，阻止生成文件路径逃逸目标项目根目录。

### Tests

- 增加 Claude Code settings 不写入 permissions 的回归测试。
- 增加生成路径 containment 回归测试，覆盖根目录外路径写入和预览。

## [0.0.7] - 2026-06-22

### Added

- 新增 `agent-workflow init --interactive` 中文问答式初始化流程。
- 交互式 init 会询问目标项目目录、目标环境、项目类型、Agent 角色来源、本地 skill 扫描路径和最终写入确认。
- 交互式 init 支持复用命令行参数作为默认值，例如 `--root`、`--target`、`--project-type`、`--agent-provider` 和 `--write`。

### Changed

- `init --interactive` 默认仍不写入文件，只有最后确认写入后才会调用写入流程。
- 普通 `init`、`generate`、脚本和 CI 使用方式保持非交互行为。

### Docs

- README 新增中文问答式初始化说明。
- 中文 CLI 手册新增 `interactive init` 章节，并把 `--interactive` 标记为当前已支持能力。
- 长期维护方案文档更新 `--interactive` 的实现状态和能力 checklist。

### Tests

- 增加交互式初始化参数收集测试，覆盖默认值、有效输入、无效输入回退和中文确认写入。

## [0.0.6] - 2026-06-22

### Added

- 新增项目本地中文 AI Coding 协作手册 `references/workflow-playbook.md`。
- Codex、Trae、Claude Code 三类 target 都会在 workflow skill references 中生成 `workflow-playbook.md`。
- `workflow-playbook.md` 固化任务定义、计划分析、小步实现、自检验证、人工 Review、Git/PR、worktree 和复盘沉淀流程。
- workflow playbook 内置 `Goal / Context / Constraints / Done when` 任务输入模板。
- workflow playbook 会按前端/后端项目类型输出优先试点场景和第一波不建议硬推的高风险场景。

### Changed

- 项目 workflow `SKILL.md` 会提示中高风险任务先读取 `references/workflow-playbook.md`。
- Codex、Trae、Claude Code 主说明文件会引用 workflow playbook。
- Codex hook `statusMessage` 改为中文提示，方便中文协作团队理解当前 hook 动作。

### Docs

- README 新增 Workflow Playbook 说明。
- 中文 CLI 手册新增 `workflow-playbook` 章节、中文化策略和生成文件清单。
- 长期维护方案文档新增 workflow playbook 设计边界和后续 checklist。

### Tests

- 增加三类 target 生成 `workflow-playbook.md` 的测试。
- 增加 Codex hook 中文状态提示测试。

## [0.0.5] - 2026-06-17

### Docs

- 新增 `CONTRIBUTING.md`，明确贡献流程、安全边界、改动类型、验证命令和版本纪律。
- 新增 `docs/architecture.md`，说明运行流程、模块职责、生成文件模型、目标环境和公共 API。
- 新增 `docs/iteration-guide.md`，说明团队版本迭代流程、完成标准、文档更新矩阵和交接说明。
- 新增 `docs/release.md`，说明版本同步、打包 dry-run、CLI smoke test、发布限制和发布后记录。
- 新增 `docs/testing.md`，说明测试层级、补测规则、fixture 规范、安全断言和当前测试缺口。
- 新增 `docs/adr/0001-core-design-decisions.md`，记录默认预览、managed block、CRM reference、可选 provider、skill 只读扫描和 MCP 复用核心 API 等决策。
- 新增 `.github/PULL_REQUEST_TEMPLATE.md`，固化 PR 安全、文档、版本和验证检查项。

### Changed

- `README.md` 增加团队交付文档入口。
- 中文 CLI 手册新增团队迭代规范章节。
- 长期维护方案文档新增团队交付文档 checklist。
- npm package files 清单新增 `CONTRIBUTING.md` 和 PR 模板，确保团队规范随包保留。

## [0.0.4] - 2026-06-17

### Added

- 新增 `agent-workflow skills analyze`，可扫描本机 Codex、Agent、plugin cache 或自定义目录中的 `SKILL.md` 元信息。
- 新增 `agent-workflow skills recommend`，可根据目标项目画像输出 baseline、project、optional 三类 skill 推荐。
- 新增 `--skill-paths`，支持覆盖本地/global skill 扫描根目录。
- `ProjectProfile` 新增 `skillRecommendations`，记录推荐原因、安装策略、本地可用状态和来源路径。
- Codex、Trae、Claude Code 目标新增 `references/skills.md`，用于保存项目级 skill 推荐说明。
- MCP server 新增 `agent_workflow_skills_analyze` 和 `agent_workflow_skills_recommend`。

### Changed

- 生成的项目 workflow `SKILL.md` 会引用 `references/skills.md`。
- Claude Code `.claude/settings.json` 的 `agentWorkflowScaffold` 元信息会记录推荐 skill id。
- 默认安全策略保持不变：脚手架只扫描和推荐 skill，不复制、不安装、不修改用户全局 skill。

### Docs

- 中文 CLI 操作手册新增 `skills` 命令说明、推荐分类、安全边界和生成文件清单。
- 长期方案文档新增 skill 扫描/推荐设计边界和后续 checklist。

### Tests

- 增加本地 skill scanner 测试。
- 增加 skill recommendation 安装状态测试。
- 增加 `references/skills.md` 生成测试。

## [0.0.3] - 2026-06-17

### Added

- 新增 `--agent-provider builtin|agency-agents|hybrid`。
- 新增 `--agency-agents-path`，支持从本地 `msitarzewski/agency-agents` clone 读取角色 Markdown。
- 新增 `--agent-roles` 和 `--agent-divisions`，支持精选导入 agency-agents 角色。
- agency-agents 角色会进入 `ProjectProfile.subagents`，Claude Code 会生成项目级 `.claude/agents/*.md`，Codex/Trae 会生成 `references/subagents.md` 参考文档。
- MCP options schema 支持 agent provider 相关参数。

### Changed

- Subagent 输出会标注来源：`builtin` 或 `agency-agents`。
- agency-agents 正文会作为 Claude Code subagent 的上游角色指令，并叠加本项目工作流约束。
- 默认仍使用内置 Subagents；不会远程下载 agency-agents，也不会默认写入用户全局 agents 目录。

### Tests

- 增加 agency-agents 本地 fixture 读取测试。
- 增加 hybrid provider 生成 Claude Code subagent 文件测试。

## [0.0.2] - 2026-06-17

### Added

- 新增基础 Subagents 工作流模型，项目画像会根据技术栈选择推荐角色。
- 新增通用 Subagents：`workflow-orchestrator`、`code-reviewer`、`technical-writer`。
- 前端项目自动增加 `frontend-implementer`，Python/后端项目自动增加 `backend-implementer`。
- Codex 和 Trae 生成 `references/subagents.md` 作为角色分工参考。
- Claude Code 生成项目级 `.claude/agents/*.md` subagent 定义，并在 `.claude/settings.json` 中记录生成的 subagent id。

### Changed

- `SKILL.md` 会提示读取 `references/subagents.md`，用于拆分架构、实现、评审和文档任务。
- Codex、Trae、Claude Code 的主说明文件会引用 Subagents 工作流。

### Tests

- 增加 H5 前端 subagent、Python 后端 subagent、Claude Code subagent 文件生成测试。

## [0.0.1] - 2026-06-17

### Added

- 建立独立 npm CLI 脚手架基线，包名为 `@tungee/agent-workflow-scaffold`，CLI 命令为 `agent-workflow`。
- 支持 `analyze`、`init`、`generate`、`diff`、`doctor`、`mcp`、`mcp serve` 命令。
- 支持 Codex、Trae、Claude Code 三类目标环境的基础配置生成。
- 支持 managed block 和结构化 JSON 合并，避免覆盖用户手写内容。
- 支持项目画像分析、生成预览、diff、doctor 检查和 MCP stdio server。
- 新增中文 CLI 操作手册 `docs/cli-zh.md`。
- 新增长期维护方案文档 `docs/workflow-scaffold-evolution-plan.md`。

### Docs

- 明确五个 CRM 项目只作为 preset/reference 参考来源，不作为脚手架硬编码目标。
- 明确新项目和空目录需要支持通用 Agent 工作流初始化。
- 明确 `msitarzewski/agency-agents` 作为可选 Agent 角色 provider 的后续接入方向。
- 增加功能现状校验、后续任务 checklist 和版本维护规则。
