# Agent Workflow Scaffold CLI 中文操作手册

`@tungee/agent-workflow-scaffold` 是一个独立 npm CLI 脚手架，用于在任意项目根目录生成 Agent 工作流配置。当前支持 Codex、Trae、Claude Code 三类目标环境。

当前版本：`0.0.13`。版本变更记录见项目根目录 `CHANGELOG.md`。

## 1. 快速开始

在目标项目根目录执行：

```bash
npx @tungee/agent-workflow-scaffold setup
```

默认只预览分析结果、推荐 skill 和将生成或更新的文件，不会写入磁盘。确认无误后再执行：

```bash
npx @tungee/agent-workflow-scaffold setup --write
```

也可以继续使用原子命令：

```bash
npx @tungee/agent-workflow-scaffold init --target all
```

写入指定 target：

```bash
npx @tungee/agent-workflow-scaffold init --target all --write
```

如果已经安装到项目开发依赖：

```bash
npm i -D @tungee/agent-workflow-scaffold
npx agent-workflow init --target codex --write
```

需要中文问答式初始化时执行：

```bash
npx agent-workflow setup --interactive
npx agent-workflow init --interactive
```

## 2. 基本概念

### 目标环境 target

`--target` 用于指定生成哪类 Agent 配置：

```text
codex       生成 Codex 配置
trae        生成 Trae 配置
claude-code 生成 Claude Code 配置
all         同时生成三类配置，默认值
```

### 项目类型 project-type

`--project-type` 用于覆盖自动识别结果：

```text
auto        自动识别，默认值
python-crm  Python CRM 后端项目
umi-react   Umi/React 前端项目
h5          H5 移动端项目
management  CRM 管理后台项目
custom      通用项目
```

### 写入策略

CLI 默认是 dry-run，只展示预览：

```bash
agent-workflow init --target codex
```

真正写入必须显式传入：

```bash
agent-workflow init --target codex --write
```

已存在文件不会整文件覆盖。Markdown、TOML、Python 等文本文件会通过 `agent-workflow-scaffold` 管理区块更新；JSON 文件会做对象合并。

`0.0.8` 起，预览、检查和写入都会校验生成路径必须位于目标项目根目录内，避免生成文件访问项目外路径。Claude Code 目标也不会写入 `.claude/settings.json.permissions`，避免覆盖用户已有权限策略。

### 当前能力与规划能力

`0.0.13` 已支持的参数：

```text
--root
--target
--project-type
--agent-provider
--agency-agents-path
--agent-roles
--agent-divisions
--skill-paths
--interactive
--write
```

以下能力已进入方案和 checklist，但当前版本尚未实现：

```text
--project-name
--project-id
--stack
--preset
--non-interactive
--json
--explain
```

在这些参数实现前，请使用 `--project-type custom|python-crm|umi-react|h5|management` 和当前目录文件结构来影响生成结果。

## 3. 命令总览

```bash
agent-workflow analyze
agent-workflow setup
agent-workflow init
agent-workflow generate
agent-workflow diff
agent-workflow doctor
agent-workflow mcp
agent-workflow mcp serve
agent-workflow skills analyze
agent-workflow skills recommend
```

通用参数：

```text
--root <path>              指定目标项目根目录，默认是当前目录
--target <target>          codex|trae|claude-code|all
--project-type <type>      auto|python-crm|umi-react|h5|management|custom
--skill-paths <paths>      逗号分隔的 SKILL.md 扫描根目录
--write                    写入生成结果
```

## 4. analyze：分析项目画像

只读取项目，不写文件：

```bash
agent-workflow analyze
```

指定项目路径：

```bash
agent-workflow analyze --root /Users/leah/IdeaProjects/crm-sales-h5
```

输出内容包括：

- 项目名称和根目录
- 识别出的项目类型
- 包管理器
- 技术栈
- README、docs、`.trae` 等文档入口
- 已存在的 Codex / Trae / Claude Code 配置
- 可用启动、构建、测试、lint 命令

## 5. setup：一键串行配置流程

