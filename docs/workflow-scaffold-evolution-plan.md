# Agent Workflow Scaffold 调整方案与长期维护计划

## 1. 背景

`@tungee/agent-workflow-scaffold` 的目标是作为独立 npm CLI 脚手架，在任意项目根目录执行后，为目标项目生成 Agent 工作流配置，包括 `AGENTS.md`、skills、hooks、MCP 配置和不同 Agent 工具的入口文件。

上一版方案以 `crm`、`crm-common`、`crm-common-order`、`crm-sales-h5`、`crm-management` 五个项目为主要分析来源。调整后，这五个项目只作为项目模板和规则沉淀的参考依据，脚手架本身必须面向任意新项目、存量项目和空目录提供通用初始化能力。

## 2. 调整目标

1. 支持在全新的项目目录执行 CLI，仍可完成整套 Agent 工作流配置初始化。
2. 将五个 CRM 项目降级为内置 preset/reference，而不是硬编码项目目标。
3. 增加 Agent 角色配置来源抽象，支持内置角色、项目本地角色，以及可选接入 `msitarzewski/agency-agents`。
4. 保持默认安全策略：默认只预览，不写入；写入必须显式 `--write` 或交互确认。
5. 所有生成文件继续使用 managed block 或结构化合并，避免覆盖用户手写内容。
6. 将方案文档、CLI 中文手册和测试用例纳入长期维护资产。

## 3. 新项目通用初始化设计

### 3.1 适用场景

CLI 需要覆盖三类目标目录：

- 空目录：还没有 `package.json`、`pyproject.toml`、README 或源码目录。
- 新项目初期目录：只有少量 manifest 或 README，技术栈信息不完整。
- 存量项目目录：已有代码、文档、Agent 配置、MCP 配置或工具链命令。

### 3.2 初始化行为

当项目画像信息不足时，脚手架不应失败，而是生成一个 `custom` 项目画像：

- `projectId` 从目录名或 `--project-id` 推导。
- `displayName` 从目录名、`package.json.name` 或 `--project-name` 推导。
- `projectType` 默认为 `custom`，可通过 `--project-type` 覆盖。
- `techStack` 默认为空数组，或从用户参数和已识别文件补充。
- `commands` 仅生成能确定的命令；未知命令不猜测。
- `rules` 使用通用规则模板，要求 Agent 在动手前先读取项目文档和源码结构。

### 3.3 新增建议参数

已支持或后续可补充以下 CLI 参数：

```bash
agent-workflow init --project-name "New CRM Tool" --project-type custom --target all --write
agent-workflow init --stack node,react,python --target codex
agent-workflow init --interactive
agent-workflow setup --interactive
```

参数含义：

- `--project-name <name>`：覆盖生成文档中的项目展示名称。
- `--project-id <id>`：覆盖 skills、目录名和 marker 中使用的稳定 ID。
- `--stack <items>`：补充自动分析无法识别的技术栈。
- `--interactive`：已支持中文问答式初始化；`0.0.7` 接入 `init`，`0.0.9` 扩展到 `setup`，用于收集目标目录、target、project type、Agent provider、skill paths 和最终写入确认。
- `-h` / `-help` / `--help` / `help`：已支持中文命令操作说明；也可以放在具体命令后，例如 `agent-workflow setup -h`。
- `--non-interactive`：CI 场景使用默认值，不进行问答。

### 3.4 空目录输出策略

空目录执行 `agent-workflow init --target all` 时，预期输出：

- 通用 `AGENTS.md` / `CLAUDE.md` / `.trae/AGENTS.md`。
- 基础 workflow skill，内容强调“先分析项目，再制定修改计划”。
- MCP 配置片段，允许后续项目结构变化后重新分析。
- Doctor 检查项，提示缺少 README、验证命令、项目约束文档等可选增强项。

不应输出：

- 与 CRM 强相关的业务规则。
- 不确定的构建、测试、部署命令。
- 假设性的框架目录约束。

