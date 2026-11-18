const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

function collectCoverage(root) {
  const snapshots = [];
  for (const directory of readdirSync(root, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const processPath = join(root, directory.name);
    for (const name of readdirSync(processPath)) {
      if (!name.endsWith(".json")) continue;
      const path = join(processPath, name);
      let result;
      try {
        ({ result } = JSON.parse(readFileSync(path, "utf8")));
        if (!Array.isArray(result)) throw new Error("missing V8 result array");
      } catch {
        throw new Error(`Invalid V8 coverage snapshot: ${directory.name}/${name}`);
      }
      snapshots.push({ result: result.filter(({ url }) => url.startsWith("file:///app/backend/")) });
    }
  }
  return snapshots;
}

module.exports = { collectCoverage };
