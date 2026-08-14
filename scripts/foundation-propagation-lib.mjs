import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..");
export const configPath = path.join(projectRoot, "foundation", "propagation.json");
export const lockPath = path.join(projectRoot, "foundation", "propagation.lock.json");

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function hashFiles(files) {
  const hash = createHash("sha256");
  for (const relativePath of [...files].sort()) {
    const absolutePath = path.join(projectRoot, relativePath);
    hash.update(relativePath.replaceAll("\\", "/"));
    hash.update("\0");
    // Git stores these mapped source files with LF. Normalize Windows worktree
    // line endings so the propagation lock is stable locally and on Vercel.
    hash.update((await readFile(absolutePath, "utf8")).replaceAll("\r\n", "\n"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function currentModuleHashes(config) {
  return Object.fromEntries(await Promise.all(Object.entries(config.modules).map(async ([moduleId, paths]) => [moduleId, {
    demo: await hashFiles(paths.demo),
    departments: await hashFiles(paths.departments),
  }])));
}

export function nextRelease(current) {
  const match = /^(.*?)(\d+)$/.exec(current);
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${current}.1`;
}
