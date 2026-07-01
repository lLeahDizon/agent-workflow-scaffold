# Agent Workflow Scaffold CLI 中文操作手册

`@tungee/agent-workflow-scaffold` 是一个独立 npm CLI 脚手架，用于在任意项目根目录生成 Agent 工作流配置。当前支持 Codex、Trae、Claude Code 三类目标环境。

当前版本：`0.0.23`。版本变更记录见项目根目录 `CHANGELOG.md`。

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

当前版本已支持的参数：

```text
--root
--target
--project-type
--agent-provider
--agency-agents-path
--agent-roles
--agent-divisions
--skill-paths
--loop-engineering
--headroom
--headroom-command
--headroom-args
--json
--explain
--backup
--interactive
--write
--help
-h
-help
```

当前版本已支持的 Hermes 显式子命令：

```text
agent-workflow hermes register
agent-workflow hermes init-project
agent-workflow hermes doctor
agent-workflow hermes list
agent-workflow hermes team init
agent-workflow hermes team doctor
```

以下能力已进入方案和 checklist，但当前版本尚未实现：

```text
--project-name
--project-id
--stack
--preset
--non-interactive
```

在这些参数实现前，请使用 `--project-type custom|python-crm|umi-react|h5|management` 和当前目录文件结构来影响生成结果。

## 3. 命令总览

```bash
agent-workflow -h
agent-workflow -help
agent-workflow --help
agent-workflow help
agent-workflow analyze
agent-workflow analyze --json
agent-workflow analyze --explain
agent-workflow setup
agent-workflow upgrade
agent-workflow init
agent-workflow generate
agent-workflow diff
agent-workflow doctor
agent-workflow mcp
agent-workflow mcp serve
agent-workflow headroom install
agent-workflow headroom doctor
agent-workflow hermes register
agent-workflow hermes init-project
agent-workflow hermes doctor
agent-workflow hermes list
agent-workflow hermes team init
agent-workflow hermes team doctor
agent-workflow skills analyze
agent-workflow skills recommend
```

通用参数：

```text
--root <path>              指定目标项目根目录，默认是当前目录
--target <target>          codex|trae|claude-code|all
--project-type <type>      auto|python-crm|umi-react|h5|management|custom
--skill-paths <paths>      逗号分隔的 SKILL.md 扫描根目录
--loop-engineering         可选启用 Loop Engineering 循环工程参考配置
--headroom                 可选启用 Headroom 上下文压缩参考配置
--headroom-command <cmd>   覆盖 Headroom MCP 启动命令，默认 headroom
--headroom-args <args>     逗号分隔的 Headroom MCP 参数，默认 mcp,serve
--backup                   upgrade 写入前备份将被更新的既有文件
--write                    写入生成结果
--help, -h, -help          查看中文命令操作说明
```

### 3.1 help：查看中文帮助

`0.0.14` 起，CLI 帮助输出统一改为中文说明，支持以下入口：

```bash
agent-workflow -h
agent-workflow -help
agent-workflow --help
agent-workflow help
```

帮助参数也可以放在具体命令后，CLI 会直接输出帮助，不会继续执行分析、生成或写入流程：

```bash
agent-workflow setup -h
agent-workflow init -help
agent-workflow skills --help
```

当前帮助内容会说明推荐流程、命令用途、通用参数、Agent provider、skill 扫描参数和默认安全策略。

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
- 画像可信度 `confidence`
- 空项目状态 `isEmptyProject`
- 结构化 manifest 证据 `manifests`
- 包管理器
- 技术栈
- README、docs、`.trae` 等文档入口
- 已存在的 Codex / Trae / Claude Code 配置
- 可用启动、构建、测试、lint 命令

机器读取时使用纯 JSON 输出：

```bash
agent-workflow analyze --json
```

需要查看判断依据时使用：

```bash
agent-workflow analyze --explain
```

同时需要机器读取和判断依据时：

```bash
agent-workflow analyze --json --explain
```

此时输出结构为：

