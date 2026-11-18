import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const distributed = process.argv.includes("--distributed");
const baseline = process.argv.includes("--baseline");
mkdirSync("coverage", { recursive: true });
const raw = mkdtempSync(join(process.cwd(), "coverage", "frenschat-v8-"));
const volume = basename(raw).toLowerCase();
const quotaProject = `${volume}-quota`;
const moderationProject = `${volume}-moderation`;
const files = ["compose.yaml", "compose.moderation.yaml", "compose.coverage.yaml"];
let volumeCreated = false;
const env = { ...process.env, NODE_V8_COVERAGE: raw };
const containerEnv = { ...process.env, FRENSCHAT_COVERAGE_VOLUME: volume,
  FRENSCHAT_REDIS_URL: "redis://redis:6379", MESSAGE_REPEAT_LIMIT: "", FRENSCHAT_MODERATION_ENABLED: "true",
  FRENSCHAT_MODERATION_TEST_PROJECT: moderationProject };

const run = (command, args, environment = process.env) =>
  execFileSync(command, args, { env: environment, stdio: "inherit" });

function compose(project, files, args, extra = {}) {
  run("docker", ["compose", "-p", project, ...files.flatMap((file) => ["-f", file]), ...args],
    { ...containerEnv, ...extra });
}

try {
  const tests = readdirSync("tests").filter((file) => file.endsWith(".test.js")).map((file) => join("tests", file));
  run(process.execPath, ["--test", "--test-concurrency=1", ...tests], env);
  if (distributed) {
    run("docker", ["volume", "create", volume]);
    volumeCreated = true;
    run("docker", ["run", "--rm", "-v", `${volume}:/coverage`, "node:22-bookworm-slim", "chown", "node:node", "/coverage"]);
    // The shared override also defines the worker, which is gated by its Compose profile.
    const stop = ["--profile", "moderation", "stop"];
    try {
      compose(quotaProject, files, ["up", "--build", "--wait", "api-a", "api-b"],
        { FRENSCHAT_MODERATION_ENABLED: "false" });
      run(process.execPath, ["scripts/day1-message-quota.mjs", "redis"]);
      compose(quotaProject, files, ["up", "--wait", "api-a", "api-b"],
        { FRENSCHAT_MODERATION_ENABLED: "false", MESSAGE_REPEAT_LIMIT: "2" });
      run(process.execPath, ["scripts/day1-message-quota.mjs", "repeat"]);
      compose(quotaProject, files, ["pause", "redis"]);
      try {
        run(process.execPath, ["scripts/day1-message-quota.mjs", "outage"]);
      } finally {
        compose(quotaProject, files, ["unpause", "redis"]);
      }
      compose(quotaProject, files, ["stop", "redis"]);
      run(process.execPath, ["scripts/day1-message-quota.mjs", "outage"]);
      compose(quotaProject, files, ["up", "-d", "--wait", "redis"]);
      run(process.execPath, ["scripts/day1-message-quota.mjs", "recovery"]);
    } finally {
      compose(quotaProject, files, stop);
    }
    try {
      compose(moderationProject, files, ["up", "--build", "--wait"]);
      run(process.execPath, ["scripts/day3-moderation.mjs"], containerEnv);
    } finally {
      compose(moderationProject, files, stop);
    }
    const captured = execFileSync("docker", ["run", "--rm", "-v", `${volume}:/coverage:ro`, "node:22-bookworm-slim",
      "node", "-e", readFileSync(new URL("./collect-container-coverage.cjs", import.meta.url), "utf8") +
        "\nfor (const snapshot of collectCoverage('/coverage')) console.log(JSON.stringify(snapshot));",
    ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
    if (!captured) throw new Error("Docker processes did not write coverage");
    for (const [index, line] of captured.split("\n").entries()) {
      const coverage = JSON.parse(line);
      for (const entry of coverage.result) {
        entry.url = new URL(entry.url.slice("file:///app/".length), pathToFileURL(process.cwd() + "/")).href;
      }
      writeFileSync(join(raw, `container-${index}.json`), JSON.stringify(coverage));
    }
  }
  const thresholds = baseline ? [] : ["--check-coverage", "--lines", distributed ? "90" : "75",
    "--statements", distributed ? "90" : "75", "--branches", distributed ? "85" : "70",
    "--functions", distributed ? "90" : "75"];
  run(process.execPath, ["node_modules/c8/bin/c8.js", "report", "--all", "--src", "backend",
    "--include", "backend/**/*.js", "--temp-directory", raw, "--reporter", "text",
    "--reporter", "json-summary", "--reporter", "lcov", "--reports-dir", "coverage/backend", ...thresholds]);
} finally {
  rmSync(raw, { recursive: true, force: true });
  if (volumeCreated) {
    for (const project of [quotaProject, moderationProject]) {
      compose(project, files, ["--profile", "moderation", "down", "--volumes"]);
    }
    run("docker", ["volume", "rm", volume]);
  }
}