`0.0.9` 新增 `setup`，用于把首次接入常用命令串成一个流程：

```bash
agent-workflow setup
```

默认流程：

- 分析项目画像。
- 输出 skill 推荐。
- 预览将生成或更新的 Agent 配置文件。
- 不写入文件，提示如需落盘可追加 `--write`。

确认写入并在写入后自动检查：

```bash
agent-workflow setup --target all --write
agent-workflow setup --target codex --write
```

需要中文问答式配置时：

```bash
agent-workflow setup --interactive
```

安全策略：

- `setup` 默认仍是预览模式，不传 `--write` 不写文件。
- `setup --write` 会先打印 diff 摘要，再写入，再自动执行 `doctor`。
- `0.0.8` 起脚手架不再写入 `.claude/settings.json.permissions`，避免覆盖用户已有 Claude Code 权限配置。
- 高级用户仍可继续使用 `analyze`、`skills recommend`、`init`、`diff`、`doctor` 分步执行。

## 6. init：初始化 Agent 配置

预览所有目标环境配置：

```bash
agent-workflow init --target all
```

只生成 Codex 配置：

```bash
agent-workflow init --target codex --write
```

只生成 Claude Code 配置：

```bash
agent-workflow init --target claude-code --write
```

指定项目类型，避免自动识别不准：

```bash
agent-workflow init --project-type python-crm --target all --write
```

在全新空目录执行时，当前版本会生成 `custom` 项目的基础 Agent 工作流配置预览，不会失败：

```bash
mkdir /tmp/agent-empty-project
cd /tmp/agent-empty-project
agent-workflow init --target all
```

注意：`0.0.9` 对空目录的项目画像仍较保守，尚未提供 `confidence`、`isEmptyProject` 等字段，也可能无法准确判断安装、构建、测试命令。后续版本会补充更完整的新项目 bootstrap 流程。

## 7. interactive：中文问答式初始化

`0.0.7` 新增 `init --interactive`，`0.0.9` 起同一套中文向导也支持 `setup --interactive`。首次接入推荐使用：

```bash
agent-workflow setup --interactive
```

如果只想执行初始化生成，不串行 doctor，可继续使用：

```bash
agent-workflow init --interactive
```

向导会依次询问：

- 目标项目目录，默认是当前目录。
- 目标环境：`all`、`codex`、`trae`、`claude-code`。
- 项目类型：`auto`、`python-crm`、`umi-react`、`h5`、`management`、`custom`。
- Agent 角色来源：`builtin`、`agency-agents`、`hybrid`。
- 当选择 `agency-agents` 或 `hybrid` 时，继续询问本地路径、角色 id 和 division。
- 本地 skill 扫描路径。
- 最终是否写入生成结果。

安全策略：

- `agent-workflow setup` 和 `agent-workflow init` 默认不进入交互，避免影响脚本和 CI。
- 只有显式传入 `--interactive` 才进入中文向导。
- 向导默认仍不写文件，最后一步选择“是”才会写入。
- 命令行中提前传入的 `--root`、`--target`、`--project-type`、`--agent-provider`、`--write` 会作为向导默认值，但仍可在问答中调整。

示例：

```bash
agent-workflow setup --interactive
agent-workflow init --interactive
agent-workflow init --interactive --target codex
agent-workflow init --interactive --project-type h5 --target all
```

## 8. generate：生成配置

`generate` 与 `init` 当前行为一致，适合在脚本中表达“根据当前项目画像生成配置”的语义：

```bash
agent-workflow generate --target trae
agent-workflow generate --target trae --write
```

## 9. diff：查看将发生的变化

对比当前项目文件与脚手架将生成的内容：

```bash
agent-workflow diff --target codex
```

输出格式：

```text
create    +79/-0    AGENTS.md
update    +25/-0    .codex/config.toml
unchanged +0/-0     .codex/hooks/repo_policy.py
```

状态说明：

```text
create     文件不存在，将创建
update     文件存在，将更新 managed block 或合并 JSON
unchanged  当前内容已经一致
directory  将确保目录存在
```

