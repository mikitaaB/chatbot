# chatbot

ChatGPT-like chatbot interface with Gemini LLM support, real-time streaming, image/document uploads, and persistent chat history. Includes auth with limited anonymous access (3 question).

## Tech stack
- **Client-side:** Next.js; Tanstack Query
- **UI:** Shadcn and Tailwind
- **Server-side:** Next.JS REST API
- **Database:** Postgres via Supabase
- **Auth:** Supabase
- **Realtime updates:** Supabase Realtime
- **Deployment:** Vercel

## Prerequisites

- **Node.js**
- **Docker**

## How to run locally

1. Install dependencies
```bash
    cd web
    npm install
```
2. Set up environment variables \
Create `.env.local` according to `.env.example` in the `web` directory.
```bash
    cp .env.example .env.local
```

3. Start supabase locally in the root directory.
```bash
    cd ..
    supabase start
```

4. Generate Prisma Client
```bash
    cd web
    npx prisma generate
```

5. Run database migration
```bash
    npm run db:deploy
```

6. Run the app in the `web` directory.
```bash
    npm run dev
```

The app is available on http://localhost:3000/