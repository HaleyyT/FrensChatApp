# Realtime Chat App (Full-stack) — In Progress

A full-stack chat application built to practice modern web development:
- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose

This project is currently in active development. The project structure and database connection are set up, and API routes are scaffolded. Authentication and realtime messaging are planned next.

---

## Tech Stack
- **React** (Vite)
- **JavaScript**
- **Node.js**, **Express**
- **MongoDB**, **Mongoose**

---

## Current Status
✅ Implemented / Set up:
- React (Vite) frontend scaffold
- Express backend scaffold with modular structure (routes/controllers)
- MongoDB connection via Mongoose
- Environment-variable based config (`MONGODB_URI`)

🚧 In progress:
- Authentication flows (signup/login/logout)
- Core REST endpoints and data models (User / Conversation / Message)

🧭 Planned:
- JWT auth + protected routes
- Socket.io real-time messaging + online presence
- Improved error handling and validation
- Deployment

---

## Project Structure (example)
```text
/
  backend/
    server.js
    routes/
    controllers/
    db/
  frontend/
    src/
    vite.config.js