## 4. CRM 五项目的定位调整

### 4.1 新定位

`crm`、`crm-common`、`crm-common-order`、`crm-sales-h5`、`crm-management` 不再作为脚手架唯一目标项目，而是作为内置 preset 和规则样本来源。

这些项目用于沉淀：

- 后端 CRM 项目的工作流规则。
- 公共模块和订单公共模块的边界规则。
- H5 项目的移动端验证、构建和页面约束。
- 管理后台项目的 Umi/React、Ant Design、权限和低代码相关规则。
- 项目文档识别、命令识别、MCP 暴露内容的真实样例。

### 4.2 Preset 设计

建议将当前 `ProjectType` 从固定项目名心智调整为通用 preset：

```text
auto
custom
python-crm
node-library
umi-react
h5
management
```

后续如需要保留 CRM 专属规则，可放入可选 preset：

```bash
agent-workflow init --preset crm-backend
agent-workflow init --preset crm-common
agent-workflow init --preset crm-common-order
agent-workflow init --preset crm-sales-h5
agent-workflow init --preset crm-management
```

`--project-type` 用于描述技术/项目形态，`--preset` 用于附加特定业务规则。两者需要解耦。

### 4.3 规则层级

规则建议分三层合成：

1. Base Rules：所有项目通用，如保护用户改动、先读文档、先分析再修改、验证命令优先。
2. Stack Rules：由技术栈决定，如 Node、Python、React、Umi、H5、Monorepo。
3. Preset Rules：由参考项目沉淀，如 CRM 后端、CRM H5、CRM 管理后台。

合成顺序：

```text
base rules -> detected stack rules -> selected preset rules -> local override rules
```

本地 override 可来自项目内的 `.agent-workflow/rules.md` 或现有 Agent 文档。

## 5. agency-agents 接入方案

### 5.1 可行性判断

`msitarzewski/agency-agents` 是一个 MIT License 的开源 Agent 角色集合，仓库中包含大量按 division 分类的 Markdown Agent 文件，并提供面向 Claude Code、Codex 等工具的转换和安装脚本。

该项目适合作为 Agent 角色库来源，但不建议第一版直接强绑定为脚手架核心依赖，原因是：

- 角色库规模大，直接打包会显著增加 npm 包体积。
- 上游目录结构和 agent 内容可能变化，需要适配层隔离。
- 本脚手架的核心职责是“项目工作流配置”，不是维护完整角色市场。
- 目标项目可能只需要少量工程、评审、架构、文档类 Agent。

### 5.2 推荐集成方式

采用可选 provider 抽象：

```text
builtin        使用脚手架内置基础角色
agency-agents  从 agency-agents 本地目录或远程缓存读取角色
hybrid         内置基础角色 + agency-agents 精选角色
local          从目标项目本地 .agent-workflow/agents 读取角色
```

建议 CLI 参数：

```bash
agent-workflow init --agent-provider builtin
agent-workflow init --agent-provider agency-agents --agency-agents-path ../agency-agents
agent-workflow init --agent-provider hybrid --agent-roles frontend-developer,code-reviewer,software-architect
```

第一阶段已支持 `--agency-agents-path` 读取用户本地 clone 的仓库。`0.0.11` 起，交互式初始化在路径为空时可让用户明确选择自动 clone 到本机缓存目录；版本锁定和缓存更新策略仍放到后续阶段。

### 5.3 角色映射

脚手架内部不直接复制所有上游角色，而是建立 `AgentRole` 中间模型：

```ts
interface AgentRole {
  id: string;
  name: string;
  source: "builtin" | "agency-agents" | "local";
  division?: string;
  description: string;
  whenToUse: string[];
  content: string;
}
```

生成器再把 `AgentRole` 转换为不同目标环境：