```json
{
  "profile": {},
  "explanation": {
    "summary": [],
    "evidence": [],
    "commandInference": []
  }
}
```

`confidence` 取值固定为 `high`、`medium`、`low`。`isEmptyProject=true` 只表示未检测到 manifest、源码目录、文档、Agent 配置和 `.git`。空目录或无 manifest 目录不会再猜测 `npm install`；只有存在 `package.json` 时才输出 Node 安装命令，只有存在 `requirements.txt` 时才输出 `pip install -r requirements.txt`。

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
agent-workflow setup --loop-engineering
agent-workflow setup --headroom
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

注意：空目录画像的 `confidence` 会是 `low`，`isEmptyProject` 会是 `true`，不会输出不确定的安装、构建、测试命令。`doctor` 遇到空项目时只给 warning/info 指引，不会仅因空项目建议让检查失败。

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
- 是否启用 Loop Engineering 循环工程参考配置，默认不启用。
- 是否启用 Headroom 上下文压缩参考配置，默认不启用。
- 最终是否写入生成结果。

安全策略：

- `agent-workflow setup` 和 `agent-workflow init` 默认不进入交互，避免影响脚本和 CI。
- 只有显式传入 `--interactive` 才进入中文向导。
- 向导默认仍不写文件，最后一步选择“是”才会写入。
- 命令行中提前传入的 `--root`、`--target`、`--project-type`、`--agent-provider`、`--loop-engineering`、`--headroom`、`--write` 会作为向导默认值，但仍可在问答中调整。
- 向导只询问是否启用 Headroom，不询问 `--headroom-command` 或 `--headroom-args`；命令覆盖请使用非交互 CLI 参数。

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

## 9. upgrade：升级旧版本配置

`0.0.16` 新增 `upgrade`，用于把已配置过脚手架的项目升级到当前 CLI 版本。

```bash
agent-workflow upgrade
```

默认只预览，不写文件。确认后再执行：

```bash
agent-workflow upgrade --write
```

需要备份将被更新的既有文件：

```bash
agent-workflow upgrade --write --backup
```

升级策略：

- 默认只升级已配置过的 target。
- 如果项目只有 Codex 配置，只升级 Codex，不自动新增 Trae 或 Claude Code。
- 没有 `.agent-workflow/manifest.json` 的老项目会按 legacy 处理，通过已有文件探测 target。
- 新版必需文件会补齐，可选功能文件不会自动补齐。
- managed block 外的用户手写内容保留。
- managed block 内属于脚手架托管区，升级时会用当前版本模板替换。
- `--backup` 会把将被 update 的既有文件备份到 `.agent-workflow/backups/<timestamp>/`。

升级后会创建或更新：

```text
.agent-workflow/manifest.json
```

manifest 会记录：

- `scaffoldVersion`
- `schemaVersion`
- `targets`
- `enabledFeatures`
- `managedFiles`
- `lastUpgradeAt`
- `lastBackupPath`

如果项目完全没有检测到旧配置，`upgrade` 不会初始化项目，会提示先运行 `setup` 或 `init`。

## 10. diff：查看将发生的变化

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

## 11. doctor：检查配置完整性和版本健康

检查目标环境所需文件是否已经存在：

```bash
agent-workflow doctor --target all
```

只检查 Codex：

```bash
agent-workflow doctor --target codex
```

如果尚未执行 `init --write`，普通项目的 `doctor` 会返回缺失项并以非 0 状态码退出，便于 CI 或脚本识别。空项目例外：当 `isEmptyProject=true` 时，缺失生成文件和项目初始化建议只作为 warning/info 输出，不会让 `ok=false`。

`0.0.16` 起，`doctor` 也会检查版本健康：

- `.agent-workflow/manifest.json` 是否存在。
- manifest 中的 `scaffoldVersion` 是否低于当前 CLI。
- managed block 是否缺少版本元数据。
- 是否存在 legacy managed block。
- 可选能力是否在 manifest 中启用但检查命令未传对应参数。

## 12. mcp：生成 MCP 配置

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

