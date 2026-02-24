# Backend

This folder contains the Express/MongoDB backend for the MERN app.

Quick setup

1. Copy environment variables:

```bash
cp .env.example .env
# then edit .env and provide real secrets (do NOT commit .env)
```

2. Install dependencies:

```bash
cd backend
npm install
```

3. Run in development:

```bash
npm run dev
```

4. Run in production (example):

```bash
NODE_ENV=production FRONTEND_ORIGIN=https://your-frontend.example.com PORT=5000 npm start
```

Docker


Build and run the included `Dockerfile` (optional):

```bash
docker build -t mern-backend .
docker run --env-file .env -p 5000:5000 mern-backend
```

Render deployment notes

- This repository includes `render.yaml` — you can import it in Render or create a new Web Service.
- Do NOT commit secrets. Set the following environment variables in the Render Dashboard (Service → Environment → Environment Secrets):
	- `MONGO_URI` (required)
	- `JWT_SECRET` (required)
	- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (optional; used by `seedadmin.js`)
	- `EMAIL_USER` / `EMAIL_PASS` (only if you use email features)
	- `TRUST_PROXY=true` and `NODE_ENV=production` are recommended in production.

- Build Command: `npm install`
- Start Command: `npm start`

Socket.io

The server exposes socket.io on the same port as the Express app. When scaling to multiple instances on Render, configure a Redis adapter or use a single instance to maintain socket affinity.