- Codex：写入 `.codex/skills/<project-id>-workflow/references/agents/*.md`，并在 `SKILL.md` 中引用。
- Trae：写入 `.trae/agents/*.md`，并在 `.trae/AGENTS.md` 中声明可用角色和 `Enable Subagents Directory` 启用要求。
- Claude Code：写入 `.claude/agents/*.md` 或 `.claude/skills/<project-id>-workflow/references/agents/*.md`，并在 `CLAUDE.md` 中引用。

### 5.4 默认精选角色

在通用软件项目中，`hybrid` 模式可默认选择少量角色：

- `software-architect`
- `code-reviewer`
- `technical-writer`
- `frontend-developer`，仅当前端栈存在时启用。
- `backend-architect`，仅后端栈存在时启用。
- `devops-automator`，仅检测到 CI/CD、Docker、Kubernetes 或部署脚本时启用。

CRM preset 可以额外选择：

- `database-optimizer`
- `sales-engineer`
- `pipeline-analyst`
- `feishu-integration-developer`，仅检测到飞书/Lark 集成时启用。

### 5.5 License 与引用策略

接入时必须保留来源说明：

- 在生成文件 managed block 中标注角色来源。
- 在 `docs/cli-zh.md` 增加第三方角色库说明。
- 在 package 文档中说明 `agency-agents` 为可选外部来源，遵循其 MIT License。
- 不在 npm 包中内置完整第三方角色内容，除非后续确认包体积、License 文本和更新策略。

## 6. 架构调整建议

### 6.1 目录结构

建议后续扩展为：

```text
src/
  analyzers/
    projectAnalyzer.ts
    manifests.ts
    docs.ts
    existingConfig.ts
  presets/
    base.ts
    crmBackend.ts
    crmCommon.ts
    crmCommonOrder.ts
    crmSalesH5.ts
    crmManagement.ts
  rules/
    composeRules.ts
    stackRules.ts
    localRules.ts
  agents/
    types.ts
    builtin.ts
    agencyAgentsProvider.ts
    localProvider.ts
    selectRoles.ts
  generators/
    codex.ts
    trae.ts
    claudeCode.ts
    mcpConfig.ts
  writer/
    managedBlock.ts
    fileWriter.ts
  mcp/
    server.ts
```

### 6.2 ProjectProfile 扩展

建议扩展字段：

```ts
interface ProjectProfile {
  projectId: string;
  displayName: string;
  projectType: ProjectType;
  preset?: string;
  confidence: "high" | "medium" | "low";
  isEmptyProject: boolean;
  manifests: ManifestInfo[];
  techStack: string[];
  commands: ProjectCommands;
  docs: ProjectDocument[];
  existingAgentConfig: ExistingAgentConfig;
  rules: ProjectRules;
  selectedAgentRoles: AgentRoleSummary[];
}
```

`confidence` 用于输出分析可信度；空目录和信息不足目录默认为 `low`，CLI 在预览中提示用户可通过参数补充。

### 6.3 Manifest 识别增强

为支持真正通用的新项目，分析器需要从只识别 `package.json`、`requirements.txt` 扩展到：

- Node：`package.json`、`pnpm-lock.yaml`、`yarn.lock`、`package-lock.json`、`turbo.json`、`nx.json`。
- Python：`requirements.txt`、`pyproject.toml`、`poetry.lock`、`Pipfile`。
- Java：`pom.xml`、`build.gradle`、`settings.gradle`。
- Go：`go.mod`。
- Rust：`Cargo.toml`。
- Docker/Deploy：`Dockerfile`、`docker-compose.yml`、`.github/workflows/*`。

第一版实现可以优先增强 Node 与 Python，其它语言只做 lightweight detect。

## 7. CLI 行为调整

### 7.1 init

```bash
agent-workflow init --target all
```

行为：

- 分析当前目录。
- 目录为空时生成通用项目画像。
- 展示项目画像、规则来源、角色来源和将写入文件列表。
- 无 `--write` 时不写入。