启用 Headroom 时，Codex / Claude Code 的 MCP 片段会额外包含固定名称 `headroom` 的 server；Trae 第一版不输出 Headroom MCP server：

```bash
agent-workflow mcp --target codex --headroom
agent-workflow mcp --target claude-code --headroom --headroom-args mcp,serve
```

## 13. mcp serve：启动 MCP Server

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

## 14. headroom：显式安装和检查 Headroom

`0.0.20` 新增可选 `--headroom`。该能力默认关闭；不传时不会生成 Headroom reference，也不会写入 Headroom MCP server。

启用项目配置：

```bash
agent-workflow setup --headroom
agent-workflow init --target all --headroom --write
agent-workflow doctor --headroom
```

默认 MCP server 名称固定为 `headroom`：

```json
{
  "command": "headroom",
  "args": ["mcp", "serve"]
}
```

命令覆盖只提供轻量 CLI 参数，不做复杂配置系统：

```bash
agent-workflow setup \
  --headroom \
  --headroom-command /path/to/headroom \
  --headroom-args mcp,serve
```

`--headroom-args` 使用逗号分隔字符串，避免 shell 解析差异。

本机运行时安装必须使用显式子命令：

```bash
agent-workflow headroom install
agent-workflow headroom install --force
agent-workflow headroom doctor
```

安装策略：

- 第一版只提供 `install` 和 `doctor`，暂不提供 `uninstall` / `upgrade`。
- 安装路径固定为 `~/.cache/agent-workflow-scaffold/headroom/venv`，第一版不支持自定义安装目录。
- 使用脚手架受管 venv，安装包为 `headroom-ai[all]`。
- 默认幂等；检测到受管安装状态和可执行文件都存在时直接跳过。
- 需要重装时使用 `--force`，会直接覆盖受管目录，不做备份。
- 安装前 fail fast 检查 `python3 >= 3.10`。
- CLI 不会自动修改 shell PATH，只输出可执行路径和配置建议。

目标环境差异：

- Codex：生成 `references/headroom.md`，并在 `.codex/mcp.agent-workflow.json` 写入 `mcpServers.headroom`。
- Claude Code：生成 `references/headroom.md`，并在 `.mcp.json` 写入 `mcpServers.headroom`。
- Trae：第一版只生成 `references/headroom.md`，不写入 Headroom MCP server。

token 节省前提和限制：

- Headroom 适合长日志、大 diff、大文件读取结果、多工具输出和 RAG 搜索结果进入 Agent 上下文前的压缩。
- 启用 MCP 配置只是接入条件，不代表所有请求都会自动压缩或必然省 token。
- 如果客户端没有实际调用 Headroom MCP/proxy/SDK，普通聊天不会因为生成了配置就自动省 token。
- 需要完整原文且不可压缩的任务，不适合强行压缩。
- 第一版脚手架不自动执行 `headroom wrap`，不启动 proxy，不启动浏览器 dashboard，也不运行 `headroom mcp install`。
- `doctor --headroom` 只检查项目配置和本机可执行状态；缺少可执行文件报 warning，不报 error；不检查 dashboard/proxy 是否正在运行。

## 15. hermes：登记电脑级 Hermes 工作台

`0.0.22` 新增 `agent-workflow hermes` 命令组，用于让 Hermes 在电脑级工作台索引多个项目。Hermes 在脚手架中不是 `AgentTarget`，因此没有 `--target hermes`，也不会进入 `setup --hermes`、`init --hermes`、`generate --hermes` 或交互向导。

设计边界：

- Hermes 是外部能力/运行时集成，不是 Codex、Trae、Claude Code 同级项目内 Agent target。
- 脚手架不会生成 Codex、Claude Code 或 Trae 的 Hermes MCP 配置。
- 脚手架不会安装、启动、停止、登录或检查 Hermes runtime。
- 脚手架不会写入或检查 `~/.hermes/config.yaml`。
- 默认 workspace 为 `~/HermesWorkspace`；这是脚手架创建的项目索引 workspace，不是 Hermes 官方配置目录。
- `0.0.23` 新增的 Hermes team rules 只写 workspace 级规则，不创建 concrete agents、roles、sessions 或 Kanban workers。

