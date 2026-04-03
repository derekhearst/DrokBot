# DrokBot

Self-hosted autonomous AI agent platform with persistent memory, tool use, and mobile-ready chat.

## Feature Overview

### Chat and Tooling

DrokBot provides a streaming chat interface where the assistant can call tools such as web search and sandboxed code execution. Chat supports editing and branching, per-message performance and cost metrics, and model selection.

### Agents and Tasks

You can create specialized agents, assign tasks, and review results in a branch-based code review flow. Task lifecycle is managed in a Kanban-style board with clear status transitions.

### Memory and Dream Cycles

The memory system stores, retrieves, and consolidates facts over time using PostgreSQL + pgvector. Periodic dream cycles merge duplicates, resolve contradictions, and prune stale knowledge.

## Tech Stack

- SvelteKit (Svelte 5, TypeScript)
- TailwindCSS v4 + DaisyUI
- PostgreSQL + pgvector
- Drizzle ORM + postgres.js
- OpenRouter SDK
- Playwright E2E
- Adapter Node + Docker (TrueNAS deployment target)

## Getting Started

1. Install dependencies:

```sh
bun install
```

2. Copy environment variables:

```sh
cp .env.example .env
```

3. Update `.env` values for your services:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `AUTH_PASSWORD`
- `SEARXNG_URL` and `SEARXNG_PASSWORD`
- `SANDBOX_URL`
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
- `ORIGIN`

4. Run the app:

```sh
bun run dev
```

5. Run checks/tests:

```sh
bun run check
bun run test:e2e
```

## Docs

- High-level contract: `docs/features.md`
- Full implementation plan: `docs/plan.md`

## Route Map

- `/` Dashboard
- `/login` Authentication
- `/chat` Conversations
- `/chat/[id]` Chat detail
- `/agents` Agent management
- `/tasks` Task board
- `/memory` Memory explorer
- `/settings` App configuration
