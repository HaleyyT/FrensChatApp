# Release Checklist

This checklist is for taking Alpine Chat to production with the backend deployed on Render and the frontend deployed on Vercel.

## Local Verification Before Release

1. Confirm your branch is current and your worktree is clean enough to release.

```bash
git status --short
git fetch origin
git branch --show-current
```

2. Install dependencies if needed.

```bash
npm install
npm --prefix frontend install
```

3. Check backend dependency vulnerabilities.

```bash
npm audit --omit=dev
```

4. Verify the frontend lint pass.

```bash
npm --prefix frontend run lint
```

5. Verify the frontend production build.

```bash
npm --prefix frontend run build
```

6. Verify backend startup with production-like environment variables set locally.

```bash
npm start
```

Expected result:

- the backend starts without config validation errors
- MongoDB connects successfully
- the server binds to the configured port

7. Run the two-user release smoke test against localhost.

```bash
npm run smoke
```

Expected result:

- signup works for two generated users
- `/api/auth/me` works
- `/api/user/` loads sidebar data
- one user can send a message to the other
- the receiver can load the conversation and mark the message as read
- both users can log out cleanly

The smoke test first checks `GET /healthz`, then runs the authenticated two-user flow. Requests time out after 15 seconds by default, making an unreachable or sleeping backend easier to distinguish from an application failure.

## Pre-Deploy Environment Checks

### Render backend

Confirm these environment variables are set correctly:

- `PORT`
- `NODE_ENV=production`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Confirm `CLIENT_URL` matches the actual deployed Vercel origin exactly.

### Vercel frontend

Confirm these environment variables are set correctly:

- `VITE_API_BASE_URL`
- `VITE_SOCKET_SERVER_URL`

Confirm both point to the deployed Render backend, not localhost.

## Deploy Order

1. Deploy the backend to Render first.
2. Wait for the backend health/startup logs to settle.
3. Deploy the frontend to Vercel.
4. Verify both deployments with the post-deploy smoke steps below.

Backend-first deploy order reduces auth and API mismatch risk while the frontend is updating.

## Post-Deploy Verification

1. Open the deployed frontend and confirm the login/signup screen renders correctly.
2. Run the release smoke test against the deployed backend API.

Example:

```bash
SMOKE_API_BASE_URL=https://your-backend-host.com/api npm run smoke
```

To use a longer timeout for a cold-starting service, set `SMOKE_REQUEST_TIMEOUT_MS` explicitly:

```bash
SMOKE_API_BASE_URL=https://your-backend-host.com/api SMOKE_REQUEST_TIMEOUT_MS=30000 npm run smoke
```

The API base URL must end in `/api`; the script derives and checks the backend readiness URL at `/healthz` before creating smoke-test accounts.

3. Manually confirm the browser can:

- sign up
- log in
- load the sidebar
- open a conversation
- send a message
- receive a message in another browser window or incognito session
- log out

4. Confirm cookies are being set correctly in the browser for production auth.
5. Confirm the browser console is free of CORS, socket, or auth errors.

## Production Troubleshooting

### The frontend shows a backend configuration or timeout error

1. Confirm both Vercel variables are present and point to the deployed backend:
   - `VITE_API_BASE_URL=https://your-backend-host.com/api`
   - `VITE_SOCKET_SERVER_URL=https://your-backend-host.com`
2. Confirm the backend is ready directly:

```bash
curl -i https://your-backend-host.com/healthz
```

Expected result: `200` with `{ "status": "ok" }`.

During startup or graceful shutdown, the endpoint intentionally returns `503` with `{ "status": "unavailable" }`; wait for the service to become ready before running the smoke test.

3. Run the deployed smoke test. Its timeout or endpoint-specific failure will identify whether the issue is readiness, authentication, or a later API operation.
4. For a failed API response, capture the `x-request-id` response header or `error.requestId` response field and find the matching structured backend log entry. Do not share auth cookies or request bodies in support logs.

### Login works but presence or typing does not

1. Confirm `VITE_SOCKET_SERVER_URL` uses the backend origin without `/api`.
2. Check backend logs for `socket_connection_rejected`, `socket_connected`, or `socket_error` events.
3. Confirm `CLIENT_URL` matches the deployed frontend origin exactly, including its protocol.

## Rollback Checklist

Use this when a release breaks login, sidebar loading, cookies, message delivery, or socket connectivity.

1. Identify the last known-good commit.

```bash
git log --oneline
```

2. Redeploy the backend on Render to the last known-good commit first.
3. Redeploy the frontend on Vercel to the matching last known-good commit.
4. Verify the backend directly before relying on the frontend:

```bash
curl -i https://your-backend-host.com/api/auth/me
curl -i https://your-backend-host.com/api/user/
```

Expected result:

- `/api/auth/me` should return `401` when unauthenticated rather than `500`
- `/api/user/` should also return a protected-route response rather than a server error

5. Verify Socket.IO connectivity from the frontend after the rollback by loading the app and confirming presence/messages recover.
6. If auth behavior still looks wrong in the browser, clear site data before re-testing:

- Chrome: DevTools -> Application -> Storage -> Clear site data
- Or remove cookies/storage for both the Vercel frontend origin and the Render backend origin

7. Repeat the smoke test against the rolled-back deployment:

```bash
SMOKE_API_BASE_URL=https://your-backend-host.com/api npm run smoke
```

8. Record:

- bad release commit
- rollback target commit
- symptoms observed
- commands/checks used to confirm recovery
