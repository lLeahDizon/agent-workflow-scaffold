import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

export async function readTextIfExists(targetPath: string): Promise<string | undefined> {
  if (!(await pathExists(targetPath))) {
    return undefined;
  }
  return readFile(targetPath, "utf8");
}

export async function readJsonIfExists<T>(targetPath: string): Promise<T | undefined> {
  const text = await readTextIfExists(targetPath);
  if (!text) {
    return undefined;
  }
  return JSON.parse(text) as T;
}

export async function writeTextFile(targetPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

export async function ensureDirectory(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}
