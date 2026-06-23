import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathExists } from "../utils/fs.js";

export const AGENCY_AGENTS_REPO_URL = "https://github.com/msitarzewski/agency-agents.git";

export function defaultAgencyAgentsCachePath(): string {
  return path.join(os.homedir(), ".cache", "agent-workflow-scaffold", "agency-agents");
}

function runGitClone(targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["clone", AGENCY_AGENTS_REPO_URL, targetPath], {
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`git clone failed with exit code ${code ?? "unknown"}`));
    });
  });
}

export async function ensureAgencyAgentsCache(targetPath = defaultAgencyAgentsCachePath()): Promise<string> {
  const resolvedPath = path.resolve(targetPath);
  if (await pathExists(resolvedPath)) {
    return resolvedPath;
  }
  await runGitClone(resolvedPath);
  return resolvedPath;
}