## 10. doctor：检查配置完整性

检查目标环境所需文件是否已经存在：

```bash
agent-workflow doctor --target all
```

只检查 Codex：

```bash
agent-workflow doctor --target codex
```

如果尚未执行 `init --write`，`doctor` 会返回缺失项并以非 0 状态码退出，便于 CI 或脚本识别。

## 11. mcp：生成 MCP 配置

打印当前项目的 MCP 配置片段：

```bash
agent-workflow mcp --target codex
```

Codex 输出示例：

```toml
[mcp_servers.agent-workflow-scaffold]
command = "npx"
args = ["-y", "@tungee/agent-workflow-scaffold", "mcp", "serve"]
cwd = "/path/to/project"
```

Trae / Claude Code 输出 JSON：

```bash
agent-workflow mcp --target trae
agent-workflow mcp --target claude-code
```

## 12. mcp serve：启动 MCP Server

手动启动 MCP stdio server：

```bash
agent-workflow mcp serve
```

通常不需要手动执行。生成的 MCP 配置会让目标 Agent 环境按需启动它。

当前 MCP 工具包括：

```text
agent_workflow_analyze
agent_workflow_generate_preview
agent_workflow_diff
agent_workflow_doctor
agent_workflow_skills_analyze
agent_workflow_skills_recommend
agent_workflow_health_check
```

## 13. skills：分析和推荐 Agent Skills

`0.0.4` 新增本地/global skill 扫描与推荐能力，用于回答“当前项目适合哪些基础 skill、哪些是可选 skill”。

扫描本机已有的 `SKILL.md`：

```bash
agent-workflow skills analyze
```

指定扫描目录：

```bash
agent-workflow skills analyze --skill-paths ~/.codex/skills,~/.agents/skills
```

根据当前项目画像输出推荐：

```bash
agent-workflow skills recommend
```

指定项目和扫描目录：

```bash
agent-workflow skills recommend \
  --root /Users/leah/IdeaProjects/crm-sales-h5 \
  --skill-paths ~/.codex/skills,~/.agents/skills
```

推荐分类：

```text
baseline  基础工作流建议，例如 writing-plans、requesting-code-review
project   与项目 workflow skill 生成和维护相关，例如 skill-creator
optional  按项目特征启用，例如浏览器验证、OpenSpec、PDF、文档、表格、企业协同技能
```

安全策略：

- CLI 只扫描 `SKILL.md` 元信息和生成推荐说明。
- 默认不会复制、安装、修改用户全局 skill。
- `find-skills` 作为可选发现能力推荐，不作为默认安装步骤。
- `skill-creator` 作为 skill 生成规则参考推荐，不强制作为运行时依赖。
- 企业协同类 skill，例如 Lark、飞书、钉钉，只在项目有明确标记时作为可选推荐。

`init` / `generate` 会在项目本地 workflow skill 下生成 `references/skills.md`，记录推荐结果和本地安装状态。

## 14. workflow-playbook：中文 AI Coding 协作流程

`0.0.6` 新增 `references/workflow-playbook.md`，用于把团队中文协作中的 AI Coding 顺序固化到项目本地 skill。

生成位置：

```text
.codex/skills/<project-id>-workflow/references/workflow-playbook.md
.trae/skills/<project-id>-workflow/references/workflow-playbook.md
.claude/skills/<project-id>-workflow/references/workflow-playbook.md
```

内容包括：

- 任务定义模板：`Goal / Context / Constraints / Done when`。
- 计划分析要求：影响范围、风险点、验证方式。
- 小步实现要求：一次只做一个清晰子任务。
- 自检验证清单：改动文件、原因、已验证项、未验证风险。
- 人工 Review 口径：仓库规则、复用模式、重复实现、高风险未验证项。
- Git 与 PR 规范：暂存区审查、PR 摘要、影响范围、验证方式、风险与回滚点。
- 并行会话和 worktree 规则：一任务一会话，一高风险任务一 worktree。
- 前端/后端优先试点场景和第一波不建议硬推的场景。

