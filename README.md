# DiscoPod

DiscoPod turns podcast discovery into a visual globe of audio snippets with
AI-assisted ingestion, vector search, and creator claim workflows.

## Stack

- React + TypeScript + React Router 7 + Vite
- Tailwind CSS + React Three Fiber
- Convex backend (schema, queries, mutations, actions, HTTP webhook route)
- Firecrawl + OpenAI + AgentMail integrations via Convex actions

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start Convex development (first run will authenticate and generate
   `convex/_generated/*` files):

```bash
npx convex dev
```

3. In a second terminal, run the web app:

```bash
npm run dev
```

## Environment variables

Create `.env.local` with:

- `VITE_CONVEX_URL`
- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `AGENTMAIL_API_KEY`
- `AGENTMAIL_WEBHOOK_SECRET`

Never commit real secrets.

## License

Copyright (c) 2026 Kurt Libby. All rights reserved.

This repository and source code are made publicly visible solely for demonstration, evaluation, and judging purposes for the Convex Hackathon. No license or authorization is granted for reuse, redistribution, modification, sublicensing, or commercialization without prior written permission.

