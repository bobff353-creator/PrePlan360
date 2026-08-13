import { access } from "node:fs/promises";
import { configPath, currentModuleHashes, lockPath, readJson } from "./foundation-propagation-lib.mjs";

await access(configPath);
await access(lockPath);
const [config, lock] = await Promise.all([readJson(configPath), readJson(lockPath)]);

if (config.schemaVersion !== 1 || lock.schemaVersion !== 1) throw new Error("Unsupported foundation propagation schema.");
if (config.release !== lock.release) throw new Error("Foundation release and propagation lock do not match. Run npm run foundation:sync after reviewing both demo and department changes.");

const configuredIds = Object.keys(config.modules).sort();
const lockedIds = Object.keys(lock.modules).sort();
if (JSON.stringify(configuredIds) !== JSON.stringify(lockedIds)) throw new Error("Foundation module mappings changed. Review the mappings and run npm run foundation:sync.");

const current = await currentModuleHashes(config);
const stale = configuredIds.filter((moduleId) => current[moduleId].demo !== lock.modules[moduleId].demo || current[moduleId].departments !== lock.modules[moduleId].departments);
if (stale.length) {
  const detail = stale.map((moduleId) => {
    const demoChanged = current[moduleId].demo !== lock.modules[moduleId].demo;
    const departmentChanged = current[moduleId].departments !== lock.modules[moduleId].departments;
    return `- ${moduleId}: demo ${demoChanged ? "changed" : "unchanged"}; department implementation ${departmentChanged ? "changed" : "unchanged"}`;
  }).join("\n");
  throw new Error(`Foundation propagation is not acknowledged:\n${detail}\n\nA demo fix may not ship alone. Update its mapped shared department implementation, then run npm run foundation:sync.`);
}

console.log(`Foundation propagation verified: ${config.release} · ${configuredIds.length} mapped areas · shared app/d/[slug] route.`);
