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

4. Run database migration
```bash
    supabase migration up
```

5. Run the app in the `web` directory.
```bash
    npm run dev
```

The app is available on http://localhost:3000/


## Environment variables
**NEXT_PUBLIC_SUPABASE_URL** - Your Supabase project URL \
**GEMINI_API_KEY** - API key for Google Gemini LLM \
**NEXT_PUBLIC_SUPABASE_ANON_KEY** - Supabase anonymous/public key \
**SUPABASE_SERVICE_ROLE_KEY** - Secret admin key for Supabase \
**NODE_ENV** - Environment mode: development, production