### 15.1 register

把一个项目登记到电脑级 workspace：

```bash
agent-workflow hermes register --root /path/to/project
```

指定 workspace：

```bash
agent-workflow hermes register \
  --root /path/to/project \
  --workspace /path/to/HermesWorkspace
```

只预览将写入或更新的文件：

```bash
agent-workflow hermes register --root /path/to/project --dry-run
```

`register` 会创建或更新：

```text
<workspace>/HERMES.md
<project>/.hermes.md
<project>/.agent-workflow/manifest.json
```

`register` 是显式写动作，不需要 `--write`。如果不希望写项目内 `.hermes.md`，可使用：

```bash
agent-workflow hermes register --root /path/to/project --no-project-file
```

此时仍会更新 workspace `HERMES.md` 和项目 manifest。

### 15.2 init-project

只为单个项目生成 Hermes 项目上下文，不登记到 workspace：

```bash
agent-workflow hermes init-project --root /path/to/project
agent-workflow hermes init-project --root /path/to/project --dry-run
```

`init-project` 会创建或更新：

```text
<project>/.hermes.md
<project>/.agent-workflow/manifest.json
```

第一版项目文件名固定为 `.hermes.md`，没有自定义文件名参数。

### 15.3 doctor 和 list

检查当前项目 Hermes 配置：

```bash
agent-workflow hermes doctor --root /path/to/project
agent-workflow hermes doctor --root /path/to/project --workspace /path/to/HermesWorkspace
```

列出 workspace 中登记的项目：

```bash
agent-workflow hermes list
agent-workflow hermes list --workspace /path/to/HermesWorkspace
```

`doctor` 会检查项目 manifest 是否启用 Hermes、`.hermes.md` 是否包含 `target=hermes` managed block、workspace `HERMES.md` 是否包含当前项目。它只报告 Hermes runtime 和 `~/.hermes/config.yaml` 不由脚手架检查，不会检查或启动真实 Hermes 进程。

### 15.4 team init 和 team doctor

`0.0.23` 新增 workspace 级 Hermes team rules，用于让用户启动 Hermes 后，在电脑级工作台动态组建或委派 agents team。它不是项目内 target，也不进入 `setup`、`init`、`generate` 或交互向导。

生成 workspace team 规则：

```bash
agent-workflow hermes team init
agent-workflow hermes team init --workspace /path/to/HermesWorkspace
```

记录可选 role source hint：

```bash
agent-workflow hermes team init \
  --workspace /path/to/HermesWorkspace \
  --agency-agents-path ../agency-agents \
  --agent-roles software-architect,code-reviewer \
  --agent-divisions engineering
```

只预览将写入或更新的文件列表和摘要，不创建目录也不写文件：

```bash
agent-workflow hermes team init --workspace /path/to/HermesWorkspace --dry-run
```

检查脚手架生成的 team 规则：

```bash
agent-workflow hermes team doctor
agent-workflow hermes team doctor --workspace /path/to/HermesWorkspace
```

`team init` 会创建或更新：

```text
<workspace>/HERMES.md
<workspace>/.agent-workflow/hermes-team/rules.md
<workspace>/.agent-workflow/hermes-team/delegation-playbook.md
<workspace>/.agent-workflow/hermes-team/role-sources.md
<workspace>/.agent-workflow/hermes-team/manifest.json
```

managed block target 固定为：

```text
target=hermes-team
target=hermes-team-rules
target=hermes-team-delegation
target=hermes-team-role-sources
```

`HERMES.md` 中的 `target=hermes-team` 与 `target=hermes-workspace` 项目索引彼此独立，可共存并分别更新。team reference 文件也只维护脚手架 managed block，保留文件中其它手写内容。