中文化策略：

- Markdown 说明、workflow skill、reference 文档、PR 模板优先使用中文。
- TOML/Python hook 中可以使用中文注释和中文状态提示。
- JSON 配置不写注释，说明放到相邻 Markdown 文档。
- 文件名、命令名、配置键名保持英文，避免破坏工具兼容性。

## 15. 生成文件清单

### Codex

```text
AGENTS.md
.codex/config.toml
.codex/hooks/repo_policy.py
.codex/skills/<project-id>-workflow/SKILL.md
.codex/skills/<project-id>-workflow/references/project-rules.md
.codex/skills/<project-id>-workflow/references/subagents.md
.codex/skills/<project-id>-workflow/references/skills.md
.codex/skills/<project-id>-workflow/references/workflow-playbook.md
.codex/mcp.agent-workflow.json
```

### Trae

```text
.trae/AGENTS.md
.trae/generatedSpecs/
.trae/mcp.json
.trae/agents/*.md
.trae/skills/<project-id>-workflow/SKILL.md
.trae/skills/<project-id>-workflow/references/project-rules.md
.trae/skills/<project-id>-workflow/references/subagents.md
.trae/skills/<project-id>-workflow/references/skills.md
.trae/skills/<project-id>-workflow/references/workflow-playbook.md
```

### Claude Code

```text
CLAUDE.md
.claude/settings.json
.claude/skills/<project-id>-workflow/SKILL.md
.claude/skills/<project-id>-workflow/references/project-rules.md
.claude/skills/<project-id>-workflow/references/subagents.md
.claude/skills/<project-id>-workflow/references/skills.md
.claude/skills/<project-id>-workflow/references/workflow-playbook.md
.claude/agents/*.md
.claude/commands/agent-workflow.md
.mcp.json
```

## 16. 推荐工作流

第一次接入项目：

```bash
agent-workflow setup
agent-workflow setup --write
```

需要逐步检查时：

```bash
agent-workflow analyze
agent-workflow skills recommend
agent-workflow init --target all
agent-workflow diff --target all
agent-workflow init --target all --write
agent-workflow doctor --target all
```

只接入 Codex：

```bash
agent-workflow setup --target codex
agent-workflow setup --target codex --write
```

在非当前目录项目执行：

```bash
agent-workflow setup \
  --root /Users/leah/IdeaProjects/crm-management \
  --project-type management \
  --target all \
  --write
```

## 17. 常见问题

### 五个 CRM 项目是不是唯一支持目标？

不是。`crm`、`crm-common`、`crm-common-order`、`crm-sales-h5`、`crm-management` 只作为规则和模板参考来源。脚手架目标是支持任意项目目录，包括空目录、新项目和存量项目。

当前 `0.0.9` 还没有独立 `--preset` 参数，CRM 相关规则主要通过 `--project-type python-crm|h5|management` 或自动识别间接应用。后续会把技术类型和 CRM preset 解耦。

### 是否支持 Subagents？

支持基础版。

当前 `0.0.13` 会根据项目画像生成推荐 Subagents：

```text
workflow-orchestrator
code-reviewer
technical-writer
frontend-implementer   仅前端/H5/Umi/React 项目
backend-implementer    仅 Python/后端项目
```

不同目标环境的落地方式不同：

- Claude Code：生成项目级 `.claude/agents/*.md`，可作为 Claude Code subagent 定义使用。
- Codex：生成 `.codex/skills/<project-id>-workflow/references/subagents.md`，作为角色分工参考。
- Trae：生成 `.trae/agents/*.md` 项目级 Subagents 定义；同时保留 `.trae/skills/<project-id>-workflow/references/subagents.md`，作为角色分工说明和未启用原生 Subagents 时的 fallback context。

Trae 使用 `.trae/agents/*.md` 前，需要在 Trae Beta settings 中启用 `Enable Subagents Directory`。

当前默认使用内置 Subagents。也可以使用本地 `agency-agents` 仓库作为可选 provider。