### 7.2 analyze

```bash
agent-workflow analyze --json
```

建议新增：

- `--json`：输出机器可读画像。
- `--explain`：解释项目类型、preset、角色选择的判断依据。

### 7.3 generate

```bash
agent-workflow generate --target codex --agent-provider hybrid
```

行为：

- 根据 `ProjectProfile`、`ProjectRules`、`AgentRole[]` 生成目标环境配置。
- 支持写入前 diff。

### 7.4 doctor

检查项扩展：

- 目标工具文件是否完整。
- managed block 是否存在。
- skill 是否引用可用的 reference 文档。
- MCP 配置是否能启动。
- agency-agents 角色来源是否可读。
- 空项目是否缺少 README 或验证命令。

### 7.5 mcp

MCP server 建议暴露：

- `get_project_profile`
- `get_workflow_rules`
- `list_agent_roles`
- `generate_preview`
- `doctor`

### 7.6 skills

`0.0.4` 新增 skill 扫描与推荐命令：

```bash
agent-workflow skills analyze
agent-workflow skills recommend
agent-workflow skills analyze --skill-paths ~/.codex/skills,~/.agents/skills
```

设计边界：

- 只读取本地 `SKILL.md` 元信息，用于判断用户电脑上已有 skill。
- 只生成项目本地 `references/skills.md` 推荐说明。
- 默认不复制、不安装、不修改用户全局 skill。
- `skill-creator` 适合作为项目 workflow skill 生成和维护的基础参考。
- `find-skills` 适合作为可选发现能力，帮助用户查找更多可安装 skill。
- 浏览器、OpenSpec、PDF、文档、表格、演示文稿、Lark/飞书、钉钉等技能只按项目特征作为可选推荐。

### 7.7 workflow playbook

`0.0.6` 新增项目本地中文 AI Coding 协作手册：

```text
references/workflow-playbook.md
```

设计目标：

- 把“定义任务 -> 计划分析 -> 小步实现 -> 自检验证 -> 人工 Review -> Git 提交与 PR -> 复盘沉淀 -> 逐步自动化”固化为生成配置。
- 把 `Goal / Context / Constraints / Done when` 作为团队任务输入模板。
- 明确复杂任务先只读分析，必须说明影响范围、风险点和验证方式。
- 明确提交前暂存区审查、PR 描述、风险与回滚点。
- 明确一任务一会话、一高风险任务一 worktree。
- 为前端、后端项目提供第一波试点场景和不建议硬推的高风险场景。

中文化策略：

- 面向团队阅读的 Markdown、workflow skill、reference 文档、PR 模板优先中文。
- 配置键名、命令名、文件名保持英文，避免破坏工具兼容性。
- TOML/Python hook 可使用中文注释和状态提示。
- JSON 配置不加注释，说明放到相邻 Markdown 文档。

## 8. 写入策略

写入策略保持不变并继续强化：

- 默认 dry-run。
- `--write` 才落盘。
- Markdown、TOML、Python、纯文本使用 managed block 合并。
- JSON 使用结构化合并。
- 已存在用户内容保留。
- 后续可新增 `--backup`，写入前保存 `.bak`。
- 后续可新增 `--force-managed-block`，只强制覆盖脚手架管理区块，不影响用户手写内容。

managed block 示例：

```markdown
<!-- BEGIN agent-workflow-scaffold -->
生成内容
<!-- END agent-workflow-scaffold -->
```

## 9. 分阶段实施计划

### Phase 1：文档和模型调整

- 补充本方案文档。
- 更新中文 CLI 手册，说明空目录初始化、preset 与 agent provider。
- 定义 `AgentRole`、`AgentProvider`、`Preset` 类型。
- 将 CRM 规则说明从“目标项目”改为“参考 preset”。

### Phase 2：通用项目分析增强