team manifest 固定为 `.agent-workflow/hermes-team/manifest.json`，由脚手架受管并按当前参数重写；如果已有 JSON 损坏会 fail fast，不自动覆盖。`team doctor` 只检查这些脚手架生成的 workspace team 文件，不检查 Hermes runtime。

team rules 明确不做以下事情：

- 不创建 concrete Hermes agents。
- 不生成 `roles/<role-id>.md` 或 `roster.md`。
- 不安装、启动、停止或检查 Hermes。
- 不写入或检查 `~/.hermes/*`。
- 不读取、复制、导入或改写 `agency-agents` 内容。
- 不校验 `--agent-roles` 或 `--agent-divisions` 是否真实存在。

`--agency-agents-path`、`--agent-roles`、`--agent-divisions` 只是参考 hint，用于让用户后续在 Hermes 内自行选择候选角色。`--agency-agents-path` 指向不存在目录时只输出 warning，不作为 error。

### 15.5 索引和安全策略

workspace 索引文件固定为：

```text
HERMES.md
```

workspace 内的机器可读索引保存在 managed block 中的 JSON 注释：

```text
agent-workflow-scaffold:hermes-workspace-index
```

索引规则：

- 以规范化绝对 `rootPath` 作为项目主键去重。
- Markdown 展示统一使用 `~` 压缩路径。
- JSON 和 manifest 保存规范化绝对路径。
- `updatedAt` 使用 ISO UTC 字符串。
- 已登记但目录不存在的旧项目会保留，并标记为 `missing`。
- 第一版不提供 `unregister` 或 `prune`。

写入规则：

- `.hermes.md` 和 `HERMES.md` 都使用 managed block。
- 已有手写内容会保留。
- 如果能识别 existing managed block 边界，就更新该区块。
- 如果 managed block 边界损坏，无法安全定位，命令会 fail fast，不会自动覆盖。
- workspace index JSON 损坏时，`register`、`list`、`doctor` 都会 fail fast。
- `--root` 必须指向已存在项目目录；缺失目录不会自动创建。
- `register` 中 `--root` 和 `--workspace` 不能是同一目录。

## 16. skills：分析和推荐 Agent Skills

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

## 17. workflow-playbook：中文 AI Coding 协作流程

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

## 18. loop-engineering：可选循环工程参考配置

`0.0.15` 新增 `--loop-engineering`，用于把 AI 代理的 Loop Engineering 循环工程范式作为可选 reference 接入项目 workflow。

默认行为：

- 不传 `--loop-engineering` 时跳过，不生成 `loop-engineering.md`。
- 不改变 `workflow-playbook.md`、Subagents、skills、MCP 的默认生成结果。
- 不自动提交、自动发布、自动合并，也不会绕过 `--write`。

启用方式：

```bash
agent-workflow setup --loop-engineering
agent-workflow init --target all --loop-engineering --write
```

也可以在中文向导中确认启用：

```bash
agent-workflow setup --interactive
```

启用后会在目标 workflow skill references 下生成：

```text
references/loop-engineering.md
```

核心循环：

```text
Frame -> Inspect -> Plan -> Act -> Verify -> Reflect
```

适合场景：

- 多轮排查才能定位的问题。
- 跨多个文件但可以小步收敛的重构。
- 需要持续验证的测试补齐、类型修复、lint 修复。

停止条件：

- 已满足 Done when。
- 连续两轮验证失败且原因未收敛。
- 需要修改权限、安全、生产配置或受保护路径。
- 需求和代码约束冲突，需要人工确认。

## 19. 生成文件清单

