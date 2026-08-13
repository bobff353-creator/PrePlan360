import { access, writeFile } from "node:fs/promises";
import { configPath, currentModuleHashes, lockPath, nextRelease, readJson } from "./foundation-propagation-lib.mjs";

const initializing = process.argv.includes("--initialize");
const config = await readJson(configPath);
let lock = null;
try {
  await access(lockPath);
  lock = await readJson(lockPath);
} catch {
  if (!initializing) throw new Error("The propagation lock is missing. Use --initialize only when establishing the first reviewed baseline.");
}

const current = await currentModuleHashes(config);
if (lock) {
  const demoWithoutDepartment = Object.keys(config.modules).filter((moduleId) => {
    const previous = lock.modules[moduleId];
    return previous && current[moduleId].demo !== previous.demo && current[moduleId].departments === previous.departments;
  });
  if (demoWithoutDepartment.length) throw new Error(`Refusing to acknowledge a demo-only change: ${demoWithoutDepartment.join(", ")}. Update the mapped shared department implementation first.`);
  config.release = nextRelease(config.release);
}

const nextLock = {
  schemaVersion: 1,
  release: config.release,
  generatedAt: new Date().toISOString(),
  sharedDepartmentRoute: "app/d/[slug]/page.tsx",
  currentDepartments: ["stickney", "fermilab"],
  futureDepartments: "automatic-through-shared-route",
  modules: current,
};

await Promise.all([
  writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`),
  writeFile(lockPath, `${JSON.stringify(nextLock, null, 2)}\n`),
]);
console.log(`Foundation propagation baseline saved as ${config.release}.`);
