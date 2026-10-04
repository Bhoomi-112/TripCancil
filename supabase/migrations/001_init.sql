create type public.location_type as enum (
  'beach',
  'mountain',
  'city',
  'forest',
  'desert',
  'heritage',
  'snow',
  'roadtrip'
);

create type public.member_role as enum ('owner', 'member');

create type public.place_status as enum ('proposed', 'locked');

create type public.document_type as enum (
  'ticket',
  'hotel',
  'id',
  'insurance',
  'other'
);

create type public.packing_category as enum (
  'clothes',
  'gear',
  'toiletries',
  'docs',
  'snacks',
  'other'
);

create type public.expense_category as enum (
  'food',
  'stay',
  'transport',
  'activities',
  'shopping',
  'other'
);

create type public.photo_kind as enum ('original', 'booth');

create type public.settlement_status as enum ('pending', 'paid', 'confirmed');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  destination text not null check (char_length(btrim(destination)) between 1 and 120),
  start_date date not null,
  end_date date not null,
  location_type public.location_type not null default 'city',
  cover_url text,
  invite_code text not null unique check (char_length(invite_code) >= 10),
  base_currency text not null default 'INR' check (char_length(base_currency) = 3),
  owner_member_id uuid,
  created_at timestamptz not null default now(),
  constraint trips_end_after_start check (end_date >= start_date)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  pin_hash text not null,
  role public.member_role not null default 'member',
  payment_qr_path text,
  upi_id text check (upi_id is null or char_length(btrim(upi_id)) between 3 and 80),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  constraint members_display_name_unique_per_trip unique (trip_id, display_name)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category text check (category is null or char_length(btrim(category)) between 1 and 40),
  location_type public.location_type,
  proposed_by uuid references public.members(id) on delete set null,
  status public.place_status not null default 'proposed',
  created_at timestamptz not null default now()
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_index integer not null check (day_index >= 0),
  position integer not null default 0 check (position >= 0),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  start_time time,
  place_id uuid references public.places(id) on delete set null,
  notes text,
  location_type public.location_type,
  created_at timestamptz not null default now()
);

create table public.place_votes (
  place_id uuid not null references public.places(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (place_id, member_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploader_id uuid not null references public.members(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  type public.document_type not null default 'other',
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 512),
  itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category public.packing_category not null default 'other',
  is_shared boolean not null default true,
  assigned_to uuid references public.members(id) on delete set null,
  checked boolean not null default false,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.budgets (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  total_paise bigint not null default 0 check (total_paise >= 0),
  category_caps jsonb not null default '{}'::jsonb,
  constraint budgets_category_caps_is_object check (jsonb_typeof(category_caps) = 'object')
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payer_id uuid not null references public.members(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  category public.expense_category not null default 'other',
  note text,
  spent_on date not null,
  receipt_path text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  share_paise bigint not null check (share_paise >= 0),
  primary key (expense_id, member_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member uuid not null references public.members(id) on delete cascade,
  to_member uuid not null references public.members(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  status public.settlement_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint settlements_members_differ check (from_member <> to_member)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploader_id uuid not null references public.members(id) on delete cascade,
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 512),
  kind public.photo_kind not null default 'original',
  day_index integer check (day_index is null or day_index >= 0),
  place_id uuid references public.places(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.login_attempts (
  id bigint generated always as identity primary key,
  ip text not null check (char_length(btrim(ip)) between 1 and 64),
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.trips
  add constraint trips_owner_member_id_fkey
  foreign key (owner_member_id) references public.members(id) on delete set null;

create index members_trip_id_idx on public.members (trip_id);
create index places_trip_id_idx on public.places (trip_id);
create index places_proposed_by_idx on public.places (proposed_by) where proposed_by is not null;
create index itinerary_items_trip_day_position_idx on public.itinerary_items (trip_id, day_index, position);
create index itinerary_items_place_id_idx on public.itinerary_items (place_id) where place_id is not null;
create index place_votes_member_id_idx on public.place_votes (member_id);
create index documents_trip_id_idx on public.documents (trip_id);
create index documents_uploader_id_idx on public.documents (uploader_id);
create index packing_items_trip_id_idx on public.packing_items (trip_id);
create index packing_items_assigned_to_idx on public.packing_items (assigned_to) where assigned_to is not null;
create index expenses_trip_id_spent_on_idx on public.expenses (trip_id, spent_on desc);
create index expenses_payer_id_idx on public.expenses (payer_id);
create index expense_splits_member_id_idx on public.expense_splits (member_id);
create index settlements_trip_id_idx on public.settlements (trip_id);
create index settlements_from_member_idx on public.settlements (from_member);
create index settlements_to_member_idx on public.settlements (to_member);
create index photos_trip_id_idx on public.photos (trip_id);
create index photos_public_idx on public.photos (trip_id, created_at desc) where is_public;
create index login_attempts_ip_created_at_idx on public.login_attempts (ip, created_at desc);
create index login_attempts_member_id_created_at_idx on public.login_attempts (member_id, created_at desc);

alter table public.trips enable row level security;
alter table public.members enable row level security;
alter table public.places enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.place_votes enable row level security;
alter table public.documents enable row level security;
alter table public.packing_items enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.photos enable row level security;
alter table public.login_attempts enable row level security;

revoke create on schema public from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'documents',
    'documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'receipts',
    'receipts',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'payment-qrs',
    'payment-qrs',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'photos',
    'photos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
