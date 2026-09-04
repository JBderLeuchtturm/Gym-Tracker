-- ============================================================================
--  Gym Tracker - Datenbankschema fuer Supabase
--  Einmal komplett im SQL-Editor des Supabase-Projekts ausfuehren.
--  Das Skript ist wiederholbar: ein zweiter Durchlauf aendert nichts.
-- ============================================================================

-- ---------------------------------------------------------------- Tabellen

-- Oeffentlich sichtbarer Teil eines Kontos. Enthaelt bewusst keine Koerper-
-- oder Trainingsdaten - nur, was zum Finden und Anzeigen von Freunden noetig ist.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text not null unique
               check (handle ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  display_name text not null default '',
  emoji        text not null default '💪',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Der vollstaendige App-Zustand fuer die Synchronisierung zwischen Geraeten.
-- Streng privat: niemand ausser dem Konto selbst kommt hier heran.
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Freundschaften. Eine Zeile je Paar; wer angefragt hat, steht in requester.
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- Verhindert doppelte Anfragen in beide Richtungen.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- Die geteilten Auswertungen, getrennt nach Bereich. Bewusst abgeleitete,
-- kompakte Daten - nicht der rohe Trainingszustand.
create table if not exists public.share_payloads (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  scope      text not null check (scope in ('progress', 'weight', 'nutrition')),
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, scope)
);

-- Freigaben: je Freund und Bereich eine Zeile. Existiert die Zeile nicht,
-- ist der Bereich fuer diesen Freund nicht sichtbar.
create table if not exists public.share_grants (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  scope      text not null check (scope in ('progress', 'weight', 'nutrition')),
  created_at timestamptz not null default now(),
  primary key (owner_id, viewer_id, scope)
);

create index if not exists share_grants_viewer_idx on public.share_grants (viewer_id);

-- ------------------------------------------------------------ Hilfsfunktionen

-- Besteht eine angenommene Freundschaft zwischen zwei Konten?
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Besteht irgendeine Verbindung (auch eine offene Anfrage)?
create or replace function public.has_link(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester_id = a and f.addressee_id = b)
       or (f.requester_id = b and f.addressee_id = a)
  );
$$;

-- Suche nach exaktem Benutzernamen. Als security definer, damit niemand die
-- gesamte Nutzerliste durchblaettern kann - es geht nur der gezielte Treffer.
create or replace function public.find_profile_by_handle(p_handle text)
returns table (id uuid, handle text, display_name text, emoji text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name, p.emoji
  from public.profiles p
  where p.handle = lower(trim(p_handle))
    and p.id <> auth.uid()
  limit 1;
$$;

-- Beim Annehmen einer Freundschaft bekommen beide Seiten automatisch die
-- Grundfreigabe "Fortschritt". Alles Weitere gibt man bewusst frei.
create or replace function public.grant_default_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and coalesce(old.status, '') <> 'accepted' then
    insert into public.share_grants (owner_id, viewer_id, scope)
    values (new.requester_id, new.addressee_id, 'progress'),
           (new.addressee_id, new.requester_id, 'progress')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_grant_defaults on public.friendships;
create trigger friendships_grant_defaults
  after update on public.friendships
  for each row execute function public.grant_default_shares();

-- Wird eine Freundschaft geloest, verschwinden auch alle Freigaben dazu.
create or replace function public.revoke_shares_on_unfriend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.share_grants
  where (owner_id = old.requester_id and viewer_id = old.addressee_id)
     or (owner_id = old.addressee_id and viewer_id = old.requester_id);
  return old;
end;
$$;

drop trigger if exists friendships_revoke_shares on public.friendships;
create trigger friendships_revoke_shares
  after delete on public.friendships
  for each row execute function public.revoke_shares_on_unfriend();

-- Beim Annehmen darf ausschliesslich der Status wandern. Ohne diese Sperre
-- koennte der Angefragte beim Annehmen den Absender austauschen und sich so
-- ungefragt mit einem Dritten verbinden.
create or replace function public.freeze_friendship_pair()
returns trigger
language plpgsql
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Die Beteiligten einer Freundschaft koennen nicht geaendert werden';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'Eine angenommene Freundschaft kann nur geloescht werden';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_freeze_pair on public.friendships;
create trigger friendships_freeze_pair
  before update on public.friendships
  for each row execute function public.freeze_friendship_pair();

-- ------------------------------------------------------- Zeilenschutz (RLS)

alter table public.profiles       enable row level security;
alter table public.user_state     enable row level security;
alter table public.friendships    enable row level security;
alter table public.share_payloads enable row level security;
alter table public.share_grants   enable row level security;

-- Profile: das eigene und die von Konten, mit denen eine Verbindung besteht.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_link(auth.uid(), id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Eigener Trainingszustand: ausschliesslich fuer das eigene Konto.
drop policy if exists user_state_all on public.user_state;
create policy user_state_all on public.user_state
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Freundschaften: sichtbar fuer beide Beteiligten.
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- Anfragen stellt man nur im eigenen Namen.
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

-- Annehmen darf nur, wer angefragt wurde.
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status = 'accepted');

-- Loeschen (ablehnen, zurueckziehen, entfreunden) darf jede Seite.
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- Geteilte Auswertungen: eigene immer, fremde nur mit Freigabe UND Freundschaft.
drop policy if exists share_payloads_select on public.share_payloads;
create policy share_payloads_select on public.share_payloads
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      public.are_friends(owner_id, auth.uid())
      and exists (
        select 1 from public.share_grants g
        where g.owner_id = share_payloads.owner_id
          and g.viewer_id = auth.uid()
          and g.scope = share_payloads.scope
      )
    )
  );

drop policy if exists share_payloads_write on public.share_payloads;
create policy share_payloads_write on public.share_payloads
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Freigaben: der Besitzer verwaltet sie, der Freund darf sehen, was er sehen darf.
drop policy if exists share_grants_select on public.share_grants;
create policy share_grants_select on public.share_grants
  for select to authenticated
  using (owner_id = auth.uid() or viewer_id = auth.uid());

drop policy if exists share_grants_write on public.share_grants;
create policy share_grants_write on public.share_grants
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.are_friends(owner_id, viewer_id));

-- ------------------------------------------------------------ Ausfuehrrechte

-- Die Hilfsfunktionen laufen mit erhoehten Rechten - deshalb bekommt sie nur,
-- wer angemeldet ist. Ohne Anmeldung ist an dieser Datenbank nichts zu holen.
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.has_link(uuid, uuid) from public, anon;
revoke execute on function public.find_profile_by_handle(text) from public, anon;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.has_link(uuid, uuid) to authenticated;
grant execute on function public.find_profile_by_handle(text) to authenticated;