`.agent-workflow/manifest.json` 会在 `init/setup/upgrade --write` 后生成或更新，用于记录脚手架版本、schema、target、启用特性和托管文件清单。

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
.codex/skills/<project-id>-workflow/references/loop-engineering.md  启用 --loop-engineering 后生成
.codex/skills/<project-id>-workflow/references/headroom.md          启用 --headroom 后生成
.codex/mcp.agent-workflow.json                                      启用 --headroom 后包含 mcpServers.headroom
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
.trae/skills/<project-id>-workflow/references/loop-engineering.md  启用 --loop-engineering 后生成
.trae/skills/<project-id>-workflow/references/headroom.md          启用 --headroom 后生成；第一版不写入 Headroom MCP server
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
.claude/skills/<project-id>-workflow/references/loop-engineering.md  启用 --loop-engineering 后生成
.claude/skills/<project-id>-workflow/references/headroom.md          启用 --headroom 后生成
.claude/agents/*.md
.claude/commands/agent-workflow.md
.mcp.json                                                            启用 --headroom 后包含 mcpServers.headroom
```

### Hermes

```text
.hermes.md                           hermes init-project 或 hermes register 默认生成
.agent-workflow/manifest.json         记录 enabledFeatures.hermes 和 featureOptions.hermes
<workspace>/HERMES.md                 hermes register 生成或更新，默认 workspace 为 ~/HermesWorkspace
<workspace>/.agent-workflow/hermes-team/rules.md
<workspace>/.agent-workflow/hermes-team/delegation-playbook.md
<workspace>/.agent-workflow/hermes-team/role-sources.md
<workspace>/.agent-workflow/hermes-team/manifest.json
```

## 20. 推荐工作流

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

登记到电脑级 Hermes 工作台：

```bash
agent-workflow hermes register --root /Users/leah/IdeaProjects/crm-management
agent-workflow hermes list
```

生成电脑级 Hermes team 规则：

```bash
agent-workflow hermes team init
agent-workflow hermes team doctor
```

只给单个新项目生成 Hermes 项目上下文：

```bash
agent-workflow hermes init-project --root /Users/leah/IdeaProjects/new-project
```

## 21. 常见问题

### 五个 CRM 项目是不是唯一支持目标？

不是。`crm`、`crm-common`、`crm-common-order`、`crm-sales-h5`、`crm-management` 只作为规则和模板参考来源。脚手架目标是支持任意项目目录，包括空目录、新项目和存量项目。

当前 `0.0.9` 还没有独立 `--preset` 参数，CRM 相关规则主要通过 `--project-type python-crm|h5|management` 或自动识别间接应用。后续会把技术类型和 CRM preset 解耦。

### 是否支持 Subagents？

支持基础版。

`0.0.13` 起会根据项目画像生成推荐 Subagents：

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

### Headroom 启用后会自动省 token 或打开 dashboard 吗？

不会。`--headroom` 只生成项目 reference 和 Codex / Claude Code 的 MCP server 配置，用户仍可在自己的 Agent 客户端里启用或关闭 MCP。第一版不会自动启动 `headroom wrap`、proxy 或浏览器 dashboard；如果需要面板数据，请按 Headroom 自身文档手动启动 dashboard/proxy。`agent-workflow doctor --headroom` 只检查项目配置、本机受管安装和 PATH 可用性，不检查 dashboard/proxy runtime。

### Hermes 是否会被当作一个 target 或 MCP server？

不会。Hermes 是电脑级外部能力/运行时集成，不是 Codex、Trae、Claude Code 同级项目内 Agent target。当前只提供显式 `agent-workflow hermes register`、`init-project`、`doctor`、`list`、`team init`、`team doctor`。其中 `team init` 只生成 workspace 级动态 agents team 规则；不会生成 Hermes MCP 配置，也不会安装或启动 Hermes。

### Hermes team init 会帮我搭建 agents team 吗？

不会。`agent-workflow hermes team init` 只写 `HERMES.md` 的 `target=hermes-team` managed block 和 `.agent-workflow/hermes-team/` 下的规则参考文件。用户需要自行启动 Hermes，并根据任务需要动态创建或委派具体 agents。脚手架不会创建 roles、sessions、Kanban workers，也不会读取或复制 `agency-agents` 内容。

### `~/HermesWorkspace` 是什么？

它是脚手架默认创建的项目索引 workspace，用来放 `HERMES.md`，让 Hermes 有一个电脑级工作台入口来查看多个项目。它不是 Hermes 官方配置目录；脚手架不会写入或检查 `~/.hermes/config.yaml`。

## 22. 开发者命令

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

## 23. 版本更新与 CHANGELOG

项目从 `0.0.1` 开始维护 `CHANGELOG.md`。每次对 CLI 行为、生成文件结构、项目分析模型、Agent provider、Subagents、MCP server、文档或操作手册做可发布改动时，都需要新增版本号和变更说明。

版本更新要求：

- 新增版本条目，不把新改动追加到旧版本中。
- 同步更新 `package.json`、`package-lock.json`、`src/version.ts` 中的版本号；MCP server 会读取 `src/version.ts`。
- 发布前执行 `npm run build`、`node --test dist/tests/*.test.js`、`npm run pack:dry`。
- 发布后必须通过 `npx --registry=https://npm.tangees.com/ --yes @tungee/agent-workflow-scaffold@<version> --help` 验证私有 registry 上的实际包可运行。
- `CHANGELOG.md` 需要包含日期、变更分类和简明描述。

推荐条目格式：

```text
[0.0.17] - YYYY-MM-DD

Added
- 新增 ...

Fixed
- 修复 ...
```

## 24. 团队迭代规范

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

## 25. 后续功能 Checklist

完整维护清单见 [workflow-scaffold-evolution-plan.md](workflow-scaffold-evolution-plan.md)。当前优先级如下：

- [x] 完善空目录和新项目画像，补充 `confidence`、`isEmptyProject`、manifest 识别。
- [x] `analyze` 支持 `--json` 和 `--explain`。
- [ ] 支持 `--project-name`、`--project-id`、`--stack`。
- [ ] 增加 `--preset`，将五个 CRM 项目沉淀为可选 preset。
- [ ] 拆分 base rules、stack rules、preset rules 和 local override。
- [x] 实现基础 builtin/agency-agents/hybrid Subagents provider。
- [x] Trae 目标生成 `.trae/agents/*.md` 项目级 Subagents 定义。
- [x] 实现本地/global skill 扫描和项目 skill 推荐。
- [x] 生成 `references/skills.md`，记录基础和可选 skill 建议。
- [x] 生成 `references/workflow-playbook.md`，记录中文 AI Coding 协作主流程。
- [x] `--loop-engineering` 支持可选生成 `references/loop-engineering.md`，不配置时跳过。
- [x] `--headroom` 支持可选生成 `references/headroom.md`，Codex / Claude Code 生成固定名 `headroom` MCP server，Trae 第一版只生成说明。
- [x] `agent-workflow hermes register` 支持把单个项目登记到电脑级 Hermes workspace `HERMES.md`。
- [x] `agent-workflow hermes init-project` 支持只生成项目 `.hermes.md` 和 manifest。
- [x] `agent-workflow hermes doctor` / `list` 支持检查和查看 Hermes workspace 索引。
- [x] `agent-workflow hermes team init` / `team doctor` 支持生成和检查 workspace 级 Hermes 动态 agents team 规则。
- [x] Codex hook 状态提示中文化。
- [x] CLI 主帮助和 skills 帮助中文化，并支持 `-h`、`-help`、`--help`、`help`。
- [x] `init --interactive` 支持中文问答式初始化。
- [x] `setup` 支持分析、skill 推荐、预览/写入和 doctor 串行执行。
- [x] `upgrade` 支持旧版本配置升级、manifest 写入和可选备份。
- [x] Claude Code 配置不再写入 `permissions`，避免覆盖用户已有权限。
- [x] `doctor --headroom` 检查 Headroom 项目配置和本机可执行状态，缺少可执行文件只报 warning。
- [ ] 实现 local Agent provider 和更完整的 provider 抽象。
- [x] MCP tools 增加 skills analyze 和 skills recommend。
- [ ] 扩展 doctor 和 MCP 的 workflow rules、agent roles 等更细粒度工具。
- [ ] 增加空目录、新项目、CRM preset、真实 agency-agents 仓库、CLI 集成和冲突合并测试。