- 支持空目录画像。
- 增加 `confidence` 和 `isEmptyProject`。
- 增强 manifest 识别。
- 增加 `--project-name`、`--project-id`、`--stack`。
- 保持现有命令兼容。

### Phase 3：Preset 与规则合成

- 拆分 base rules、stack rules、preset rules。
- 增加 `--preset`。
- 将五个 CRM 项目沉淀为 preset。
- 增加本地 override 规则读取。

### Phase 4：Agent Provider

- 实现 builtin provider。
- 实现 local provider。
- 实现 agency-agents 本地路径 provider。
- 增加角色选择策略和目标环境转换。
- 在生成内容中保留角色来源说明。

### Phase 5：MCP 与测试完善

- 扩展 MCP tools。
- 增加空目录、Node 项目、Python 项目、CRM preset 快照测试。
- 增加 agency-agents fixture 测试。
- 增加 `npm pack --dry-run` 验证。
- 增加 CLI 集成测试。

## 10. 测试计划

基础验证：

```bash
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
```

新项目回归：

```bash
mkdir /tmp/agent-empty-project
cd /tmp/agent-empty-project
npx <local-pack> analyze
npx <local-pack> init --target all
npx <local-pack> init --target all --write
npx <local-pack> doctor --target all
```

CRM preset 回归：

```bash
npx <local-pack> analyze --root /path/to/crm --preset crm-backend
npx <local-pack> init --root /path/to/crm-sales-h5 --preset crm-sales-h5 --target codex
npx <local-pack> diff --root /path/to/crm-management --preset crm-management --target all
```

agency-agents 回归：

```bash
git clone https://github.com/msitarzewski/agency-agents.git /tmp/agency-agents
npx <local-pack> init \
  --agent-provider agency-agents \
  --agency-agents-path /tmp/agency-agents \
  --agent-roles code-reviewer,software-architect \
  --target codex
```

冲突测试：

- 用户已有 `AGENTS.md` 手写内容时，脚手架只更新 managed block。
- 用户已有 `.mcp.json` 时，脚手架只合并自身 server 配置。
- agency-agents 路径不存在时，CLI 给出清晰错误，不生成空角色内容。
- 空目录无 manifest 时，`analyze` 不失败。

## 11. 长期维护规则

1. 每次新增目标环境，必须同时补齐 generator、doctor、diff、MCP 配置和中文手册。
2. 每次新增 preset，必须说明来源项目、适用范围、不可套用的边界条件。
3. 第三方 Agent 角色库必须通过 provider 接入，不直接散落在 generator 中。
4. 生成内容必须可重复、可 diff、可由 managed block 更新。
5. CLI 默认行为必须保持安全：不传 `--write` 不写文件。
6. 文档应持续保留方案版本记录，方便后续回溯设计原因。
7. 每次可发布改动必须新增或更新 `CHANGELOG.md`，且不能把新变更追加到历史版本条目中。
8. 当前版本从 `0.0.1` 开始；后续每次改动递增版本号，并同步 `package.json`、`package-lock.json`、MCP server version。
9. 中文操作手册需要标注当前已支持能力和规划能力，避免把未实现参数描述为已可用。
10. 团队交付文档必须保持可执行，包括贡献规范、架构说明、迭代流程、发布流程、测试规范、ADR 和 PR 模板。

## 12. 当前结论

本次调整后，脚手架的发展方向应从“CRM 项目专用 Agent 配置生成器”升级为“通用项目 Agent 工作流配置脚手架”。五个 CRM 项目继续作为高质量参考样本，用于沉淀 preset 和规则；`agency-agents` 可作为可选外部角色库，通过 provider 机制接入。确认方案后，再进入代码改造、文档同步和测试补充阶段。

## 13. 当前功能校验结果

校验日期：2026-06-23。

校验范围：

