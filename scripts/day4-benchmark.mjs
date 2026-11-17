import { execFile } from "node:child_process";
import { arch, cpus, platform, totalmem } from "node:os";
import { promisify } from "node:util";

const exec = promisify(execFile);
const project = "frenschat-day4-bench";
const compose = ["compose", "-p", project, "-f", "compose.yaml", "-f", "compose.moderation.yaml", "--profile", "moderation"];
const configurations = ["baseline", "redis", "moderation"];
const { stdout: revision } = await exec("git", ["rev-parse", "HEAD"]);
const records = [];

async function docker(args, env) {
  return exec("docker", [...compose, ...args], { env, timeout: 120000 });
}

try {
  for (const mode of configurations) {
    const env = {
      ...process.env,
      FRENSCHAT_BUILD_CONTEXT: ".",
      FRENSCHAT_DOCKERFILE: "Dockerfile",
      FRENSCHAT_IMAGE_TAG: "day4-bench",
      FRENSCHAT_REDIS_URL: mode === "baseline" ? "" : "redis://redis:6379",
      FRENSCHAT_MODERATION_ENABLED: String(mode === "moderation"),
      MESSAGE_REPEAT_LIMIT: "",
    };
    await docker(["up", "--build", "--wait", "--wait-timeout", "90"], env);
    for (let trial = 1; trial <= 3; trial++) {
      const { stdout } = await exec(process.execPath, ["scripts/day1-message-quota.mjs", mode, "--benchmark"], {
        timeout: 55000,
      });
      const record = { trial, ...JSON.parse(stdout) };
      records.push(record);
      console.error(`${mode} trial ${trial}: ${record.burst.accepted}/50 burst admissions, normal p95 ${record.normal.p95Ms} ms`);
    }
  }
  const versions = {};
  for (const [name, command] of Object.entries({
    node: ["api-a", "node", "--version"],
    mongo: ["mongo", "mongosh", "--quiet", "--eval", "db.version()"],
    redis: ["redis", "redis-server", "--version"],
    kafka: ["kafka", "/opt/kafka/bin/kafka-topics.sh", "--version"],
  })) {
    versions[name] = (await docker(["exec", "-T", ...command])).stdout.trim();
  }
  console.log(JSON.stringify({
    revision: revision.trim(),
    host: { platform: platform(), arch: arch(), logicalCpus: cpus().length, memoryBytes: totalmem(), node: process.version },
    versions,
    trials: records,
  }, null, 2));
} finally {
  await docker(["stop"]);
}
