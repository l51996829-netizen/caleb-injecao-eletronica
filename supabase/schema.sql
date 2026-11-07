-- Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text default '',
 price numeric(12,2) not null check(price > 0),
 stock integer not null default 0 check(stock >= 0),
 image_url text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 customer_name text not null,
 email text not null,
 phone text default '',
 address text default '',
 items jsonb not null,
 total numeric(12,2) not null,
 status text not null default 'pending' check(status in ('pending','paid','cancelled')),
 asaas_payment_id text,
 order_access_token text not null,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create table if not exists public.admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.admins enable row level security;

-- Função para reconhecer usuário administrador
create or replace function public.is_caleb_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admins where user_id=auth.uid()); $$;

create policy "Produtos ativos visíveis publicamente" on public.products
 for select using (active=true or public.is_caleb_admin());
create policy "Admins gerenciam produtos" on public.products
 for all using (public.is_caleb_admin()) with check (public.is_caleb_admin());
create policy "Admins veem pedidos" on public.orders
 for select using (public.is_caleb_admin());
create policy "Admins atualizam pedidos" on public.orders
 for update using (public.is_caleb_admin()) with check (public.is_caleb_admin());
create policy "Admins veem lista de admins" on public.admins
 for select using (auth.uid()=user_id);

-- O backend usa service_role para criar pedidos; a chave nunca vai ao navegador.