### 如何接入 agency-agents？

非交互命令需要先在本地准备 `agency-agents` 仓库：

```bash
git clone https://github.com/msitarzewski/agency-agents.git ../agency-agents
```

只使用 agency-agents 中选定角色：

```bash
agent-workflow init \
  --agent-provider agency-agents \
  --agency-agents-path ../agency-agents \
  --agent-roles frontend-developer,code-reviewer \
  --agent-divisions engineering \
  --target claude-code
```

内置 Subagents + agency-agents 混合：

```bash
agent-workflow init \
  --agent-provider hybrid \
  --agency-agents-path ../agency-agents \
  --agent-roles frontend-developer,software-architect,technical-writer \
  --target all
```

参数说明：

```text
--agent-provider builtin|agency-agents|hybrid
--agency-agents-path <path>       本地 agency-agents 仓库路径
--agent-roles <ids>               逗号分隔角色 id，如 frontend-developer,code-reviewer
--agent-divisions <ids>           逗号分隔分类，如 engineering,design,product
```

当前限制：

- 非交互命令只读取本地路径，不自动远程下载。
- `setup --interactive` / `init --interactive` 中如果未填写路径，会继续询问：改用 `builtin`、输入已有路径，或明确授权自动 clone 到 `~/.cache/agent-workflow-scaffold/agency-agents`。
- 默认不会写入 `~/.claude/agents` 或 `~/.codex/agents` 等用户全局目录。
- 不建议全量导入所有 agency-agents 角色，请使用 `--agent-roles` 精选。
- Trae 会生成 `.trae/agents/*.md`，但需要在 Trae Beta settings 中启用 `Enable Subagents Directory` 后才会自动加载；未启用时仍可使用 `references/subagents.md` 作为人工参考。

### find-skills、skill-creator 会自动帮用户配置 skill 吗？

不会自动安装或复制。

`0.0.9` 会把它们纳入推荐：

- `skill-creator`：适合作为创建项目 workflow skill 或后续扩展 skill 的规则参考。
- `find-skills`：适合作为可选发现能力，帮助用户根据任务寻找更多可安装 skill。

CLI 当前只做扫描和推荐，并把结果写入项目本地 `references/skills.md`。后续如果增加安装命令，也必须要求用户显式确认，并避免修改用户全局 skill 目录。

### 为什么执行 init 后没有文件变化？

没有传 `--write` 时是预览模式。需要写入时执行：

```bash
agent-workflow init --target all --write
```

### 自动识别项目类型不准确怎么办？

使用 `--project-type` 显式指定：

```bash
agent-workflow init --project-type h5 --target all
```

### doctor 返回 error 是否代表脚手架失败？

不一定。若还没有执行 `init --write`，缺失文件是预期结果。执行写入后再运行：

```bash
agent-workflow doctor --target all
```

### 会不会覆盖已有 AGENTS.md 或 CLAUDE.md？

不会整文件覆盖。脚手架只维护带有如下标记的区块：

```html
<!-- agent-workflow-scaffold:start target=codex -->
...
<!-- agent-workflow-scaffold:end target=codex -->
```

已有手写内容会保留。

### JSON 配置如何合并？

例如 `.mcp.json`、`.claude/settings.json`、`.trae/mcp.json` 会做对象级深合并。数组会以脚手架生成值为准。

### 生成 MCP 配置后如何使用？

先执行：

```bash
agent-workflow mcp --target codex
```

再把输出片段放入对应 Agent 环境的 MCP 配置，或直接执行：

```bash
agent-workflow init --target codex --write
```

由脚手架写入项目本地配置。

## 18. 开发者命令

在脚手架项目自身开发时：

```bash
npm install
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
```

用本地构建产物调试：

```bash
node dist/cli.js analyze --root /Users/leah/IdeaProjects/crm
node dist/cli.js init --root /Users/leah/IdeaProjects/crm-sales-h5 --target all
```

发布到内部 npm registry 前：

```bash
npm whoami --registry=https://npm.tangees.com/
npm run check
npm run pack:dry
npm publish
```