- `package.json`、`src/cli.ts`、`src/analyzers/projectAnalyzer.ts`
- `src/generators/*`、`src/doctor.ts`、`src/mcp/server.ts`
- `docs/cli-zh.md`、`docs/workflow-scaffold-evolution-plan.md`
- `CONTRIBUTING.md`、`docs/architecture.md`、`docs/iteration-guide.md`
- `docs/release.md`、`docs/testing.md`、`docs/adr/0001-core-design-decisions.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- 空目录 dry-run：`analyze` 和 `init --target all`
- 构建、单测和 npm 打包预览
- agency-agents 本地 fixture provider 验证

### 13.1 已具备能力

- [x] 独立 npm CLI 包骨架已建立，CLI 命令名为 `agent-workflow`。
- [x] `analyze` 可读取当前项目画像，识别 `package.json`、`requirements.txt`、包管理器、技术栈、docs、现有 Agent 配置。
- [x] `init` / `generate` 默认 dry-run，传 `--write` 后才写入。
- [x] `diff` 可对比将生成文件与当前文件。
- [x] `setup` 可串行执行项目分析、skill 推荐、生成预览/写入和 doctor 检查。
- [x] `doctor` 可检查目标环境生成文件是否存在。
- [x] `mcp` 可输出目标环境 MCP 配置片段。
- [x] `mcp serve` 可启动 MCP stdio server，并提供 analyze、generate preview、diff、doctor、skills analyze、skills recommend、health check 工具。
- [x] `skills analyze` 可扫描本地/global `SKILL.md` 元信息。
- [x] `skills recommend` 可根据项目画像输出 baseline、project、optional 三类 skill 推荐，并标注本地安装状态。
- [x] Codex 目标可生成 `AGENTS.md`、`.codex/config.toml`、hook、skill、reference、MCP JSON。
- [x] Trae 目标可生成 `.trae/AGENTS.md`、`.trae/generatedSpecs/`、`.trae/agents/*.md`、MCP JSON、skill、reference。
- [x] Claude Code 目标可生成 `CLAUDE.md`、`.claude/settings.json`、skill、command、`.mcp.json`。
- [x] Subagents 基础版已实现：项目画像会选择推荐角色，Claude Code 生成 `.claude/agents/*.md`，Trae 生成 `.trae/agents/*.md`，Codex 生成 `references/subagents.md` 作为角色分工参考。
- [x] 生成的 project workflow skill 会包含 `references/skills.md`，记录基础 skill、可选 skill 和安全策略。
- [x] 生成的 project workflow skill 会包含 `references/workflow-playbook.md`，记录中文 AI Coding 主流程、任务模板、Plan、Review、Git/PR 和 worktree 规范。
- [x] Codex hook 状态提示已支持中文说明。
- [x] CLI 主帮助和 `skills` 帮助已支持中文命令操作说明，并支持 `-h`、`-help`、`--help`、`help`。
- [x] `init --interactive` 已支持中文问答式初始化，且只在显式传入参数时启用。
- [x] Claude Code 目标不再生成 `.claude/settings.json.permissions`，避免覆盖用户已有权限。
- [x] `diff`、`doctor`、`write` 会阻止生成路径逃逸目标项目根目录。
- [x] 文本文件使用 managed block，JSON 使用结构化合并。
- [x] 空目录执行 `analyze` 和 `init --target all` 不失败，能生成 `custom` 项目基础配置预览。
- [x] 已新增中文 CLI 操作手册。
- [x] 已新增团队交付文档：贡献规范、架构说明、迭代流程、发布流程、测试规范、ADR、PR 模板。

### 13.2 尚不完善能力

- [ ] 空目录画像仍会默认给出 `npm install`，需要改为“未知时不猜测命令”。
- [ ] `ProjectProfile` 尚未包含 `confidence`、`isEmptyProject`、`manifests`、`preset`、`selectedAgentRoles`。
- [ ] `analyze` 尚不支持 `--json`、`--explain`。
- [ ] `init` / `generate` 尚不支持 `--project-name`、`--project-id`、`--stack`、`--non-interactive`；`--interactive` 当前支持 `init` 和 `setup`。
- [ ] `project-type` 与 CRM preset 尚未解耦，`python-crm`、`h5`、`management` 仍承担部分 preset 语义。
- [ ] 规则仍集中在 `src/templates/projectRules.ts`，尚未拆分 base rules、stack rules、preset rules、local override。
- [ ] 尚无 `--preset` 参数，也未沉淀五个 CRM 项目的独立 preset。
- [x] 已有基础 Subagents provider 能力，支持 `builtin`、`agency-agents`、`hybrid`。
- [x] 已支持读取 `msitarzewski/agency-agents` 本地仓库并生成角色引用。
- [ ] 尚未支持 local provider，也未实现完整可插拔 Agent provider 抽象。
- [ ] Manifest 识别仍偏 Node 和 `requirements.txt`，未覆盖 `pyproject.toml`、`pom.xml`、`go.mod`、`Cargo.toml`、Docker、CI 等。
- [ ] `doctor` 只检查文件存在性，尚未检查 managed block、skill reference、MCP 可启动性、空项目 README/验证命令建议、agency-agents 路径。
- [ ] MCP tools 已支持 skill 扫描/推荐，但尚未暴露 `get_workflow_rules`、`list_agent_roles` 等更细粒度能力。
- [ ] 测试覆盖仍需增强，缺少空目录、新项目、preset、CLI 集成和冲突合并回归。
- [ ] 版本日志流程刚建立，需要从 `0.0.1` 起持续维护 `CHANGELOG.md`。

### 13.3 本次验证命令

```bash
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
```

验证结果：

- `npm run build` 通过。
- `node --test dist/tests/*.test.js` 通过，26 个测试全部通过。
- `npm run pack:dry` 通过，包内容包含 `CHANGELOG.md`、`README.md`、`docs/`、`dist/` 和 `package.json`。

## 14. 后续任务 Checklist

### P0：版本与文档基线

- [x] 将当前版本定为 `0.0.1`。
- [x] 新增 `CHANGELOG.md`，记录 `0.0.1` 初始版本能力和方案调整。
- [x] 在方案文档中补充功能校验结果和任务 checklist。
- [x] 在中文操作手册中补充当前能力、规划能力、版本日志规则。
- [x] 发布前确认 `npm pack --dry-run` 中包含 `CHANGELOG.md`、`README.md`、`docs/` 和 `dist/` 必要文件。
- [x] 新增 `CONTRIBUTING.md`，明确团队贡献规范、安全边界和版本纪律。
- [x] 新增 `docs/architecture.md`，说明核心模块、生成文件模型、目标环境和公共 API。
- [x] 新增 `docs/iteration-guide.md`，说明版本迭代流程、完成标准和文档更新矩阵。
- [x] 新增 `docs/release.md`，说明版本同步、打包校验和发布限制。
- [x] 新增 `docs/testing.md`，说明测试层级、补测规则和已知测试缺口。
- [x] 新增 `docs/adr/0001-core-design-decisions.md`，固化默认预览、managed block、可选 provider、skill 只读扫描等核心决策。
- [x] 新增 `.github/PULL_REQUEST_TEMPLATE.md`，提供 PR 安全、文档、版本和验证检查项。

### P1：通用新项目画像

- [ ] 增加 `confidence` 和 `isEmptyProject` 字段。
- [ ] 空目录不再默认输出 `npm install`，未知命令保持为空。
- [ ] 支持 `--project-name`、`--project-id`、`--stack`。
- [ ] 增加 `--json` 和 `--explain`。
- [ ] 扩展 manifest 识别到 `pyproject.toml`、`poetry.lock`、`Pipfile`、`pom.xml`、`build.gradle`、`go.mod`、`Cargo.toml`、Dockerfile、CI workflow。

### P2：Preset 与规则合成

- [ ] 增加 `--preset` 参数。
- [ ] 拆分 base rules、stack rules、preset rules。
- [ ] 将 `crm`、`crm-common`、`crm-common-order`、`crm-sales-h5`、`crm-management` 沉淀为可选 CRM preset。
- [ ] 支持 `.agent-workflow/rules.md` 本地 override。
- [ ] 更新生成内容，标注规则来源。

### P3：Agent Provider 与 agency-agents

- [x] 实现基础内置 Subagents 选择和生成。
- [x] 定义基础 `AgentProvider` 类型。
- [x] 将当前内置 Subagents 接入 builtin provider。
- [ ] 实现 local provider，读取 `.agent-workflow/agents/*.md`。
- [x] 实现 agency-agents 本地路径 provider，支持 `--agency-agents-path`。
- [x] `setup --interactive` / `init --interactive` 支持 agency-agents 路径缺失时回退 builtin、输入路径或显式 clone 到缓存。
- [x] Trae 目标生成 `.trae/agents/*.md` 项目级 Subagents 定义。
- [x] 支持 `--agent-provider builtin|agency-agents|hybrid`。
- [x] 支持 `--agent-roles` 精选角色。
- [x] 在生成文件中保留第三方角色来源。
- [ ] 支持 `--agent-provider local`。
- [ ] 补充第三方 License 文本或更完整的 License 提示。

### P4：Doctor、MCP 与测试

- [ ] `doctor` 检查 managed block、JSON 合并状态、skill reference、MCP server 可启动性。
- [ ] `doctor` 对空目录提示 README、验证命令、项目约束文档等建议。
- [x] MCP server 增加 skill analyze 和 skill recommend 能力。
- [ ] MCP server 增加 workflow rules、agent roles、精简 project profile 查询能力。
- [ ] 增加空目录、新 Node 项目、新 Python 项目、CRM preset 快照测试。
- [x] 增加 agency-agents fixture 测试。
- [x] 增加 skill scanner、skill recommendations、`references/skills.md` 生成测试。
- [ ] 增加 CLI 集成测试和冲突合并测试。

### P6：Skill 扫描与推荐

- [x] 扫描用户 Codex、Agent 和 plugin cache skill 目录中的 `SKILL.md`。
- [x] 支持 `--skill-paths` 覆盖扫描目录。
- [x] 在 `ProjectProfile.skillRecommendations` 输出推荐结果。
- [x] 将 `skill-creator` 作为基础 skill 创建参考推荐。
- [x] 将 `find-skills` 作为可选 skill 发现能力推荐。
- [x] 前端项目可选推荐浏览器验证 skill。
- [x] OpenSpec、PDF、文档、表格、演示文稿、Lark/飞书、钉钉按项目特征可选推荐。
- [ ] 后续如增加 skill install 命令，必须显式用户确认，并提供 dry-run、diff 和回滚说明。

### P7：中文 AI Coding 工作流沉淀

- [x] 新增 `references/workflow-playbook.md` 生成能力。
- [x] 将 workflow playbook 接入 Codex、Trae、Claude Code 三类 target。
- [x] 在项目 workflow `SKILL.md` 中要求中高风险任务先读取 workflow playbook。
- [x] 在中文手册中补充 workflow playbook 章节和生成文件清单。
- [x] 中文化 Codex hook `statusMessage`。
- [ ] 后续补充更完整的 commit message、PR 描述和 staged diff review 生成命令。
- [ ] 后续补充 MCP 外部事实源模板，例如 PR、Issue、日志、接口文档和知识库。

### P5：发布流程

- [ ] 每次可发布改动更新 `CHANGELOG.md` 新版本条目。
- [ ] 每次版本变更同步 `package.json`、`package-lock.json`、`src/mcp/server.ts`。
- [ ] 发布前执行 `npm run build`、`node --test dist/tests/*.test.js`、`npm run pack:dry`。
- [ ] 发布后记录 npm 包版本、发布日期和验证命令结果。
