# Day 2 · Repeat-message enforcement

The optional `MESSAGE_REPEAT_LIMIT=2` demo policy allows two matching sends in a 10-second observation window. The next matching send starts a 10-second cooldown for that sender and fingerprint. Other messages can still use the sender's global quota. Both policies execute in one Lua script. Fingerprints use keyed HMAC over normalized text, and Redis stores counters and expiry times rather than message content. Replicas must share policy settings and the signing secret.

On the two-replica Docker demo, the quota-only run again admitted 10 of 50 concurrent attempts and persisted those 10. With the repeat rule enabled, 8 of 8 synthetic repeat attempts after the threshold were blocked across two replicas and recipients, while all 5 distinct messages were accepted. The recipient saw exactly 3 expected same-node Socket.IO events before rollover. Sending the fingerprint after cooldown succeeded. These results describe the labeled demo cases.

```bash
docker compose -p frenschat-day2 up --build --wait
npm run test:quota -- redis
MESSAGE_REPEAT_LIMIT=2 docker compose -p frenschat-day2 up -d --wait
npm run test:quota -- repeat
docker compose -p frenschat-day2 stop
```
