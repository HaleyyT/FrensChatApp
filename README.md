# Realtime Chat App (Full-stack) — In Progress

A full-stack chat application focused on building production-style authentication and a clean, scalable backend foundation for real-time messaging.

![Current workspace UI](docs/images/workspace-ui.png)

## Current Milestone 

Auth API is working end-to-end with:

- signup
- login
- logout
- hashed passwords
- JWT stored in `HttpOnly` cookies

## Stack

- Frontend: React (Vite), Tailwind CSS, daisyUI
- Backend: Node.js, Express
- Database: MongoDB Atlas, Mongoose
- Auth: JWT, bcryptjs, cookie-based sessions

## Why This Project

This project is built to practice real engineering skills:

- designing a modular Express backend
- implementing authentication in a secure, realistic way
- using environment configuration safely across development and production
- testing APIs with reproducible command-line requests
- building a polished frontend on top of a practical backend foundation

## Important Backend Implementations

- `backend/controllers/auth.controller.js`
  Handles signup, login, and logout logic.
- `backend/utils/generateToken.js`
  Creates the JWT and stores it in an `HttpOnly` cookie.
- `backend/middleWare/protectRoutes.js`
  Protects private routes by validating the JWT and attaching the authenticated user to the request.
- `backend/routes/auth.routes.js`
  Defines auth endpoints.
- `backend/routes/user.routes.js`
  Includes protected user-fetching logic for the chat sidebar.
- `backend/routes/message.routes.js`
  Includes protected message sending.
- `backend/controllers/message.controller.js`
  Creates messages and links them to conversations.
- `backend/models/user.models.js`
  Stores user account data.
- `backend/models/conversation.model.js`
  Stores chat participants and conversation message references.
- `backend/models/message.model.js`
  Stores individual chat messages.
- `backend/db/connectToMongoDB.js`
  Centralised database connection logic.

## Implemented Features

### Authentication

- Signup creates a user in MongoDB
- Login verifies credentials and authenticates the user
- Logout clears the authentication cookie immediately

### Security Measures

- Password hashing with `bcryptjs`
- JWT stored in cookies instead of `localStorage`
- `HttpOnly` cookie flag to reduce token theft through XSS
- `SameSite=Strict` cookie setting to help protect against CSRF in many cases
- `Secure` cookie flag enabled automatically outside development

### Backend Foundation

- Modular backend structure with routes, controllers, models, utilities, and middleware
- MongoDB connection through environment variables
- JSON request parsing enabled with `express.json()`
- Protected route middleware for authenticated requests
- Message and conversation models started for chat functionality

### Frontend Progress

- Cinematic dark workspace UI
- Matching luxury dark login screen
- Laptop-sized layout polished for real browser use

## API Endpoints

Base URL (local): `http://localhost:5000`

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account and set JWT cookie |
| POST | `/api/auth/login` | Login and set JWT cookie |
| POST | `/api/auth/logout` | Logout and clear JWT cookie |
| GET | `/api/users/` | Get users for sidebar (protected) |
| POST | `/api/message/send/:id` | Send message to a user by id (protected) |

## Project Structure

```text
backend/
  controllers/
    auth.controller.js
    message.controller.js
    user.controller.js
  db/
    connectToMongoDB.js
  middleWare/
    protectRoutes.js
  models/
    conversation.model.js
    message.model.js
    user.models.js
  routes/
    auth.routes.js
    message.routes.js
    user.routes.js
  utils/
    generateToken.js
  server.js

frontend/
  public/
  src/
    pages/
      home/
      login/
      signup/
    App.jsx
    index.css
    main.jsx
```

## Local Setup

### 1. Install dependencies

```bash
npm install
cd frontend
npm install
```

### 2. Create `.env` in the project root

```bash
# Local backend port
PORT=5000

# Frontend origin allowed to send cookie-based requests to the API
CLIENT_URL=http://localhost:5173

# Use "development" locally and "production" when deployed
NODE_ENV=development

# MongoDB connection string
MONGO_URI=your_mongodb_connection_string

# A long random secret used to sign JWT auth cookies
JWT_SECRET=your_secret
```

You can copy from `.env.example`.
Never commit your real `.env` file or paste live secrets into the repository.

### 3. Run the backend

```bash
npm run server
```

You should see logs like:

- `Connected to mongoDB`
- `Server running on port 5000`

### 4. Run the frontend

```bash
cd frontend
npm run dev
```

Frontend usually runs on `http://localhost:5173`

## How To Use / Test

### Signup

```bash
curl -i -X POST "http://localhost:5000/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"your-name","username":"you","password":"123456","confirmPassword":"123456","gender":"female"}'
```

Look for:

- `HTTP/1.1 201 Created`
- `Set-Cookie: jwt=...; HttpOnly; SameSite=Strict; ...`

### Login

```bash
curl -i -c cookies.txt -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"you","password":"123456"}'
```

### Logout

```bash
curl -i -b cookies.txt -c cookies.txt -X POST "http://localhost:5000/api/auth/logout"
```

Look for:

- `Set-Cookie: jwt=; Max-Age=0; ...`
- `{"message":"Logged out successfully"}`

## Current Status

### Done

- Backend and DB connection
- User model
- Auth routes and controllers
- Signup, login, and logout working
- JWT cookie auth utility
- Password hashing
- Protected route middleware
- Sidebar user fetching
- Message sending foundation
- Polished workspace and login UI

### In Progress

- Connecting the frontend UI to live backend actions
- Improving mobile-specific layout and spacing
- Building out conversation and message flows

### Planned

- Full conversation history
- Socket.io real-time messaging
- Online presence and typing indicators
- Pagination for chat history
- Better validation and error states
- Deployment

## Notes (Security + Dev Environment)

- In development on localhost, cookies may show `Secure=false` depending on config.
- In production, `Secure` should be enabled so cookies are only sent over HTTPS.
- JWT is intentionally stored in cookies instead of `localStorage`.
- Protected routes depend on the auth cookie being sent with the request.
