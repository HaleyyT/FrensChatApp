# Day 1 · Shared message quota

FrensChat can enforce one rolling message-send quota per authenticated sender across two Express processes. The default quota is 10 sends in 10 seconds. Redis runs one Lua script that removes expired entries, checks the current count, and reserves a slot atomically. Redis supplies the clock for both API instances. Each sender's sorted set is bounded by the quota and expires after the last accepted reservation.

The quota runs after authentication and request/recipient validation and before the first message write or Socket.IO notification. Excess sends receive `429 MESSAGE_QUOTA_EXCEEDED` and a whole-second `Retry-After` header. If Redis is unavailable or the decision takes more than 500 ms, sends return `503 MESSAGE_QUOTA_UNAVAILABLE` and reads can continue. A command already sent to Redis may reserve a slot after the API times out. That reservation expires automatically. A database error after admission can also consume a slot.

Set `REDIS_URL` on both replicas to enable shared enforcement. Keep the same quota settings and use a dedicated Redis endpoint or database for the deployment. Use an authenticated TLS endpoint for remote Redis. With no URL, the application keeps its existing in-memory IP limits. The Compose stack is for synthetic data on a trusted local machine. Its API ports bind to loopback, MongoDB and Redis have no published ports, and its JWT secret is for this demo only.

## Reproduce the checks

Run from the repo root with Docker Desktop running, Node installed and ports 5101 and 5102 available.

```bash
baseline_dir=$(mktemp -d /tmp/frenschat-day1-baseline.XXXXXX)
git archive 3c186fdbc1984c0c69d998c509876e301400a3a8 | tar -x -C "$baseline_dir"
FRENSCHAT_BUILD_CONTEXT="$baseline_dir" FRENSCHAT_DOCKERFILE="$PWD/Dockerfile" \
  FRENSCHAT_IMAGE_TAG=baseline docker compose -p frenschat-day1-baseline up --build --wait
npm run test:quota -- baseline
docker compose -p frenschat-day1-baseline stop

docker compose -p frenschat-day1 up --build --wait
npm run test:quota -- redis
docker compose -p frenschat-day1 pause redis
npm run test:quota -- outage
docker compose -p frenschat-day1 unpause redis
docker compose -p frenschat-day1 stop redis
npm run test:quota -- outage
docker compose -p frenschat-day1 up -d --wait redis
# Allow the API clients to reconnect before testing recovery.
npm run test:quota -- recovery
docker compose -p frenschat-day1 stop
```

The test runner uses fresh accounts and logs in once per account. It seeds conversations before timing sends so the benchmark measures the existing-conversation path. It records one client's 20 sequential sends, paced 1,100 ms apart, and 50 concurrent requests sent with one cookie, split evenly between the APIs. The runner checks HTTP statuses, retry guidance, authenticated sender identity, exact persisted IDs, independent sender quotas and rollover. Audit, backend regression tests, Socket.IO tests, lint and build run through `npm run verify`.

## Recorded Day 1 results

Local arm64 macOS host, Docker Compose 2.39.2, API Node 22.23.5, host Node 22.22.2, MongoDB 8.0.38, and Redis 8.4.8. Each configuration used two API instances and a 39-byte synthetic message body field. The baseline ran from the exact commit in the commands above. The Redis run used the Day 1 workspace build with updated backend dependencies.

| Measurement | Baseline | Redis enabled |
|---|---:|---:|
| Normal sends accepted | 20/20 | 20/20 |
| Normal send HTTP p95 | 27.27 ms | 23.38 ms |
| Burst duration (50 attempts, 25 per API) | 97 ms | 80 ms |
| Burst sends accepted and persisted | 50 | 10 |
| Burst sends denied with HTTP 429 | 0 | 40 |
| Accepted sends above the new quota | 40 | 0 |
| First send after the quota window | — | HTTP 201 |

The p95 values are descriptive samples from one run of each configuration. Dependency updates and local variance make them unsuitable for attributing a performance gain to Redis.

| Failure check | Both APIs returned | Slowest send response | Messages written by test sender |
|---|---|---:|---:|
| Redis paused | HTTP 503 | 507 ms | 0 |
| Redis stopped | HTTP 503 | 6 ms | 0 |
| Redis restarted | HTTP 201 | 9 ms | 2 |

Chat history stayed readable during both Redis failures. The backend production npm audit reported zero known advisories after compatible dependency updates. The full backend npm audit still flagged the development-only Nodemon dependency tree (`minimatch` and `picomatch`, plus affected parent packages).
