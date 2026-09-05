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

/*
 * Bremse gegen das Zuschuetten mit Anfragen.
 *
 * Wer einen Benutzernamen kennt, konnte bisher beliebig oft anfragen. Der
 * Zaehler laeuft ueber eine Stunde und ist bewusst grosszuegig - wer nach
 * einem Trainingsabend zehn Leute hinzufuegt, soll nicht ausgebremst werden.
 * Er greift beim Anlegen, nicht beim Annehmen oder Ablehnen.
 */
create or replace function public.limit_friend_requests()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent integer;
begin
  select count(*) into recent
  from public.friendships
  where requester_id = new.requester_id
    and created_at > now() - interval '1 hour';

  if recent >= 30 then
    raise exception 'Zu viele Anfragen in kurzer Zeit. Versuch es spaeter noch einmal.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists friendships_rate_limit on public.friendships;
create trigger friendships_rate_limit
  before insert on public.friendships
  for each row execute function public.limit_friend_requests();

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

-- ------------------------------------------------------- Push-Nachrichten

/*
 * Ein Eintrag je Geraet. Die Adresse kommt vom Push-Dienst des Browsers.
 * Gespeichert wird nur, wohin geschickt werden darf - keine Inhalte.
 *
 * Lesen darf niemand ausser dem Besitzer; verschickt wird ausschliesslich aus
 * der Edge Function heraus, die mit dem Service-Role-Schluessel laeuft und
 * damit an den Zeilenregeln vorbeikommt.
 */
create table if not exists public.push_subscriptions (
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null,
  p256dh     text not null default '',
  auth       text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------ Ausfuehrrechte

-- Die Hilfsfunktionen laufen mit erhoehten Rechten - deshalb bekommt sie nur,
-- wer angemeldet ist. Ohne Anmeldung ist an dieser Datenbank nichts zu holen.
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.has_link(uuid, uuid) from public, anon;
revoke execute on function public.find_profile_by_handle(text) from public, anon;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.has_link(uuid, uuid) to authenticated;
grant execute on function public.find_profile_by_handle(text) to authenticated;

-- ============================================================================
--  Erweiterung: Gruppen, Challenges, Reaktionen und Kommentare
-- ============================================================================

-- ---------------------------------------------------------------- Gruppen

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 2 and 60),
  emoji      text not null default '👥',
  owner_id   uuid not null references auth.users (id) on delete cascade,
  -- Kurzer Code zum Beitreten; wird beim Anlegen vergeben.
  join_code  text not null unique check (join_code ~ '^[a-z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- ------------------------------------------------------------- Challenges

create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(trim(title)) between 2 and 80),
  -- Woran gemessen wird.
  metric     text not null check (metric in ('workouts', 'sets', 'volume')),
  starts_on  date not null,
  ends_on    date not null,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  group_id   uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index if not exists challenge_members_user_idx on public.challenge_members (user_id);

-- --------------------------------------------- Reaktionen und Kommentare

-- Beides bezieht sich auf einen Trainingstag einer Person.
create table if not exists public.activity_reactions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  author_id     uuid not null references auth.users (id) on delete cascade,
  emoji         text not null check (char_length(emoji) between 1 and 8),
  created_at    timestamptz not null default now(),
  unique (owner_id, activity_date, author_id, emoji)
);

create table if not exists public.activity_comments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  author_id     uuid not null references auth.users (id) on delete cascade,
  body          text not null check (char_length(trim(body)) between 1 and 500),
  created_at    timestamptz not null default now()
);

create index if not exists activity_reactions_owner_idx on public.activity_reactions (owner_id, activity_date);
create index if not exists activity_comments_owner_idx on public.activity_comments (owner_id, activity_date);

-- --------------------------------------------------------- Hilfsfunktionen

-- Sind zwei Konten in mindestens einer gemeinsamen Gruppe?
create or replace function public.share_group(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members ma
    join public.group_members mb on ma.group_id = mb.group_id
    where ma.user_id = a and mb.user_id = b and a <> b
  );
$$;

-- Verbunden heisst: befreundet oder in derselben Gruppe.
create or replace function public.are_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.are_friends(a, b) or public.share_group(a, b);
$$;

