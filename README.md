# Commemorate Desktop

Electron desktop client for the Commemorate application.

## Prerequisites

- Node.js 18+
- Go server running at `http://localhost:8080` (see `../server/README.md`)

## Development

Start the API server first:

```bash
cd ../server
go run ./cmd/server
```

Then start the desktop app:

```bash
npm install
npm run dev
```

## Login

Use the default application account seeded by the server:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Canoe@2026` |

The renderer talks to the server only through the Electron main process IPC (`window.api.auth`).

## API URL

Override with environment variable when starting Electron:

```bash
COMMEMORATE_API_URL=http://localhost:8080 npm run dev
```
