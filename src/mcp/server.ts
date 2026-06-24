import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import { diffGeneratedFiles } from "../diff.js";
import { doctorProject } from "../doctor.js";
import { generateProject } from "../generators/index.js";
import { scanLocalSkills } from "../skills/scanner.js";
import type { AgentProvider, GenerateOptions, ProjectType, TargetInput } from "../types.js";

const SERVER_NAME = "agent-workflow-scaffold";
const SERVER_VERSION = "0.0.15";

const optionsSchema = {
  rootPath: z.string().optional().describe("Target project root. Defaults to the MCP process cwd."),
  projectType: z
    .enum(["auto", "python-crm", "umi-react", "h5", "management", "custom"])
    .optional()
    .describe("Optional project type override."),
  target: z
    .enum(["codex", "trae", "claude-code", "all"])
    .optional()
    .describe("Generation target."),
  agentProvider: z
    .enum(["builtin", "agency-agents", "hybrid"])
    .optional()
    .describe("Subagent provider."),
  agencyAgentsPath: z.string().optional().describe("Local path to msitarzewski/agency-agents clone."),
  agentRoles: z.array(z.string()).optional().describe("agency-agents role ids to include."),
  agentDivisions: z.array(z.string()).optional().describe("agency-agents divisions to scan."),
  skillPaths: z.array(z.string()).optional().describe("Optional SKILL.md scan roots."),
  loopEngineering: z.boolean().optional().describe("Optionally generate Loop Engineering reference workflow artifacts.")
};

const skillOptionsSchema = {
  skillPaths: z.array(z.string()).optional().describe("Optional SKILL.md scan roots.")
};

function optionsFromInput(input: {
  rootPath?: string;
  projectType?: ProjectType;
  target?: TargetInput;
  agentProvider?: AgentProvider;
  agencyAgentsPath?: string;
  agentRoles?: string[];
  agentDivisions?: string[];
  skillPaths?: string[];
  loopEngineering?: boolean;
}): GenerateOptions {
  return {
    rootPath: input.rootPath,
    projectType: input.projectType ?? "auto",
    target: input.target ?? "all",
    agentProvider: input.agentProvider ?? "builtin",
    agencyAgentsPath: input.agencyAgentsPath,
    agentRoles: input.agentRoles,
    agentDivisions: input.agentDivisions,
    skillPaths: input.skillPaths,
    loopEngineering: input.loopEngineering
  };
}

function textResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function errorResponse(error: unknown) {
  return textResponse({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
}

async function execute(operation: () => Promise<unknown> | unknown) {
  try {
    return textResponse({
      ok: true,
      data: await operation()
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  server.tool("agent_workflow_analyze", "Analyze a project and return its Agent workflow profile.", optionsSchema, async (input) =>
    execute(() => analyzeProject(optionsFromInput(input)))
  );

  server.tool("agent_workflow_generate_preview", "Generate Agent workflow artifacts without writing files.", optionsSchema, async (input) =>
    execute(async () => {
      const generated = await generateProject(optionsFromInput(input));
      return {
        profile: generated.profile,
        files: generated.files.map((file) => ({
          target: file.target,
          relativePath: file.relativePath,
          mode: file.mode,
          content: file.mode === "directory" ? "" : file.content
        }))
      };
    })
  );

  server.tool("agent_workflow_diff", "Compare generated Agent artifacts with current project files.", optionsSchema, async (input) =>
    execute(async () => {
      const generated = await generateProject(optionsFromInput(input));
      return {
        profile: generated.profile,
        diff: await diffGeneratedFiles(generated.profile.rootPath, generated.files)
      };
    })
  );

  server.tool("agent_workflow_doctor", "Validate whether generated Agent workflow artifacts exist.", optionsSchema, async (input) =>
    execute(() => doctorProject(optionsFromInput(input)))
  );

  server.tool("agent_workflow_skills_analyze", "Scan local user/global Agent skills without copying or installing them.", skillOptionsSchema, async (input) =>
    execute(() => scanLocalSkills(input.skillPaths))
  );

  server.tool("agent_workflow_skills_recommend", "Analyze a project and return baseline/project/optional skill recommendations.", optionsSchema, async (input) =>
    execute(async () => {
      const profile = await analyzeProject(optionsFromInput(input));
      return {
        profile: {
          rootPath: profile.rootPath,
          projectId: profile.projectId,
          displayName: profile.displayName,
          projectType: profile.projectType,
          techStack: profile.techStack
        },
        skillRecommendations: profile.skillRecommendations,
        policy: "The scaffold does not copy or install user-global skills by default."
      };
    })
  );

  server.tool("agent_workflow_health_check", "Check MCP server availability.", {}, async () =>
    execute(() => ({
      server: SERVER_NAME,
      version: SERVER_VERSION,
      cwd: process.cwd(),
      status: "ok"
    }))
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1]?.endsWith("server.js")) {
  startMcpServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