-- Gruppe per Code finden, ohne die Gruppenliste durchblaettern zu koennen.
create or replace function public.find_group_by_code(p_code text)
returns table (id uuid, name text, emoji text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name, g.emoji, (select count(*) from public.group_members m where m.group_id = g.id)
  from public.groups g
  where g.join_code = lower(trim(p_code))
  limit 1;
$$;

-- Wer einer Gruppe beitritt, gibt den anderen Mitgliedern seinen Fortschritt
-- frei und bekommt umgekehrt deren Fortschritt zu sehen. Das ist der Sinn
-- einer Gruppe - alles Weitere bleibt bewusst gesperrt.
create or replace function public.grant_group_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.share_grants (owner_id, viewer_id, scope)
  select new.user_id, m.user_id, 'progress'
  from public.group_members m
  where m.group_id = new.group_id and m.user_id <> new.user_id
  on conflict do nothing;

  insert into public.share_grants (owner_id, viewer_id, scope)
  select m.user_id, new.user_id, 'progress'
  from public.group_members m
  where m.group_id = new.group_id and m.user_id <> new.user_id
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists group_members_grant on public.group_members;
create trigger group_members_grant
  after insert on public.group_members
  for each row execute function public.grant_group_shares();

-- Beim Verlassen verschwinden die Freigaben wieder - ausser die beiden sind
-- ohnehin befreundet oder noch in einer anderen gemeinsamen Gruppe.
create or replace function public.revoke_group_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.share_grants g
  where g.scope = 'progress'
    and ((g.owner_id = old.user_id and g.viewer_id in (
            select m.user_id from public.group_members m
            where m.group_id = old.group_id and m.user_id <> old.user_id))
      or (g.viewer_id = old.user_id and g.owner_id in (
            select m.user_id from public.group_members m
            where m.group_id = old.group_id and m.user_id <> old.user_id)))
    and not public.are_friends(g.owner_id, g.viewer_id)
    and not public.share_group(g.owner_id, g.viewer_id);
  return old;
end;
$$;

drop trigger if exists group_members_revoke on public.group_members;
create trigger group_members_revoke
  after delete on public.group_members
  for each row execute function public.revoke_group_shares();

-- ------------------------------------------------------------ Zeilenschutz

alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.challenges          enable row level security;
alter table public.challenge_members   enable row level security;
alter table public.activity_reactions  enable row level security;
alter table public.activity_comments   enable row level security;

-- Gruppen sieht nur, wer drin ist.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (exists (
    select 1 from public.group_members m
    where m.group_id = groups.id and m.user_id = auth.uid()
  ));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete to authenticated using (owner_id = auth.uid());

-- Mitglieder sehen einander; beitreten darf man nur selbst.
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (user_id = auth.uid() or public.share_group(auth.uid(), user_id));

drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members
  for insert to authenticated with check (user_id = auth.uid());

-- Austreten darf jeder selbst, entfernen zusaetzlich die Gruppenleitung.
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()
  ));

-- Challenges sieht, wer teilnimmt, wer in der zugehoerigen Gruppe ist - und
-- wer mit dem Ersteller verbunden ist. Ohne Letzteres koennte niemand einer
-- Challenge beitreten, die noch keine Teilnehmer hat.
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.are_connected(auth.uid(), owner_id)
    or exists (select 1 from public.challenge_members c
               where c.challenge_id = challenges.id and c.user_id = auth.uid())
    or (group_id is not null and exists (
          select 1 from public.group_members m
          where m.group_id = challenges.group_id and m.user_id = auth.uid()))
  );

drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists challenges_delete on public.challenges;
create policy challenges_delete on public.challenges
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists challenge_members_select on public.challenge_members;
create policy challenge_members_select on public.challenge_members
  for select to authenticated
  using (user_id = auth.uid() or public.are_connected(auth.uid(), user_id));

drop policy if exists challenge_members_insert on public.challenge_members;
create policy challenge_members_insert on public.challenge_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists challenge_members_delete on public.challenge_members;
create policy challenge_members_delete on public.challenge_members
  for delete to authenticated using (user_id = auth.uid());

-- Reaktionen und Kommentare: lesen darf, wer verbunden ist; schreiben nur im
-- eigenen Namen und nur bei Verbundenen.
drop policy if exists activity_reactions_select on public.activity_reactions;
create policy activity_reactions_select on public.activity_reactions
  for select to authenticated
  using (owner_id = auth.uid() or author_id = auth.uid() or public.are_connected(auth.uid(), owner_id));

drop policy if exists activity_reactions_insert on public.activity_reactions;
create policy activity_reactions_insert on public.activity_reactions
  for insert to authenticated
  with check (author_id = auth.uid() and public.are_connected(auth.uid(), owner_id));

drop policy if exists activity_reactions_delete on public.activity_reactions;
create policy activity_reactions_delete on public.activity_reactions
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists activity_comments_select on public.activity_comments;
create policy activity_comments_select on public.activity_comments
  for select to authenticated
  using (owner_id = auth.uid() or author_id = auth.uid() or public.are_connected(auth.uid(), owner_id));

drop policy if exists activity_comments_insert on public.activity_comments;
create policy activity_comments_insert on public.activity_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.are_connected(auth.uid(), owner_id));

-- Loeschen darf der Verfasser und die Person, um deren Training es geht.
drop policy if exists activity_comments_delete on public.activity_comments;
create policy activity_comments_delete on public.activity_comments
  for delete to authenticated using (author_id = auth.uid() or owner_id = auth.uid());

-- ------------------------------------- Bestehende Regeln auf Gruppen erweitern

-- Profile: zusaetzlich fuer Mitglieder derselben Gruppe sichtbar.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_link(auth.uid(), id) or public.share_group(auth.uid(), id));

-- Geteilte Auswertungen: Freundschaft ODER gemeinsame Gruppe, plus Freigabe.
drop policy if exists share_payloads_select on public.share_payloads;
create policy share_payloads_select on public.share_payloads
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      public.are_connected(share_payloads.owner_id, auth.uid())
      and exists (
        select 1 from public.share_grants g
        where g.owner_id = share_payloads.owner_id
          and g.viewer_id = auth.uid()
          and g.scope = share_payloads.scope
      )
    )
  );

drop policy if exists share_grants_write on public.share_grants;
create policy share_grants_write on public.share_grants
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.are_connected(owner_id, viewer_id));

-- ------------------------------------------------------------ Ausfuehrrechte

revoke execute on function public.share_group(uuid, uuid) from public, anon;
revoke execute on function public.are_connected(uuid, uuid) from public, anon;
revoke execute on function public.find_group_by_code(text) from public, anon;

grant execute on function public.share_group(uuid, uuid) to authenticated;
grant execute on function public.are_connected(uuid, uuid) to authenticated;
grant execute on function public.find_group_by_code(text) to authenticated;
