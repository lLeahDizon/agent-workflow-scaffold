const MARKDOWN_BLOCK = /<!-- agent-workflow-scaffold:start [^>]*target=([a-z-]+)[^>]*-->[\s\S]*?<!-- agent-workflow-scaffold:end(?: target=\1)? -->/g;
const COMMENT_BLOCK = /# agent-workflow-scaffold:start [^\n]*target=([a-z-]+)[^\n]*[\s\S]*?# agent-workflow-scaffold:end(?: target=\1)?/g;

export function extractManagedBlocks(content: string): string[] {
  const blocks = [...content.matchAll(MARKDOWN_BLOCK), ...content.matchAll(COMMENT_BLOCK)]
    .map((match) => match[0])
    .filter(Boolean);
  return blocks;
}

function targetFromBlock(block: string): string | undefined {
  return /agent-workflow-scaffold:start [^\n>]*target=([a-z-]+)/.exec(block)?.[1];
}

function blockPattern(target: string): RegExp {
  return new RegExp(
    `(?:<!-- agent-workflow-scaffold:start [^>]*target=${target}[^>]*-->[\\s\\S]*?<!-- agent-workflow-scaffold:end(?: target=${target})? -->|# agent-workflow-scaffold:start [^\\n]*target=${target}[^\\n]*[\\s\\S]*?# agent-workflow-scaffold:end(?: target=${target})?)`,
    "g"
  );
}

export function hasLegacyManagedBlock(content: string): boolean {
  return /agent-workflow-scaffold:start target=([a-z-]+)/.test(content);
}

export function hasVersionedManagedBlock(content: string): boolean {
  return /agent-workflow-scaffold:start [^\n>]*scaffoldVersion=/.test(content);
}

export function hasAnyManagedBlock(content: string): boolean {
  return /agent-workflow-scaffold:start /.test(content);
}

export function assertManagedBlockSafeForTarget(content: string | undefined, target: string): void {
  if (!content || !content.includes("agent-workflow-scaffold:start")) {
    return;
  }

  const startPattern = new RegExp(`agent-workflow-scaffold:start [^\\n>]*target=${target}(?:\\s|[^A-Za-z-])`);
  if (!startPattern.test(content)) {
    return;
  }

  if (!blockPattern(target).test(content)) {
    throw new Error(`Unsafe or corrupted managed block for target ${target}. Fix the block boundaries before retrying.`);
  }
}

export function applyManagedText(existing: string | undefined, generated: string): string {
  if (!existing) {
    return generated.endsWith("\n") ? generated : `${generated}\n`;
  }

  const generatedBlocks = extractManagedBlocks(generated);
  if (generatedBlocks.length === 0) {
    return existing === generated ? existing : generated;
  }

  let next = existing;
  for (const block of generatedBlocks) {
    const target = targetFromBlock(block);
    if (!target) {
      continue;
    }
    const pattern = blockPattern(target);
    if (pattern.test(next)) {
      next = next.replace(pattern, block);
    } else {
      next = `${next.trimEnd()}\n\n${block}\n`;
    }
  }

  return next.endsWith("\n") ? next : `${next}\n`;
}

export function deepMergeJson(existing: unknown, incoming: unknown): unknown {
  if (Array.isArray(existing) || Array.isArray(incoming)) {
    return incoming;
  }
  if (!isPlainObject(existing) || !isPlainObject(incoming)) {
    return incoming;
  }

  const output: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    output[key] = key in output ? deepMergeJson(output[key], value) : value;
  }
  return output;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}
