# Day 3 · Kafka moderation and replay

The opt-in local stack returns HTTP 202 after a MongoDB transaction stores a pending message and an outbox row. The worker publishes a versioned event containing IDs to Kafka and marks the outbox row published after broker acknowledgement. MongoDB remains the source of truth for message text and moderation state.

The worker holds messages containing HTTP(S) links for this demo and approves other text. It records the outcome with a conditional pending-to-final MongoDB update and commits the Kafka offset after the update is durable. Redeliveries have the same event ID and cannot repeat the state transition. Malformed or unmatched records go to a dead-letter topic with offset and reason metadata. Infrastructure errors leave the event uncommitted so it can be retried. The publisher retries pending outbox rows after broker failures.

Pending and quarantined messages are hidden from chat history, sidebar previews, unread counts, read receipts, and live notifications. Approved messages appear on refresh. Existing messages without a moderation status remain visible. The local Kafka stack runs one broker and one MongoDB replica-set member, with the service ports kept inside the Docker network. Moderation is disabled by default and the demo rejects production activation.

This design demonstrates at-least-once event processing with idempotent MongoDB decisions. Dead-letter records can be duplicated if the worker stops between publishing a dead-letter record and committing the source offset. Kafka retention is 24 hours on this demo stack.

## Reproduce the fault tests

```bash
docker compose -p frenschat-day3 -f compose.yaml -f compose.moderation.yaml up --build --wait
npm run test:moderation
docker compose -p frenschat-day3 -f compose.yaml -f compose.moderation.yaml --profile moderation stop
```

The acceptance script stops and starts only this named synthetic Compose project. It submits a message while Kafka is offline, inspects the outbox, forces the worker to exit after saving a decision, verifies the replay, and checks dead-letter handling and recipient visibility.

## Measured local fault run

Docker Desktop on arm64 macOS, two API processes, one worker, one Kafka 4.1.1 broker, and a single-member MongoDB replica set.

| Check | Result |
|---|---|
| Submit while Kafka is stopped | HTTP 202, one pending message and one unpublished outbox record |
| Start crash-injection worker after broker readiness | 5,497 ms to recorded decision and forced process exit |
| Start replacement worker | 7,815 ms to observing replay of the same event ID, partition and offset |
| Durable result after replay | One visible message, zero duplicate decisions, original decision timestamp preserved |
| Malformed record | One matching dead-letter record, then the next valid event was processed |
| Pending and quarantined visibility | No early Socket.IO events and no exposure in tested recipient views |

The timings include container startup or Kafka group recovery and polling by the test harness. They are measurements of one local fault scenario.
