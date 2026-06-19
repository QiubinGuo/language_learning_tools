# Thai Life Helper beta deployment

Recommended stack:

- Frontend and API: Vercel
- Auth and database: Supabase
- AI phrase completion: OpenAI API
- Speech: browser TTS for the first beta

## Vercel

Deploy the `french-trainer` folder.

Environment variables:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`OPENAI_API_KEY` must stay server-side. Do not add it to client code.

## Supabase

1. Create a Supabase project.
2. Enable email/password Auth.
3. Run the SQL in `SUPABASE_SETUP.md`.
4. Copy the Project URL and anon key into Vercel environment variables.

## Beta sharing

For a small test group:

- Keep email/password registration enabled.
- Share the Vercel URL with testers.
- Ask testers to create accounts with email and password.
- User phrase data will sync to `user_phrases` with row-level security.

## Cost control

The app only calls OpenAI when local phrase search or Thai import cannot match existing phrase data. Browser speech remains free.
