import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cast = process.argv.includes("--cast");
const started = performance.now();
const quotaStack = ["compose", "-p", "frenschat-day4-demo"];
const moderationStack = [
  "compose", "-p", "frenschat-day3", "-f", "compose.yaml", "-f", "compose.moderation.yaml",
];

if (cast) console.log(JSON.stringify({ version: 2, width: 96, height: 24, title: "FrensChat local reliability demo" }));

function show(line) {
  if (cast) console.log(JSON.stringify([Number(((performance.now() - started) / 1000).toFixed(3)), "o", `${line}\r\n`]));
  else console.log(line);
}

const docker = (stack, args, env) => exec("docker", [...stack, ...args], { env, timeout: 120000 });
const run = async (script, args = []) => {
  const job = exec(process.execPath, [script, ...args], { timeout: 120000 });
  createInterface({ input: job.child.stderr }).on("line", show);
  const { stdout } = await job;
  return JSON.parse(stdout);
};

async function quotaDemo() {
  const env = { ...process.env, MESSAGE_REPEAT_LIMIT: "2" };
  try {
    show("Starting two API replicas with a shared Redis cooldown.");
    await docker(quotaStack, ["up", "--build", "--wait"], env);
    await exec(process.execPath, ["scripts/release-smoke.mjs"], {
      env: { ...env, SMOKE_API_BASE_URL: "http://127.0.0.1:5101/api" }, timeout: 45000,
    });
    show("Two-user release smoke passed: sign-in, send, history, read receipt, and logout.");
    show("Sending repeated and distinct messages across both replicas and recipients.");
    const result = await run("scripts/day1-message-quota.mjs", ["repeat"]);
    show(`Redis blocked ${result.repeatBlocked}/${result.repeatAttemptsAfterThreshold} post-threshold repeats.`);
    show(`Accepted ${result.distinctAccepted}/${result.distinctAttempts} distinct sends; cooldown expired as expected.`);
  } finally {
    await docker(quotaStack, ["stop"], env);
  }
}

async function moderationDemo() {
  try {
    show("Starting the Kafka demo. The test stops the broker, then forces the worker to crash.");
    await docker(moderationStack, ["up", "--build", "--wait"]);
    const result = await run("scripts/day3-moderation.mjs");
    show(`While Kafka was stopped: ${result.pendingOutboxWhileKafkaStopped} durable unpublished outbox row.`);
    show(`After restart: same-offset replay in ${result.restartToReplayMs} ms; ${result.duplicateDecisionsAfterReplay} duplicate decisions.`);
    show(`Dead-letter records: ${result.testedMalformedEventsInDlq}; premature socket events: ${result.prematureSocketEvents}.`);
    show("PASS: distributed cooldown and Kafka fault scenarios.");
  } finally {
    await docker(moderationStack, ["--profile", "moderation", "stop"]);
  }
}

await quotaDemo();
await moderationDemo();
