# Changelog

本项目从 `0.0.1` 开始记录版本变更。后续每次对 CLI 行为、生成文件结构、项目分析模型、Agent provider、MCP server、文档或操作手册做可发布改动时，都需要新增版本号和对应说明。

## 版本维护规则

- 每次可发布改动都新增一个版本条目，不把新变更追加到旧版本中。
- 版本号遵循 SemVer。当前早期阶段从 `0.0.1` 开始，后续小步改动优先递增 patch，例如 `0.0.2`、`0.0.3`。
- 每个版本条目必须包含日期、变更分类和清晰描述。
- 推荐分类：`Added`、`Changed`、`Fixed`、`Docs`、`Tests`、`Internal`。
- 发布前同步更新 `package.json`、`package-lock.json`、`src/version.ts` 和本文档；MCP server version 从 `src/version.ts` 读取。

## [0.0.21] - 2026-06-29

### Added

- `ProjectProfile` 新增 `confidence`、`isEmptyProject` 和结构化 `manifests` 字段，同时保留 `hasPackageJson`、`hasRequirementsTxt` 兼容字段。
- `analyze` 新增 `--json` 和 `--explain`；两个参数同时使用时输出 `{ profile, explanation }` 结构。
- manifest 识别扩展到 Node、Python、Java、Go、Rust、Docker 和 GitHub Actions workflow。

### Changed

- 空目录和无 manifest 目录不再推断 `commands.install = "npm install"`；只有 `package.json` 或 `requirements.txt` 可确定时才输出安装命令。
- `doctor` 对空项目只输出 warning/info 指引，缺少生成文件不会让 `ok=false`。
- 默认项目摘要和生成的 workflow 规则文档会显示画像可信度、空项目状态和 manifest 证据。

### Docs

- README、中文 CLI 手册和长期维护方案补充项目画像字段、`analyze --json`、`analyze --explain` 和空项目 doctor 行为。

### Tests

- 增加空目录、README-only、Node manifest、Python requirements、CLI JSON/explain 和空项目 doctor 回归测试。

## [0.0.20] - 2026-06-28

### Added

- 新增可选 `--headroom` feature，生成 Headroom 上下文压缩 reference。
- Codex / Claude Code 在启用 Headroom 后生成固定名 `headroom` 的 MCP server 配置；Trae 第一版只生成 reference 文档。
- 新增 `--headroom-command` 和逗号分隔 `--headroom-args`，用于轻量覆盖 Headroom MCP 启动命令。
- 新增 `agent-workflow headroom install` 和 `agent-workflow headroom doctor`，使用脚手架受管 venv 显式安装和检查 Headroom。

### Changed

- manifest 新增 `enabledFeatures.headroom` 和 `featureOptions.headroom`，upgrade 会保留已启用 Headroom 配置。
- `setup --interactive` 增加是否启用 Headroom 的单一问答项。
- `doctor --headroom` 检查项目配置和本机可执行状态；缺少 Headroom 可执行文件只报 warning。

### Docs

- README、中文 CLI 手册和长期维护方案补充 Headroom 默认关闭、显式安装、PATH、token 节省前提、dashboard/proxy 不自动管理等边界说明。

### Tests

- 增加 Headroom 版本解析、路径 helper、生成配置、manifest、doctor 和 CLI help 回归测试。

## [0.0.19] - 2026-06-24

### Docs

- 补齐 README 中文化，中文化主标题和 `Loop Engineering`、`Subagents`、`Skills`、`Workflow Playbook` 等章节标题。
- README 中将 `managed block`、`workflow skill`、`fallback`、`registry`、`dry-run` 等说明补充为中文表达，并保留必要英文术语作为括注。

## [0.0.18] - 2026-06-24

### Fixed

- 修复旧版 managed block 使用 `<!-- agent-workflow-scaffold:end -->` 结束标记时，升级过程可能丢失区块后用户手写内容的问题。
- managed block 解析现在同时兼容旧版无 target 结束标记和新版 `end target=<target>` 结束标记。

### Tests

- 增加旧版无 target 结束标记后保留手写内容的回归测试。
- 增加 `upgrade --write --backup` 升级 legacy Codex 配置后保留用户手写内容的回归测试。

