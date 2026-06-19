# Supabase setup

Run this SQL in the Supabase SQL editor before opening testing to other users.

```sql
create table if not exists public.user_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  phrase_key text not null,
  thai text not null,
  romanization text not null,
  chinese text not null,
  in_library boolean not null default true,
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phrase_key)
);

alter table public.user_phrases enable row level security;

create policy "Users can read their phrases"
on public.user_phrases
for select
using (auth.uid() = user_id);

create policy "Users can insert their phrases"
on public.user_phrases
for insert
with check (auth.uid() = user_id);

create policy "Users can update their phrases"
on public.user_phrases
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their phrases"
on public.user_phrases
for delete
using (auth.uid() = user_id);
```

Pronunciation correction setup:

```sql
create table if not exists public.pronunciation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  user_email text,
  sentence text not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'done')),
  feedback_text text not null default '',
  audio_url text,
  audio_path text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.pronunciation_requests enable row level security;

create policy "Users can create pronunciation requests"
on public.pronunciation_requests
for insert
with check (auth.uid() = user_id);

create policy "Users can read their pronunciation requests"
on public.pronunciation_requests
for select
using (auth.uid() = user_id or auth.jwt() ->> 'email' = 'admin@example.com');

create policy "Admin can update pronunciation requests"
on public.pronunciation_requests
for update
using (auth.jwt() ->> 'email' = 'admin@example.com')
with check (auth.jwt() ->> 'email' = 'admin@example.com');

insert into storage.buckets (id, name, public)
values ('pronunciation-feedback', 'pronunciation-feedback', true)
on conflict (id) do update set public = true;

create policy "Admin can upload pronunciation feedback"
on storage.objects
for insert
with check (bucket_id = 'pronunciation-feedback' and auth.jwt() ->> 'email' = 'admin@example.com');

create policy "Admin can update pronunciation feedback"
on storage.objects
for update
using (bucket_id = 'pronunciation-feedback' and auth.jwt() ->> 'email' = 'admin@example.com')
with check (bucket_id = 'pronunciation-feedback' and auth.jwt() ->> 'email' = 'admin@example.com');

create policy "Anyone can listen to pronunciation feedback"
on storage.objects
for select
using (bucket_id = 'pronunciation-feedback');
```

Environment variables:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_REDIRECT_URL=https://french-trainer-amber.vercel.app
```

Deployment notes:

- Put `OPENAI_API_KEY` only in the hosting provider's server-side environment variables.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are safe to expose to the browser when Row Level Security is enabled.
- In Supabase, set Authentication -> URL Configuration -> Site URL to `https://french-trainer-amber.vercel.app`, and add the same URL to Redirect URLs. Otherwise confirmation emails may point to `localhost`.
- The admin page is `/admin`. Only `admin@example.com` can read all pronunciation requests and upload feedback audio.
- For a small closed beta, keep Supabase email/password auth enabled and invite testers by email.
