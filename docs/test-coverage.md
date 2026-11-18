# Test coverage

Run the fast checks with `npm run verify`. For the backend report that includes the real API and Kafka worker processes, run `npm run coverage:backend -- --distributed` with Docker Compose running and loopback ports 5101 and 5102 available. The frontend report can also be regenerated with `npm --prefix frontend run coverage`.

The backend denominator is every JavaScript file under `backend/`, including unloaded files. The Docker runs use isolated MongoDB, Redis, and Kafka services and merge the API and worker V8 counters into the same report. Each container invocation writes into its own snapshot directory, and the collector identifies invalid snapshots by path. The frontend denominator is all JavaScript and JSX under `frontend/src/`. React tests use jsdom, intercepted HTTP responses, and simulated socket events. The backend Socket.IO tests use real sockets. Lua behavior is exercised against Redis, but Lua itself is outside the JavaScript coverage denominator.

JSON summaries and LCOV reports are generated under `coverage/backend/` and `frontend/coverage/`. The workflow publishes each report as an artifact. Both the distributed backend and frontend gates require 90% lines, statements, and functions and 85% branches.

## Measured locally

| Suite | Lines and statements | Branches | Functions |
|---|---:|---:|---:|
| Original 13 backend tests, counting all backend source files | 66.87% | 64.43% | 83.33% |
| Expanded backend, including Docker acceptance tests | 94.66% | 87.06% | 100% |
| Frontend behavioral tests | 93.39% | 86.85% | 91.66% |

Before this change, the frontend had no automated behavior suite. The updated suite has 21 backend tests, 16 frontend tests, and real-service acceptance scenarios. The original Docker scenarios verified behavior but did not contribute coverage counters. The new merged figures reflect both added tests and measurement of those service paths.

The Redis wrapper reached 100% lines and branches. The Kafka worker reached 91.42% lines and 85.71% branches. Further backend gaps include startup and shutdown error branches. Frontend coverage measures component behavior in jsdom. Browser layout, real network cookie policies, and cross-replica socket delivery are outside this report.

## What the tests protect

- HTTP and Socket.IO reject invalid sessions. Unauthorized third parties cannot read or mark other users' messages. Validation, allowed origins, credentialed cookies, and response errors have contract assertions.
- Redis checks the same sender quota across two processes. Tests assert accepted HTTP counts and exact persisted IDs, repeat cooldown and expiry, bounded failures on a pause or outage, and recovery after restart.
- Kafka tests storage through broker downtime, worker failure after a durable database write, replay of the same partition and offset, dead-letter handling, and the absence of pending or quarantined content from recipient views and events.
- Frontend tests signed-out preview, auth failures and recovery, sending and quota feedback, pending moderation acknowledgements, history pagination, realtime delivery, and stale history responses when switching chats.