## [0.0.17] - 2026-06-24

### Fixed

- 修复 `0.0.16` 发布包遗漏新增顶层构建产物的问题，确保 `dist/manifest.*`、`dist/upgrade.*`、`dist/version.*` 等模块会进入 npm 包。

### Changed

- `package.json` 的 `files` 白名单改为包含所有顶层 `dist/*.js`、`dist/*.d.ts` 和 `dist/*.js.map`，避免后续新增顶层模块时已构建但未随包发布。

### Docs

- 发布流程补充发布后必须通过私有 registry 执行 `npx` 冒烟测试。

## [0.0.16] - 2026-06-24

### Added

- 新增 `agent-workflow upgrade`，用于升级已配置过的 Agent 工作流文件。
- 新增 `.agent-workflow/manifest.json`，记录 `scaffoldVersion`、`schemaVersion`、targets、enabled features 和 managed files。
- managed block 头部新增 `scaffoldVersion` 和 `schemaVersion` 元数据，并兼容旧版 managed block。
- `upgrade --write --backup` 支持写入前备份将被更新的既有文件到 `.agent-workflow/backups/<timestamp>/`。
- MCP 新增 `agent_workflow_upgrade_preview`，用于预览升级变更。

### Changed

- `doctor` 增加 manifest、legacy managed block、版本元数据和可选能力提示检查。
- `init`、`setup`、`generate` 生成结果会包含 `.agent-workflow/manifest.json`。

### Tests

- 增加 upgrade 空目录跳过、legacy Codex target 探测、备份写入、manifest 写入和 doctor legacy 检查测试。
- 增加新版 managed block 替换旧版 managed block 的兼容测试。

### Docs

- README、中文 CLI 手册和长期维护方案补充升级旧版本配置、manifest 和备份策略说明。

## [0.0.15] - 2026-06-24

### Added

- 新增 `--loop-engineering` 可选开关，用于生成 Loop Engineering 循环工程参考配置。
- `setup --interactive` 和 `init --interactive` 增加中文问答项：是否启用 Loop Engineering 循环工程参考配置，默认不启用。
- Codex、Trae、Claude Code 目标在启用后生成 `references/loop-engineering.md`。
- MCP schema 支持 `loopEngineering` 参数，便于通过 MCP 生成预览、diff 和 doctor 检查可选工作流。

### Changed

- 默认生成结果不包含 Loop Engineering 文件或引用，保持不配置则跳过。

### Tests

- 增加默认跳过 Loop Engineering 和启用后三类 target 生成 reference 的回归测试。
- 更新交互式初始化测试，覆盖 Loop Engineering 默认值和确认启用。

### Docs

- README、中文 CLI 手册和长期维护方案补充 Loop Engineering 可选配置说明。

## [0.0.14] - 2026-06-24

### Added

- 新增 `agent-workflow -help` 帮助入口。
- 支持在命令后使用 `-h`、`-help`、`--help` 查看帮助，例如 `agent-workflow setup -h`。
- 增加 CLI 帮助输出冒烟测试，覆盖顶层帮助别名、命令后帮助别名和 `skills` 帮助。

### Changed

- CLI 主帮助和 `skills` 帮助改为中文命令操作说明。

### Docs

- README 和中文 CLI 手册补充 `-h`、`-help`、`--help`、`help` 使用说明。

## [0.0.13] - 2026-06-24

### Added

- Trae 目标新增 `.trae/agents/*.md` 项目级 Subagents 定义文件生成。
- `.trae/AGENTS.md` 增加 `Enable Subagents Directory` 启用提示，并保留 `references/subagents.md` 作为角色说明和 fallback context。

### Tests

- 增加 Trae Subagents 文件生成测试，覆盖 `--target trae` 和 `--target all`。

### Docs

- README、中文 CLI 手册和长期维护方案补充 Trae `.trae/agents` 支持说明。

## [0.0.12] - 2026-06-23

### Docs

- README 改为中文说明，覆盖快速开始、安装方式、安全策略、命令说明、Subagents、Skills、内部发布和团队维护入口。
- README 补充 `npx` 临时执行、项目开发依赖安装和个人全局安装三种使用方式。

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
