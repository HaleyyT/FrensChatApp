# End-to-end messaging latency

## Measured results

All **120 of 120** measured messages completed the send, delivery, and read receipt flow across three local trials. The table pools all three trials.

| Metric | p50 | p95 | p99 | Max | p95 below 100 ms |
|---|---:|---:|---:|---:|:---:|
| Send acknowledgement | 18.81 ms | 29.27 ms | 52.56 ms | 132.07 ms | Yes |
| Socket.IO delivery | 17.72 ms | 27.76 ms | 51.97 ms | 128.82 ms | Yes |
| Read receipt | 6.10 ms | 8.64 ms | 35.13 ms | 95.58 ms | Yes |
| Full send-to-read loop | 23.57 ms | 38.47 ms | 62.96 ms | 224.48 ms | Yes |

All three requested paths were below 100 ms at p95 in each individual trial. Individual samples exceeded 100 ms for sending, delivery, and the full loop. The API came from revision `0ef3bfc`, using Node.js 22.23.5, MongoDB 8.0.38, and Redis 8.4.8 on Docker Desktop on an arm64 Mac. [Raw per-trial and per-message samples](evidence/realtime-latency.json)

**Resume wording:** Measured **29.3 ms p95 send acknowledgement, 27.8 ms Socket.IO delivery, and 8.6 ms read-receipt latency** over 120 paced local messages on a Redis-backed Express replica.

The benchmark sends actual HTTP requests and observes actual Socket.IO WebSocket events using two authenticated clients. Both clients use the same API replica. Redis quotas are enabled, and the opt-in Kafka moderation path and repeat rule are disabled. The client sends a read request as soon as it receives the message.

## What is timed

All timestamps come from one monotonic clock in the test client.

| Metric | Start | Stop |
|---|---|---|
| Send acknowledgement | Sender starts HTTP POST | Sender has received and parsed the HTTP 201 response |
| Socket.IO delivery | Sender starts HTTP POST | Recipient receives matching `newMessage` |
| Read receipt | Recipient starts HTTP PATCH | Sender receives matching `messagesRead` |
| Full send-to-read loop | Sender starts HTTP POST | Sender receives matching `messagesRead` |

The harness verifies the same message ID across the HTTP response, recipient event, read response, and sender receipt. Each trial uses fresh accounts, a warm-up transaction, and 40 sequential measured messages. The harness waits 1.1 seconds between samples to stay within the app's existing quotas. It measures an immediate scripted read on loopback, excluding login, socket setup, human reading time, and browser rendering. These results cover same-replica delivery under normal paced load.

## Reproduce

From the repository root, with Docker Compose running and port 5101 available:

```bash
npm ci
FRENSCHAT_IMAGE_TAG=realtime-latency FRENSCHAT_REDIS_URL=redis://redis:6379 MESSAGE_REPEAT_LIMIT= \
  docker compose -p frenschat-realtime-latency up --build --wait api-a
node scripts/realtime-latency.mjs
docker compose -p frenschat-realtime-latency stop
```

The harness prints trial summaries to stderr and raw samples with nearest-rank percentiles to stdout. It fails on an HTTP error, socket timeout, or message ID mismatch.
