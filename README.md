# Snail Racing

A snail racing betting dashboard with a mock payment gateway.

## Prerequisites

- Node 22 (see `.nvmrc`)
- npm 10+

## Quick start

```sh
npm install
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Run client and server in watch mode  |
| `npm run build`     | Build both workspaces                |
| `npm test`          | Run all tests                        |
| `npm run lint`      | Run ESLint and check Prettier format |
| `npm run typecheck` | Type-check both workspaces           |
| `npm run format`    | Format the repo with Prettier        |

## Project layout

- `client/` - React + Vite frontend
- `server/` - Express API
