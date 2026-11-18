import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectCoverage } from "../scripts/collect-container-coverage.cjs";

test("coverage snapshots with the same filename in different processes are both retained", (t) => {
  const root = mkdtempSync(join(tmpdir(), "frenschat-collector-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [directory, entry] of [["process.a", "app.js"], ["process.b", "moderation-worker.js"]]) {
    const path = join(root, directory);
    mkdirSync(path);
    writeFileSync(join(path, "coverage-12-1000-0.json"), JSON.stringify({
      result: [{ url: `file:///app/backend/${entry}` }, { url: "node:fs" }],
    }));
  }
  const paths = collectCoverage(root).flatMap(({ result }) => result.map(({ url }) => url)).sort();
  assert.deepEqual(paths, ["file:///app/backend/app.js", "file:///app/backend/moderation-worker.js"]);
});

test("truncated coverage fails with the filename and without dumping payloads", (t) => {
  const root = mkdtempSync(join(tmpdir(), "frenschat-collector-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "process.a"));
  writeFileSync(join(root, "process.a", "coverage.json"), '{"result": [');
  assert.throws(() => collectCoverage(root), { message: "Invalid V8 coverage snapshot: process.a/coverage.json" });
});
