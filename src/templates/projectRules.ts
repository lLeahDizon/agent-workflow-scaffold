import type { ProjectProfile, ProjectRules, ProjectType } from "../types.js";

const SHARED_WORKFLOW = [
  "Clarify requirement, scope, non-goals, acceptance criteria, and affected projects before implementation.",
  "Keep implementation aligned with the existing project architecture and local helper APIs.",
  "Freeze API or data contracts before frontend/backend integration work.",
  "Run the smallest meaningful verification command and report any unverified risk.",
  "Use code review as the quality gate before commit or release."
];

const SHARED_CODE_STYLE = [
  "Preserve existing package manager and lockfile strategy.",
  "Do not edit generated output directly.",
  "Keep changes scoped to the requested feature or fix.",
  "Do not hard-code production tokens, cookies, or environment-specific domains in feature code.",
  "Inspect modified files before editing and preserve user changes."
];

export function rulesForProjectType(projectType: Exclude<ProjectType, "auto">): ProjectRules {
  switch (projectType) {
    case "python-crm":
      return {
        overview: [
          "Python CRM backend using Flask, MongoDB, Elasticsearch, Celery, and Redis.",
          "API and model docstrings are source material for generated wiki documentation.",
          "Business docs under docs/marketing, docs/sales, and docs/low-code are project workflow references."
        ],
        workflow: SHARED_WORKFLOW,
        codeStyle: [
          ...SHARED_CODE_STYLE,
          "Use Python 3.10-compatible code.",
          "Use absolute imports for project modules where existing code does so.",
          "Keep API handlers thin and move business logic into logic functions.",
          "Use structured logging for errors, important data changes, and operational context."
        ],
        protectedPaths: ["__pycache__/", ".pytest_cache/", "build/", "dist/"],
        envSensitivePaths: ["configs/", "service/configs/", "im/config/", "sdk_config.py"],
        verification: [
          "Run targeted Python import or syntax checks for touched modules.",
          "Run wiki generation only when API docstrings or routes change.",
          "For MongoDB or Elasticsearch model/index changes, verify index creation scripts or migration notes."
        ],
        docs: ["README.md", "docs/marketing/README.md", "docs/sales/README.md", "docs/low-code/README.md"],
        mcp: [
          "Expose project profile and backend workflow rules.",
          "Expose docs summaries for CRM backend module work.",
          "Never expose credentials from configs/*.yaml."
        ]
      };
    case "h5":
      return {
        overview: [
          "CRM Sales H5 application using Umi 4, React, TypeScript, antd-mobile, Ant Design, and Less.",
          "The app uses hash routing and platform-specific code under poly-taiqing, poly-dingding, proxy, exposes, and mcp.",
          "Native bridge behavior, WebView navigation, sharing, contact selection, and multi-end compatibility are high-risk areas."
        ],
        workflow: SHARED_WORKFLOW,
        codeStyle: [
          ...SHARED_CODE_STYLE,
          "Prefer TypeScript/TSX for new work and Less for styles.",
          "Use existing @/ aliases and request helpers from src/http or src/services.",
          "Do not replace native bridge behavior with browser-only logic without explicit confirmation.",
          "Preserve hash route parameters and platform-specific navigation branches."
        ],
        protectedPaths: [".umi/", ".umi-production/", "src/.umi/", "src/.umi-production/", "build/", "src/map-data/"],
        envSensitivePaths: [".umirc.ts", "config/domain.ts", "src/app.ts", "src/routes/", "src/exposes/", "src/mcp/"],
        verification: [
          "For narrow changes, run lint or a targeted build when feasible.",
          "For routes, native bridge, share, or navigation changes, manually verify Web, DingTalk, WeChat, iOS, and Android paths where relevant.",
          "For config or remote module changes, run the matching Umi build script."
        ],
        docs: ["README.md"],
        mcp: [
          "Expose H5 route, platform, and generated config guidance.",
          "Keep secrets and runtime tokens outside MCP responses."
        ]
      };
    case "management":
      return {
        overview: [
          "CRM management frontend using Umi 4, React, TypeScript, Ant Design, and Less.",
          "Services live under src/services and routes under src/routes.",
          "Field configuration, formulas, permissions, workflow, and service management are key business domains."
        ],
        workflow: SHARED_WORKFLOW,
        codeStyle: [
          ...SHARED_CODE_STYLE,
          "Prefer TypeScript/TSX and existing Ant Design patterns.",
          "Keep API access in src/services and shared request handling in src/http.",
          "Keep field order, formula whitelist behavior, and service workflow types explicit."
        ],
        protectedPaths: [".umi/", ".umi-production/", "src/.umi/", "build/", "src/map-data/"],
        envSensitivePaths: [".umirc.ts", "config/domain.ts", "src/app.ts", "src/routes/"],
        verification: [
          "Run targeted lint/build checks for touched TS/TSX files.",
          "For field/formula/service workflow changes, verify the affected service type and UI flow.",
          "For config or route changes, run a Umi build when feasible."
        ],
        docs: ["README.md"],
        mcp: ["Expose management project rules, service domains, and generated artifact checks."]
      };
    case "umi-react":
      return {
        overview: [
          "Umi 4 React frontend using TypeScript, Less, Ant Design, Zustand, qiankun, or Module Federation depending on project config.",
          "The root app, domain mappings, routes, exposes, and generated Umi output require careful handling.",
          "connect-engine documents define workflow, trigger, data connection, and field mapping rules when present."
        ],
        workflow: [
          ...SHARED_WORKFLOW,
          "For connect-engine work, align trigger, connector, task, and workflow node data contracts before implementation."
        ],
        codeStyle: [
          ...SHARED_CODE_STYLE,
          "Prefer TypeScript/TSX and Less.",
          "Use existing @/* and package aliases instead of long relative imports.",
          "Put API calls in service modules and keep UI components focused.",
          "Keep ui-lowcode-common as a separate package when present."
        ],
        protectedPaths: ["src/.umi/", "src/.umi-production/", ".umi/", ".umi-production/", "build/", "src/map-data/"],
        envSensitivePaths: [".umirc.ts", "config/domain.ts", "src/app.ts", "src/routes/", "src/exposes/"],
        verification: [
          "Use the smallest relevant Umi build or lint command.",
          "Run ui-lowcode-common commands from that package when the change is inside it.",
          "Regenerate tracking map data from src/point-xlsx instead of editing src/map-data directly."
        ],
        docs: [
          "README.md",
          "src/packages/connect-engine/README.md",
          "src/packages/connect-engine/components/TriggerSelector/DATA_SCHEMA.md"
        ],
        mcp: [
          "Expose frontend package rules and connect-engine workflow references.",
          "Do not expose local tokens, cookies, or environment-specific private values."
        ]
      };
    case "custom":
      return {
        overview: ["Custom project detected. Use local README, manifests, and existing Agent configs as source of truth."],
        workflow: SHARED_WORKFLOW,
        codeStyle: SHARED_CODE_STYLE,
        protectedPaths: ["build/", "dist/", "node_modules/"],
        envSensitivePaths: [".env", ".env.local", "config/"],
        verification: ["Run the smallest available project verification command."],
        docs: ["README.md"],
        mcp: ["Expose generic project profile and generated artifact checks."]
      };
  }
}

export function mergeDetectedRules(profile: ProjectProfile): ProjectRules {
  const rules = profile.rules;
  return {
    ...rules,
    docs: Array.from(new Set([...rules.docs, ...profile.docFiles])).slice(0, 24)
  };
}