当前项目已通过 `.npmrc` 和 `publishConfig` 指向 `https://npm.tangees.com/`。仓库内只保存 registry 地址，不保存 npm token；token 继续放在用户级 `~/.npmrc` 中。

## 19. 版本更新与 CHANGELOG

项目从 `0.0.1` 开始维护 `CHANGELOG.md`。每次对 CLI 行为、生成文件结构、项目分析模型、Agent provider、Subagents、MCP server、文档或操作手册做可发布改动时，都需要新增版本号和变更说明。

版本更新要求：

- 新增版本条目，不把新改动追加到旧版本中。
- 同步更新 `package.json`、`package-lock.json`、`src/mcp/server.ts` 中的版本号。
- 发布前执行 `npm run build`、`node --test dist/tests/*.test.js`、`npm run pack:dry`。
- `CHANGELOG.md` 需要包含日期、变更分类和简明描述。

推荐条目格式：

```text
[0.0.12] - YYYY-MM-DD

Added
- 新增 ...

Fixed
- 修复 ...
```

## 20. 团队迭代规范

`0.0.5` 开始补充团队交付文档，后续团队成员应按这些文档迭代：

```text
CONTRIBUTING.md                         贡献规范和安全边界
docs/architecture.md                    架构与模块职责
docs/iteration-guide.md                 版本迭代流程
docs/release.md                         发版流程
docs/testing.md                         测试规范
docs/adr/0001-core-design-decisions.md  核心架构决策
.github/PULL_REQUEST_TEMPLATE.md        PR 检查模板
```

团队迭代默认流程：

```text
确认目标版本 -> 更新方案/checklist -> 实现功能 -> 补测试 -> 更新文档 -> 更新 CHANGELOG -> 同步版本号 -> 验证 build/test/pack
```

所有团队成员需要遵守：

- 不传 `--write` 不写目标项目文件。
- 不修改目标项目业务代码。
- 不默认写用户全局 skill、agent、MCP 配置。
- 不默认远程下载第三方 provider。
- 生成文本必须使用 managed block。
- JSON 配置必须使用结构化合并。
- 不写入 `.claude/settings.json.permissions`，避免覆盖用户已有 Claude Code 权限配置。
- 每次可发布改动必须更新 `CHANGELOG.md` 和版本号。

## 21. 后续功能 Checklist

完整维护清单见 [workflow-scaffold-evolution-plan.md](workflow-scaffold-evolution-plan.md)。当前优先级如下：

- [ ] 完善空目录和新项目画像，补充 `confidence`、`isEmptyProject`、manifest 识别。
- [ ] 支持 `--project-name`、`--project-id`、`--stack`、`--json`、`--explain`。
- [ ] 增加 `--preset`，将五个 CRM 项目沉淀为可选 preset。
- [ ] 拆分 base rules、stack rules、preset rules 和 local override。
- [x] 实现基础 builtin/agency-agents/hybrid Subagents provider。
- [x] Trae 目标生成 `.trae/agents/*.md` 项目级 Subagents 定义。
- [x] 实现本地/global skill 扫描和项目 skill 推荐。
- [x] 生成 `references/skills.md`，记录基础和可选 skill 建议。
- [x] 生成 `references/workflow-playbook.md`，记录中文 AI Coding 协作主流程。
- [x] Codex hook 状态提示中文化。
- [x] `init --interactive` 支持中文问答式初始化。
- [x] `setup` 支持分析、skill 推荐、预览/写入和 doctor 串行执行。
- [x] Claude Code 配置不再写入 `permissions`，避免覆盖用户已有权限。
- [ ] 实现 local Agent provider 和更完整的 provider 抽象。
- [x] MCP tools 增加 skills analyze 和 skills recommend。
- [ ] 扩展 doctor 和 MCP 的 workflow rules、agent roles 等更细粒度工具。
- [ ] 增加空目录、新项目、CRM preset、真实 agency-agents 仓库、CLI 集成和冲突合并测试。
