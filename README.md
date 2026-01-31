# Realtime Chat App (Full-stack) — In Progress

A full-stack chat application focused on building **production-style authentication** and a clean, scalable backend foundation for real-time messaging.

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas + Mongoose

> Current milestone: **Auth API working end-to-end** (signup/login/logout) with **hashed passwords** and **JWT stored in HttpOnly cookies**.

---

## Why this project (Engineering focus)

This project is built to practice real workplace skills:
- Designing a modular Express backend (routes/controllers/models/utils)
- Implementing authentication in a secure, realistic way (cookie-based JWT)
- Using environment configuration for safe local vs production behavior
- Testing APIs with reproducible command-line requests (curl)

---

## Tech Stack

**Backend**
- Node.js, Express
- MongoDB Atlas, Mongoose
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Environment config (`dotenv`)

**Frontend**
- React (Vite)

---

## Implemented Features

### ✅ Authentication (API)
- **Signup**: creates a user in MongoDB (with validations)
- **Login**: verifies credentials and authenticates user
- **Logout**: clears authentication cookie immediately

### ✅ Security Measures (already implemented)
- **Password hashing** with bcrypt (no plaintext storage)
- **JWT stored in cookies** (not localStorage)
- Cookie flags:
  - `HttpOnly` (reduces XSS token theft risk)
  - `SameSite=Strict` (helps against CSRF in many cases)
  - `Secure` enabled automatically outside development (`NODE_ENV`)

### ✅ Backend foundation
- Modular structure: `routes/`, `controllers/`, `models/`, `db/`, `utils/`
- MongoDB connection via env (`MONGODB_URI`)
- JSON request parsing enabled (`express.json()`)

---

## API Endpoints

Base URL (local): `http://localhost:5000`

| Method | Route | Description |
|-------|-------|-------------|
| POST | `/api/auth/signup` | Create account + set JWT cookie |
| POST | `/api/auth/login` | Login + set JWT cookie |
| POST | `/api/auth/logout` | Logout + clear JWT cookie |

---

## Project Structure (example)
```text
/
  backend/
    server.js
    db/
      connectToMongoDB.js
    models/
      user.models.js
    routes/
      auth.routes.js
    controllers/
      auth.controller.js
    utils/
      generateToken.js
  frontend/
    src/
```

## Local Setup
1) Install dependencies
```bash
npm install
```

2) Configure environment variables

Create backend/.env:
```bash
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
NODE_ENV=development
PORT=5000
```

3) Run the backend
```bash
npm run server
```


You should see logs like:

- Connected to mongoDB
- Server running on port 5000

## Testing with curl (Reproducible)

### Signup (creates user + sets cookie)
```bash
curl -i -X POST "http://localhost:5000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"your-name","username":"you","password":"123456","confirmPassword":"123456","gender":"female"}'
  
```

✅ Look for:

HTTP/1.1 201 Created

Set-Cookie: jwt=...; HttpOnly; SameSite=Strict; ...


### Login (sets cookie again)
```bash
curl -i -c cookies.txt -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"you","password":"123456"}'
```


### Logout (clears cookie immediately)
```bash
curl -i -b cookies.txt -c cookies.txt -X POST "http://localhost:5000/api/auth/logout"
```

✅ Look for:

Set-Cookie: jwt=; Max-Age=0; ...

Response: {"message":"Logged out successfully"}



## Current Status

### ✅ Done

- Backend + DB connection

- User model (MongoDB)

- Auth routes + controllers

- Signup/login/logout working

- JWT cookie auth utility

- Password hashing

- curl-based endpoint verification


### 🚧 In Progress

- Profile picture logic polish

- Input validation hardening (stronger schema-level validation)

- Auth middleware + protected routes (/me)


### 🧭 Planned (next milestones)

- Conversations + Messages models

- Socket.io real-time messaging

- Online presence + typing indicators

- Pagination for chat history

- Tests (integration tests for auth + message endpoints)

- Deployment


### Notes (Security + dev environment)

- In development (localhost), cookies may show Secure=false depending on config.

- In production, Secure should be enabled so cookies are only sent over HTTPS.