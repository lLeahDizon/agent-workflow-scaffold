import { execFile, spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathExists, readJsonIfExists } from "./utils/fs.js";

const execFileAsync = promisify(execFile);

export const HEADROOM_PACKAGE = "headroom-ai[all]";
export const HEADROOM_PYTHON_COMMAND = "python3";

export interface PythonVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface HeadroomInstallState {
  installedAt: string;
  homePath: string;
  venvPath: string;
  executablePath: string;
  pythonVersion: string;
  packageName: string;
}

export interface HeadroomDoctorResult {
  homePath: string;
  venvPath: string;
  statePath: string;
  executablePath: string;
  stateExists: boolean;
  executableExists: boolean;
  pathCommandFound: boolean;
  pathCommandVersion?: string;
  installState?: HeadroomInstallState;
}

export interface HeadroomInstallResult extends HeadroomDoctorResult {
  installed: boolean;
  skipped: boolean;
  pythonVersion: string;
}

export function defaultHeadroomHome(): string {
  return path.join(os.homedir(), ".cache", "agent-workflow-scaffold", "headroom");
}

export function headroomVenvPath(homePath = defaultHeadroomHome()): string {
  return path.join(homePath, "venv");
}

export function headroomInstallStatePath(homePath = defaultHeadroomHome()): string {
  return path.join(homePath, "install.json");
}

export function headroomExecutablePath(homePath = defaultHeadroomHome()): string {
  return path.join(headroomVenvPath(homePath), process.platform === "win32" ? "Scripts/headroom.exe" : "bin/headroom");
}

function headroomVenvPythonPath(homePath = defaultHeadroomHome()): string {
  return path.join(headroomVenvPath(homePath), process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
}

export function parsePythonVersion(output: string): PythonVersion | undefined {
  const match = output.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? "0")
  };
}

export function formatPythonVersion(version: PythonVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function isPythonVersionSupported(version: PythonVersion): boolean {
  return version.major > 3 || (version.major === 3 && version.minor >= 10);
}

async function detectPythonVersion(): Promise<PythonVersion> {
  try {
    const result = await execFileAsync(HEADROOM_PYTHON_COMMAND, ["--version"], { encoding: "utf8", timeout: 5000 });
    const version = parsePythonVersion(`${result.stdout}\n${result.stderr}`);
    if (!version) {
      throw new Error(`Unable to parse ${HEADROOM_PYTHON_COMMAND} version output.`);
    }
    if (!isPythonVersionSupported(version)) {
      throw new Error(`Headroom install requires Python >= 3.10; detected Python ${formatPythonVersion(version)}.`);
    }
    return version;
  } catch (error) {
    if (error instanceof Error && error.message.includes("requires Python")) {
      throw error;
    }
    throw new Error(`Headroom install requires ${HEADROOM_PYTHON_COMMAND} >= 3.10 in PATH.`);
  }
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

async function checkPathCommand(): Promise<{ found: boolean; version?: string }> {
  try {
    const result = await execFileAsync("headroom", ["--version"], { encoding: "utf8", timeout: 5000 });
    return {
      found: true,
      version: `${result.stdout}\n${result.stderr}`.trim()
    };
  } catch {
    return { found: false };
  }
}

export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [command], { encoding: "utf8", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function inspectHeadroomInstall(homePath = defaultHeadroomHome()): Promise<HeadroomDoctorResult> {
  const venvPath = headroomVenvPath(homePath);
  const statePath = headroomInstallStatePath(homePath);
  const executablePath = headroomExecutablePath(homePath);
  const [stateExists, executableExists, installState, pathCommand] = await Promise.all([
    pathExists(statePath),
    pathExists(executablePath),
    readJsonIfExists<HeadroomInstallState>(statePath),
    checkPathCommand()
  ]);

  return {
    homePath,
    venvPath,
    statePath,
    executablePath,
    stateExists,
    executableExists,
    pathCommandFound: pathCommand.found,
    pathCommandVersion: pathCommand.version,
    installState
  };
}


export async function installHeadroom(input: { force?: boolean; homePath?: string } = {}): Promise<HeadroomInstallResult> {
  const homePath = input.homePath ?? defaultHeadroomHome();
  const before = await inspectHeadroomInstall(homePath);

  if (!input.force && before.stateExists && before.executableExists) {
    return {
      ...before,
      installed: false,
      skipped: true,
      pythonVersion: before.installState?.pythonVersion ?? "unknown"
    };
  }

  const pythonVersion = await detectPythonVersion();
  const pythonVersionText = formatPythonVersion(pythonVersion);

  if (input.force) {
    await rm(before.venvPath, { recursive: true, force: true });
    await rm(before.statePath, { force: true });
  }

  await mkdir(homePath, { recursive: true });
  await runCommand(HEADROOM_PYTHON_COMMAND, ["-m", "venv", before.venvPath]);
  await runCommand(headroomVenvPythonPath(homePath), ["-m", "pip", "install", HEADROOM_PACKAGE]);

  const installState: HeadroomInstallState = {
    installedAt: new Date().toISOString(),
    homePath,
    venvPath: before.venvPath,
    executablePath: before.executablePath,
    pythonVersion: pythonVersionText,
    packageName: HEADROOM_PACKAGE
  };
  await writeFile(before.statePath, `${JSON.stringify(installState, null, 2)}\n`, "utf8");

  const after = await inspectHeadroomInstall(homePath);
  return {
    ...after,
    installed: true,
    skipped: false,
    pythonVersion: pythonVersionText
  };
}
