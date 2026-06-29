# Project Profile Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `agent-workflow analyze` more trustworthy for empty, early, and mixed-language projects by adding structured evidence, confidence, explain output, and safer command inference.

**Architecture:** Keep the existing analyzer as the central source of truth and add small, typed evidence helpers inside `src/analyzers/projectAnalyzer.ts`. CLI formatting stays in `src/cli.ts`; `doctor` consumes the enriched `ProjectProfile` without changing generation semantics.

**Tech Stack:** TypeScript, Node.js built-ins, existing Node test runner, existing CLI subprocess tests.

## Global Constraints

- Version target is `0.0.21`.
- Scope is project-profile reliability only; do not implement preset, local agent provider, or Headroom v2.
- `confidence` is the enum `"high" | "medium" | "low"`, not a numeric score.
- `isEmptyProject` is true only when there are no meaningful project signals.
- `manifests` is a structured array and existing `hasPackageJson` / `hasRequirementsTxt` compatibility fields remain.
- Empty or manifest-less directories must not infer `commands.install = "npm install"`.
- `--json` and `--explain` are only supported by `analyze` in this version.
- `doctor` empty-project diagnostics are warning/info only and must not make `ok` false.

---

### Task 1: Profile Evidence Model

**Files:**
- Modify: `src/types.ts`
- Modify: `src/analyzers/projectAnalyzer.ts`
- Test: `src/tests/analyzer.test.ts`

**Interfaces:**
- Produces: `ProjectConfidence = "high" | "medium" | "low"`
- Produces: `ProjectManifestInfo { type; path }`
- Produces: `ProjectProfile.confidence`, `ProjectProfile.isEmptyProject`, `ProjectProfile.manifests`

- [x] Add type definitions for profile confidence and manifest evidence.
- [x] Detect Node, Python, Java, Go, Rust, Docker, and CI manifest files.
- [x] Mark empty projects only when no manifest, source dir, docs, Agent config, or `.git` signal exists.
- [x] Set confidence from manifest strength and project signals.
- [x] Keep existing boolean fields for compatibility.

### Task 2: Safer Command Inference

**Files:**
- Modify: `src/analyzers/projectAnalyzer.ts`
- Test: `src/tests/analyzer.test.ts`

**Interfaces:**
- Produces: `commands.install?: string`

- [x] Return no install command for empty or manifest-less projects.
- [x] Keep Node package-manager install commands for package.json projects.
- [x] Return `pip install -r requirements.txt` only when `requirements.txt` exists.
- [x] Preserve script-derived dev/build/test/lint commands.

### Task 3: Analyze JSON And Explain Output

**Files:**
- Modify: `src/cli.ts`
- Test: `src/tests/cliHelp.test.ts`

**Interfaces:**
- Produces: `agent-workflow analyze --json`
- Produces: `agent-workflow analyze --explain`
- Produces: `agent-workflow analyze --json --explain`

- [x] Parse `--json` and `--explain` flags for analyze only.
- [x] `--json` prints pure JSON without the human summary.
- [x] `--explain` prints readable evidence and command inference notes.
- [x] `--json --explain` adds an `explanation` field to the JSON payload.

### Task 4: Doctor Empty Project Guidance

**Files:**
- Modify: `src/doctor.ts`
- Test: `src/tests/analyzer.test.ts`

**Interfaces:**
- Consumes: `ProjectProfile.isEmptyProject`, `ProjectProfile.confidence`, `ProjectProfile.manifests`

- [x] Add empty-project warning/info diagnostics.
- [x] Keep `DoctorResult.ok` true for empty-project guidance-only diagnostics.
- [x] Avoid changing missing generated artifact errors for normal projects.

### Task 5: Docs, Version, Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/cli-zh.md`
- Modify: `docs/workflow-scaffold-evolution-plan.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/version.ts`

**Interfaces:**
- Produces: version `0.0.21`

- [x] Document `confidence`, `isEmptyProject`, `manifests`, `--json`, and `--explain`.
- [x] Add changelog entry.
- [x] Sync package, lockfile, and runtime version.
- [x] Run `npm run check`.
- [x] Run `npm pack --dry-run` with a writable cache if needed.
