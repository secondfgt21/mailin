create table if not exists public.users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  mail_password_encrypted text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.emails (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  mail_uid bigint not null,
  message_id text,
  from_name text,
  from_email text,
  subject text,
  body_text text,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, mail_uid)
);

create index if not exists idx_emails_user_id_received_at
  on public.emails (user_id, received_at desc);

create index if not exists idx_users_email
  on public.users (email);
