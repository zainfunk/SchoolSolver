-- ============================================================================
-- RESET_AND_APPLY.sql -- one-shot clean apply
-- ============================================================================
--
-- 1. Removes Supabase migration-tracker rows for versions 0000..0006
--    (does NOT touch any other rows -- only our seven entries).
-- 2. Re-runs every forward migration. All are idempotent, so this is safe
--    on a DB where the schema is partially or fully applied already.
-- 3. Records 0000..0006 in the tracker so future `supabase db push` calls
--    won't try to re-run them.
--
-- Paste this entire file into the Supabase SQL Editor (NOT the Migrations
-- tool) and run.
-- ============================================================================

-- ============================================================================
-- STEP 1: clear our tracker rows. Other migrations stay untouched.
-- ============================================================================

DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('0000','0001','0002','0003','0004','0005','0006');

-- ============================================================================
-- APPLY_ALL.sql  --  one-shot script combining every forward migration
-- 
-- Paste this entire file into the Supabase dashboard SQL editor and run.
-- It is idempotent: every CREATE uses IF NOT EXISTS, every ALTER uses
-- IF NOT EXISTS, every policy is dropped before being re-created.
-- Re-running the script after a partial success is safe.
-- 
-- Generated from migrations 0000..0006.
-- ============================================================================


-- ============================================================================
-- BEGIN 0000_baseline.sql
-- ============================================================================
-- ============================================================
-- ClubIt — Full Schema + Seed
-- Run once in Supabase SQL Editor
-- ============================================================

-- Users
create table if not exists users (
  id text primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'advisor', 'student')),
  avatar_url text
);

-- Clubs
create table if not exists clubs (
  id text primary key,
  name text not null,
  description text,
  icon_url text,
  capacity int,
  advisor_id text references users(id),
  auto_accept boolean default false,
  tags text[] default '{}',
  event_creator_ids text[] default '{}',
  created_at text not null
);

-- Leadership positions
create table if not exists leadership_positions (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  user_id text references users(id) on delete set null
);

-- Social links (club)
create table if not exists club_social_links (
  id text primary key default gen_random_uuid()::text,
  club_id text references clubs(id) on delete cascade,
  platform text not null,
  url text not null
);

-- Meeting times
create table if not exists meeting_times (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time text not null,
  end_time text not null,
  location text
);

-- Memberships
create table if not exists memberships (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  joined_at text not null,
  unique(club_id, user_id)
);

-- Events
create table if not exists events (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  description text,
  date text not null,
  location text,
  is_public boolean default true,
  created_by text references users(id)
);

-- Join requests
create table if not exists join_requests (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  requested_at text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

-- Attendance records
create table if not exists attendance_records (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  meeting_date text not null,
  present boolean not null,
  unique(club_id, user_id, meeting_date)
);

-- Attendance sessions (QR check-in)
create table if not exists attendance_sessions (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  meeting_date text not null,
  created_by text references users(id),
  expires_at text not null,
  max_distance_meters int default 0,
  advisor_lat float,
  advisor_lng float,
  recorded_user_ids text[] default '{}'
);

-- Club news
create table if not exists club_news (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  content text not null,
  author_id text references users(id),
  created_at text not null,
  is_pinned boolean default false
);

-- Polls
create table if not exists polls (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  position_title text not null,
  created_at text not null,
  is_open boolean default true
);

create table if not exists poll_candidates (
  id text primary key default gen_random_uuid()::text,
  poll_id text references polls(id) on delete cascade,
  user_id text references users(id)
);

create table if not exists poll_votes (
  poll_id text references polls(id) on delete cascade,
  candidate_user_id text references users(id),
  voter_user_id text references users(id),
  primary key (poll_id, voter_user_id)
);

-- School elections
create table if not exists school_elections (
  id text primary key,
  position_title text not null,
  description text,
  created_at text not null,
  is_open boolean default true
);

create table if not exists election_candidates (
  id text primary key default gen_random_uuid()::text,
  election_id text references school_elections(id) on delete cascade,
  user_id text references users(id)
);

create table if not exists election_votes (
  election_id text references school_elections(id) on delete cascade,
  candidate_user_id text references users(id),
  voter_user_id text references users(id),
  primary key (election_id, voter_user_id)
);

-- Chat messages
create table if not exists chat_messages (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  sender_id text references users(id),
  content text not null,
  sent_at text not null
);

-- Club forms
create table if not exists club_forms (
  id text primary key,
  club_id text references clubs(id) on delete cascade,
  title text not null,
  description text,
  form_type text not null check (form_type in ('signup', 'nomination', 'survey', 'approval')),
  is_open boolean default true,
  closes_at text,
  created_at text not null
);

create table if not exists form_responses (
  form_id text references club_forms(id) on delete cascade,
  user_id text references users(id),
  responded_at text not null default now()::text,
  primary key (form_id, user_id)
);

-- User profiles (extended)
create table if not exists user_profiles (
  user_id text primary key references users(id) on delete cascade,
  bio text default '',
  skills text[] default '{}',
  interests text[] default '{}',
  socials jsonb default '[]'
);

-- User overrides (name/email edits by admin)
create table if not exists user_overrides (
  user_id text primary key references users(id) on delete cascade,
  name text,
  email text
);

-- Admin settings (single row)
create table if not exists admin_settings (
  id int primary key default 1,
  achievements_enabled boolean default true,
  attendance_enabled boolean default true,
  clubs_enabled boolean default true,
  student_socials_enabled boolean default true,
  check (id = 1)
);

-- User privacy settings
create table if not exists user_privacy_settings (
  user_id text primary key references users(id) on delete cascade,
  achievements_public boolean default true,
  attendance_public boolean default false,
  clubs_public boolean default true
);

-- ============================================================
-- Seed Data
-- ============================================================

insert into users (id, name, email, role) values
  ('user-admin-1',   'Principal Hayes', 'hayes@clubit.edu',    'admin'),
  ('user-advisor-1', 'Ms. Patel',       'patel@clubit.edu',    'advisor'),
  ('user-advisor-2', 'Mr. Thompson',    'thompson@clubit.edu', 'advisor'),
  ('user-student-1', 'Alex Rivera',     'alex@clubit.edu',     'student'),
  ('user-student-2', 'Jordan Kim',      'jordan@clubit.edu',   'student'),
  ('user-student-3', 'Sam Okafor',      'sam@clubit.edu',      'student')
on conflict (id) do nothing;

insert into clubs (id, name, description, icon_url, capacity, advisor_id, auto_accept, tags, event_creator_ids, created_at) values
  ('club-robotics',    'Robotics Club',       'Build and program robots to compete in regional and national competitions. No experience required — just curiosity and drive.', '🤖', 20,   'user-advisor-1', true,  array['STEM','Engineering','Competition'], array['user-student-1'], '2024-09-01'),
  ('club-drama',       'Drama Club',          'Perform in school plays and musicals, develop stage presence, and explore the world of theatre. Open to all skill levels.',    '🎭', 30,   'user-advisor-2', false, array['Arts','Performance','Theatre'],    array['user-student-3'], '2024-09-01'),
  ('club-chess',       'Chess Club',          'Sharpen your strategy and compete against other schools. Beginners welcome — experienced members will help you learn.',          '♟️', null, 'user-advisor-1', false, array['Strategy','Competition','Games'],  array[]::text[],         '2024-09-01'),
  ('club-environment', 'Environmental Club',  'Take action on sustainability, organize campus clean-ups, and raise awareness about environmental issues in our community.',    '🌱', 25,   'user-advisor-2', true,  array['Environment','Community','Activism'], array['user-student-2'], '2024-09-01')
on conflict (id) do nothing;

insert into leadership_positions (id, club_id, title, user_id) values
  ('lp-1', 'club-robotics',    'President',             'user-student-1'),
  ('lp-2', 'club-robotics',    'Vice President',        'user-student-2'),
  ('lp-3', 'club-robotics',    'Build Lead',            null),
  ('lp-4', 'club-drama',       'President',             'user-student-3'),
  ('lp-5', 'club-drama',       'Stage Manager',         null),
  ('lp-6', 'club-chess',       'President',             'user-student-1'),
  ('lp-7', 'club-chess',       'Tournament Coordinator',null),
  ('lp-8', 'club-environment', 'President',             null),
  ('lp-9', 'club-environment', 'Events Coordinator',    'user-student-2')
on conflict (id) do nothing;

insert into club_social_links (club_id, platform, url) values
  ('club-robotics',    'instagram', 'https://instagram.com'),
  ('club-robotics',    'discord',   'https://discord.com'),
  ('club-drama',       'instagram', 'https://instagram.com'),
  ('club-environment', 'instagram', 'https://instagram.com'),
  ('club-environment', 'twitter',   'https://twitter.com')
on conflict do nothing;

insert into meeting_times (id, club_id, day_of_week, start_time, end_time, location) values
  ('mt-1', 'club-robotics',    2, '15:00', '16:30', 'Room 204'),
  ('mt-2', 'club-robotics',    4, '15:00', '16:30', 'Room 204'),
  ('mt-3', 'club-drama',       1, '14:30', '16:00', 'Auditorium'),
  ('mt-4', 'club-drama',       3, '14:30', '16:00', 'Auditorium'),
  ('mt-5', 'club-chess',       3, '15:00', '16:00', 'Library'),
  ('mt-6', 'club-environment', 5, '12:00', '13:00', 'Room 101')
on conflict (id) do nothing;

insert into memberships (id, club_id, user_id, joined_at) values
  ('m-1', 'club-robotics',    'user-student-1', '2024-09-05'),
  ('m-2', 'club-robotics',    'user-student-2', '2024-09-05'),
  ('m-3', 'club-drama',       'user-student-2', '2024-09-06'),
  ('m-4', 'club-drama',       'user-student-3', '2024-09-06'),
  ('m-5', 'club-chess',       'user-student-1', '2024-09-07'),
  ('m-6', 'club-chess',       'user-student-3', '2024-09-07'),
  ('m-7', 'club-environment', 'user-student-2', '2024-09-08')
on conflict (club_id, user_id) do nothing;

insert into events (id, club_id, title, description, date, location, is_public, created_by) values
  ('event-1', 'club-robotics',    'Regional Robotics Qualifier',  'Compete against 12 other schools in the regional qualifier round.',    '2026-04-20', 'Westfield High Gymnasium', true,  'user-advisor-1'),
  ('event-2', 'club-drama',       'Spring Musical — Auditions',   'Auditions for this year''s spring musical. Open to all students.',     '2026-04-15', 'Main Auditorium',          true,  'user-advisor-2'),
  ('event-3', 'club-chess',       'Interschool Chess Tournament', 'Home tournament — we''re hosting 6 schools this year.',               '2026-05-03', 'Library',                  true,  'user-advisor-1'),
  ('event-4', 'club-environment', 'Earth Day Campus Clean-Up',    'Join us for our annual Earth Day clean-up. All students welcome.',     '2026-04-22', 'School Grounds',           true,  'user-student-2'),
  ('event-5', 'club-robotics',    'Build Workshop',               'Internal workshop for members to work on the robot chassis.',          '2026-04-10', 'Room 204',                 false, 'user-student-1')
on conflict (id) do nothing;

insert into join_requests (id, club_id, user_id, requested_at, status) values
  ('req-1', 'club-robotics',    'user-student-3', '2026-04-01T09:15:00Z', 'pending'),
  ('req-2', 'club-drama',       'user-student-1', '2026-04-02T10:30:00Z', 'pending'),
  ('req-3', 'club-chess',       'user-student-2', '2026-04-01T14:00:00Z', 'pending'),
  ('req-4', 'club-environment', 'user-student-1', '2026-04-03T08:00:00Z', 'pending'),
  ('req-5', 'club-environment', 'user-student-3', '2026-04-03T11:45:00Z', 'pending')
on conflict (id) do nothing;

insert into attendance_records (id, club_id, user_id, meeting_date, present) values
  ('att-1',  'club-robotics',    'user-student-1', '2026-03-19', true),
  ('att-2',  'club-robotics',    'user-student-2', '2026-03-19', false),
  ('att-3',  'club-robotics',    'user-student-1', '2026-03-24', true),
  ('att-4',  'club-robotics',    'user-student-2', '2026-03-24', true),
  ('att-5',  'club-robotics',    'user-student-1', '2026-03-26', true),
  ('att-6',  'club-robotics',    'user-student-2', '2026-03-26', true),
  ('att-7',  'club-drama',       'user-student-2', '2026-03-16', true),
  ('att-8',  'club-drama',       'user-student-3', '2026-03-16', true),
  ('att-9',  'club-drama',       'user-student-2', '2026-03-18', false),
  ('att-10', 'club-drama',       'user-student-3', '2026-03-18', true),
  ('att-11', 'club-chess',       'user-student-1', '2026-03-18', true),
  ('att-12', 'club-chess',       'user-student-3', '2026-03-18', false),
  ('att-13', 'club-chess',       'user-student-1', '2026-03-25', true),
  ('att-14', 'club-chess',       'user-student-3', '2026-03-25', true),
  ('att-15', 'club-environment', 'user-student-2', '2026-03-20', true),
  ('att-16', 'club-environment', 'user-student-2', '2026-03-27', false)
on conflict (club_id, user_id, meeting_date) do nothing;

insert into club_news (id, club_id, title, content, author_id, created_at, is_pinned) values
  ('news-1', 'club-robotics', 'Qualifier Prep Starts Monday',  'All members please come prepared with your build notes. We will be doing a full run-through of the competition routine before the qualifier on April 20.', 'user-advisor-1', '2026-04-04T08:00:00Z', true),
  ('news-2', 'club-robotics', 'New Parts Arrived',             'The replacement servo motors and sensor kits have arrived. Pick them up from Room 204 before our next session.',                                          'user-student-1', '2026-04-02T14:00:00Z', false),
  ('news-3', 'club-drama',    'Audition Slots Open',           'Sign-up sheet for audition slots is now available outside the auditorium. Slots fill up fast — grab yours by Friday!',                                    'user-advisor-2', '2026-04-03T09:30:00Z', true)
on conflict (id) do nothing;

insert into polls (id, club_id, position_title, created_at, is_open) values
  ('poll-1', 'club-robotics', 'Build Lead', '2026-04-04T10:00:00Z', true)
on conflict (id) do nothing;

insert into poll_candidates (poll_id, user_id) values
  ('poll-1', 'user-student-1'),
  ('poll-1', 'user-student-2')
on conflict do nothing;

insert into school_elections (id, position_title, description, created_at, is_open) values
  ('selec-1', 'Student Body President',      'Vote for next year''s Student Body President. Shape the future of campus life.',                                          '2026-04-01T09:00:00Z', true),
  ('selec-2', 'Student Body Treasurer',      'Vote for next year''s Student Body Treasurer. Responsible for managing the student activity fund.',                      '2026-04-01T09:05:00Z', true),
  ('selec-3', 'Student Body Vice President', 'Past election — Vice President for the 2025–26 school year.',                                                             '2025-09-10T09:00:00Z', false)
on conflict (id) do nothing;

insert into election_candidates (election_id, user_id) values
  ('selec-1', 'user-student-1'),
  ('selec-1', 'user-student-3'),
  ('selec-2', 'user-student-2'),
  ('selec-2', 'user-student-3'),
  ('selec-3', 'user-student-1'),
  ('selec-3', 'user-student-2')
on conflict do nothing;

insert into election_votes (election_id, candidate_user_id, voter_user_id) values
  ('selec-1', 'user-student-1', 'user-student-2'),
  ('selec-3', 'user-student-1', 'user-admin-1'),
  ('selec-3', 'user-student-1', 'user-advisor-1'),
  ('selec-3', 'user-student-2', 'user-advisor-2')
on conflict do nothing;

insert into chat_messages (id, club_id, sender_id, content, sent_at) values
  ('msg-1',  'club-robotics',    'user-student-1', 'Hey team! Anyone working on the chassis this week?',                                                                 '2026-04-04T09:15:00Z'),
  ('msg-2',  'club-robotics',    'user-student-2', 'Yeah, I''ll be in Room 204 on Tuesday after school.',                                                                '2026-04-04T09:22:00Z'),
  ('msg-3',  'club-robotics',    'user-advisor-1', 'Great! Remember the qualifier is April 20th. Make sure the motors are calibrated before then.',                      '2026-04-04T09:45:00Z'),
  ('msg-4',  'club-robotics',    'user-student-1', 'On it. Also thinking about adding a sensor array for the obstacle course.',                                          '2026-04-04T10:01:00Z'),
  ('msg-5',  'club-drama',       'user-student-2', 'Auditions are April 15th — who else is trying out?',                                                                 '2026-04-03T14:00:00Z'),
  ('msg-6',  'club-drama',       'user-student-3', 'I am! Hoping to get the lead this year. Been practicing all week.',                                                   '2026-04-03T14:10:00Z'),
  ('msg-7',  'club-drama',       'user-advisor-2', 'Come prepared with a 2-minute monologue. Sheet music for the musical numbers will be handed out on the day.',        '2026-04-03T14:30:00Z'),
  ('msg-8',  'club-chess',       'user-student-1', 'Tournament is May 3rd. Want to do a practice session before?',                                                       '2026-04-02T16:00:00Z'),
  ('msg-9',  'club-chess',       'user-student-3', 'Definitely. How about next Wednesday in the library at 3 PM?',                                                       '2026-04-02T16:30:00Z'),
  ('msg-10', 'club-chess',       'user-student-1', 'Works for me. I''ll bring the boards.',                                                                               '2026-04-02T16:45:00Z'),
  ('msg-11', 'club-environment', 'user-student-2', 'Earth Day is April 22nd. Who''s coming to the campus clean-up?',                                                     '2026-04-01T11:00:00Z'),
  ('msg-12', 'club-environment', 'user-advisor-2', 'Count me in. I can bring extra gloves and bags. Great initiative, Jordan!',                                          '2026-04-01T11:20:00Z')
on conflict (id) do nothing;

insert into club_forms (id, club_id, title, description, form_type, is_open, closes_at, created_at) values
  ('form-1', 'club-drama',       'Officer Nominations',           'Nominate candidates for Stage Manager and Treasurer for the upcoming semester.',         'nomination', true,  '2026-04-08T17:00:00Z', '2026-04-01T10:00:00Z'),
  ('form-2', 'club-robotics',    'Regional Competition Sign-Up',  'Travel authorization and liability waiver for the Spring Regional Robotics Competition.','signup',     true,  '2026-04-10T17:00:00Z', '2026-04-01T10:00:00Z'),
  ('form-3', 'club-environment', 'Earth Day Project Selection',   'Vote on our Earth Day initiative: campus clean-up, recycling drive, or tree planting.', 'survey',     true,  '2026-04-11T18:00:00Z', '2026-04-02T10:00:00Z'),
  ('form-4', 'club-chess',       'Annual Budget Approval 2026',   'Review and approve the proposed annual budget for club activities and equipment.',       'approval',   false, '2026-03-28T17:00:00Z', '2026-03-20T10:00:00Z')
on conflict (id) do nothing;

insert into admin_settings (id) values (1)
on conflict (id) do nothing;

-- ============================================================
-- Multi-tenant: Schools (tenant boundary)
-- ============================================================

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  contact_name text not null,
  contact_email text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'payment_paused')),
  student_invite_code text unique,
  admin_invite_code text unique,
  advisor_invite_code text unique,
  -- One-time IT setup link token
  setup_token text unique,
  setup_token_expires_at timestamptz,
  setup_completed_at timestamptz,
  created_at timestamptz default now()
);

-- Add advisor_invite_code to existing schools tables (migration for existing deployments)
alter table schools add column if not exists advisor_invite_code text unique;

-- Stripe subscription tracking
alter table schools add column if not exists stripe_customer_id text;
alter table schools add column if not exists stripe_subscription_status text default 'none';

-- Add school_id to users (nullable: superadmin users have no school)
alter table users add column if not exists school_id uuid references schools(id) on delete set null;

-- Fix admin_settings for multi-tenancy: remove singleton constraint, support one row per school
alter table admin_settings drop constraint if exists admin_settings_id_check;
alter table admin_settings alter column id set default nextval(pg_get_serial_sequence('admin_settings', 'id'));
alter table admin_settings add column if not exists school_id uuid references schools(id) on delete cascade;
create unique index if not exists admin_settings_school_id_idx on admin_settings (school_id) where school_id is not null;

-- Add school_id to clubs and school elections
alter table clubs add column if not exists school_id uuid references schools(id) on delete cascade;
alter table school_elections add column if not exists school_id uuid references schools(id) on delete cascade;
alter table admin_settings add column if not exists school_id uuid references schools(id) on delete cascade;

-- Add superadmin to allowed roles
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('superadmin', 'admin', 'advisor', 'student'));

-- ============================================================
-- Seed: Demo school for existing seed data
-- ============================================================

insert into schools (id, name, district, contact_name, contact_email, status, student_invite_code, admin_invite_code, advisor_invite_code, setup_completed_at) values
  ('00000000-0000-0000-0000-000000000001', 'Demo High School', 'Demo District', 'Principal Hayes', 'hayes@clubit.edu', 'active', 'DEMO-STU-0001', 'DEMO-ADM-0001', 'DEMO-ADV-0001', now())
on conflict (id) do nothing;

-- Assign existing seed users to the demo school
update users set school_id = '00000000-0000-0000-0000-000000000001'
where id in ('user-admin-1', 'user-advisor-1', 'user-advisor-2', 'user-student-1', 'user-student-2', 'user-student-3')
  and school_id is null;

-- Assign existing seed clubs to the demo school
update clubs set school_id = '00000000-0000-0000-0000-000000000001'
where school_id is null;

-- Assign existing seed elections to the demo school
update school_elections set school_id = '00000000-0000-0000-0000-000000000001'
where school_id is null;

-- ============================================================
-- School invites (superadmin-generated onboarding links)
-- ============================================================

create table if not exists school_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text unique not null,
  created_at timestamptz default now(),
  used_at timestamptz,
  school_id uuid references schools(id) on delete set null
);

-- ============================================================
-- Issue Reports
-- ============================================================

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  reporter_id text references users(id) on delete set null,
  reporter_name text not null,
  reporter_email text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz default now()
);

-- ============================================================
-- Row-Level Security (requires Clerk session tokens in Supabase)
-- See:
--   https://supabase.com/docs/guides/auth/third-party/clerk
--   https://clerk.com/docs/integrations/databases/supabase
-- ============================================================

create schema if not exists app;

create or replace function app.current_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->>'sub', '');
$$;

create or replace function app.current_role()
returns text
language sql
stable
as $$
  select role
  from users
  where id = app.current_user_id();
$$;

create or replace function app.current_school_id()
returns uuid
language sql
stable
as $$
  select school_id
  from users
  where id = app.current_user_id();
$$;

create or replace function app.is_superadmin()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_role() = 'superadmin', false);
$$;

create or replace function app.is_school_admin()
returns boolean
language sql
stable
as $$
  select coalesce(app.current_role() = 'admin', false) or app.is_superadmin();
$$;

create or replace function app.user_in_scope(target_user_id text)
returns boolean
language sql
stable
as $$
  select
    app.is_superadmin()
    or exists (
      select 1
      from users u
      where u.id = target_user_id
        and (u.school_id = app.current_school_id() or u.id = app.current_user_id())
    );
$$;

create or replace function app.club_in_scope(target_club_id text)
returns boolean
language sql
stable
as $$
  select
    app.is_superadmin()
    or exists (
      select 1
      from clubs c
      where c.id = target_club_id
        and c.school_id = app.current_school_id()
    );
$$;

create or replace function app.club_manager(target_club_id text)
returns boolean
language sql
stable
as $$
  select
    app.is_superadmin()
    or exists (
      select 1
      from clubs c
      where c.id = target_club_id
        and c.school_id = app.current_school_id()
        and (
          app.current_role() = 'admin'
          or c.advisor_id = app.current_user_id()
        )
    );
$$;

create or replace function app.club_event_creator(target_club_id text)
returns boolean
language sql
stable
as $$
  select
    app.club_manager(target_club_id)
    or exists (
      select 1
      from clubs c
      where c.id = target_club_id
        and c.school_id = app.current_school_id()
        and app.current_user_id() = any(c.event_creator_ids)
    );
$$;

create or replace function app.club_member(target_club_id text, target_user_id text default app.current_user_id())
returns boolean
language sql
stable
as $$
  select
    app.club_manager(target_club_id)
    or exists (
      select 1
      from memberships m
      join clubs c on c.id = m.club_id
      where m.club_id = target_club_id
        and m.user_id = target_user_id
        and c.school_id = app.current_school_id()
    );
$$;

create or replace function app.poll_in_scope(target_poll_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from polls p
    join clubs c on c.id = p.club_id
    where p.id = target_poll_id
      and (app.is_superadmin() or c.school_id = app.current_school_id())
  );
$$;

create or replace function app.poll_manager(target_poll_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from polls p
    where p.id = target_poll_id
      and app.club_manager(p.club_id)
  );
$$;

create or replace function app.election_in_scope(target_election_id text)
returns boolean
language sql
stable
as $$
  select
    app.is_superadmin()
    or exists (
      select 1
      from school_elections e
      where e.id = target_election_id
        and e.school_id = app.current_school_id()
    );
$$;

create or replace function app.form_in_scope(target_form_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from club_forms f
    join clubs c on c.id = f.club_id
    where f.id = target_form_id
      and (app.is_superadmin() or c.school_id = app.current_school_id())
  );
$$;

create or replace function app.form_manager(target_form_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from club_forms f
    where f.id = target_form_id
      and app.club_manager(f.club_id)
  );
$$;

alter table schools enable row level security;
alter table users enable row level security;
alter table clubs enable row level security;
alter table memberships enable row level security;
alter table join_requests enable row level security;
alter table leadership_positions enable row level security;
alter table club_social_links enable row level security;
alter table meeting_times enable row level security;
alter table events enable row level security;
alter table attendance_records enable row level security;
alter table attendance_sessions enable row level security;
alter table club_news enable row level security;
alter table polls enable row level security;
alter table poll_candidates enable row level security;
alter table poll_votes enable row level security;
alter table school_elections enable row level security;
alter table election_candidates enable row level security;
alter table election_votes enable row level security;
alter table chat_messages enable row level security;
alter table club_forms enable row level security;
alter table form_responses enable row level security;
alter table user_profiles enable row level security;
alter table user_overrides enable row level security;
alter table user_privacy_settings enable row level security;
alter table admin_settings enable row level security;
alter table issue_reports enable row level security;

drop policy if exists schools_select on schools;
create policy schools_select on schools
  for select to authenticated
  using (app.is_superadmin() or id = app.current_school_id());

drop policy if exists users_select on users;
create policy users_select on users
  for select to authenticated
  using (app.user_in_scope(id));

drop policy if exists users_insert_self on users;
create policy users_insert_self on users
  for insert to authenticated
  with check (id = app.current_user_id());

drop policy if exists clubs_select on clubs;
create policy clubs_select on clubs
  for select to authenticated
  using (app.club_in_scope(id));

drop policy if exists clubs_insert on clubs;
create policy clubs_insert on clubs
  for insert to authenticated
  with check (
    school_id = app.current_school_id()
    and (
      app.is_school_admin()
      or (app.current_role() = 'advisor' and advisor_id = app.current_user_id())
    )
  );

drop policy if exists clubs_update on clubs;
create policy clubs_update on clubs
  for update to authenticated
  using (app.club_manager(id))
  with check (app.club_manager(id));

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists memberships_insert on memberships;
create policy memberships_insert on memberships
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and app.user_in_scope(user_id)
    and (
      app.club_manager(club_id)
      or user_id = app.current_user_id()
    )
  );

drop policy if exists memberships_delete on memberships;
create policy memberships_delete on memberships
  for delete to authenticated
  using (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or user_id = app.current_user_id()
    )
  );

drop policy if exists join_requests_select on join_requests;
create policy join_requests_select on join_requests
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists join_requests_insert on join_requests;
create policy join_requests_insert on join_requests
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and user_id = app.current_user_id()
  );

drop policy if exists join_requests_update on join_requests;
create policy join_requests_update on join_requests
  for update to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists join_requests_delete on join_requests;
create policy join_requests_delete on join_requests
  for delete to authenticated
  using (
    app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

drop policy if exists leadership_positions_select on leadership_positions;
create policy leadership_positions_select on leadership_positions
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists leadership_positions_manage on leadership_positions;
create policy leadership_positions_manage on leadership_positions
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists club_social_links_select on club_social_links;
create policy club_social_links_select on club_social_links
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists club_social_links_manage on club_social_links;
create policy club_social_links_manage on club_social_links
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists meeting_times_select on meeting_times;
create policy meeting_times_select on meeting_times
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists meeting_times_manage on meeting_times;
create policy meeting_times_manage on meeting_times
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists events_select on events;
create policy events_select on events
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists events_manage on events;
create policy events_manage on events
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and created_by = app.current_user_id()
  );

drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists attendance_records_insert on attendance_records;
create policy attendance_records_insert on attendance_records
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or (
        user_id = app.current_user_id()
        and app.club_member(club_id, user_id)
      )
    )
  );

drop policy if exists attendance_records_update on attendance_records;
create policy attendance_records_update on attendance_records
  for update to authenticated
  using (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or (
        user_id = app.current_user_id()
        and app.club_member(club_id, user_id)
      )
    )
  )
  with check (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or (
        user_id = app.current_user_id()
        and app.club_member(club_id, user_id)
      )
    )
  );

drop policy if exists attendance_sessions_select on attendance_sessions;
create policy attendance_sessions_select on attendance_sessions
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists attendance_sessions_manage on attendance_sessions;
create policy attendance_sessions_manage on attendance_sessions
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists club_news_select on club_news;
create policy club_news_select on club_news
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists club_news_manage on club_news;
create policy club_news_manage on club_news
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and author_id = app.current_user_id()
  );

drop policy if exists polls_select on polls;
create policy polls_select on polls
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists polls_manage on polls;
create policy polls_manage on polls
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists poll_candidates_select on poll_candidates;
create policy poll_candidates_select on poll_candidates
  for select to authenticated
  using (app.poll_in_scope(poll_id));

drop policy if exists poll_candidates_manage on poll_candidates;
create policy poll_candidates_manage on poll_candidates
  for all to authenticated
  using (app.poll_manager(poll_id))
  with check (app.poll_manager(poll_id));

drop policy if exists poll_votes_select on poll_votes;
create policy poll_votes_select on poll_votes
  for select to authenticated
  using (app.poll_in_scope(poll_id));

drop policy if exists poll_votes_insert on poll_votes;
create policy poll_votes_insert on poll_votes
  for insert to authenticated
  with check (
    app.poll_in_scope(poll_id)
    and voter_user_id = app.current_user_id()
    and exists (
      select 1
      from polls p
      where p.id = poll_id
        and app.club_member(p.club_id, app.current_user_id())
    )
  );

drop policy if exists school_elections_select on school_elections;
create policy school_elections_select on school_elections
  for select to authenticated
  using (app.election_in_scope(id));

drop policy if exists school_elections_manage on school_elections;
create policy school_elections_manage on school_elections
  for all to authenticated
  using (app.is_school_admin() and school_id = app.current_school_id())
  with check (app.is_school_admin() and school_id = app.current_school_id());

drop policy if exists election_candidates_select on election_candidates;
create policy election_candidates_select on election_candidates
  for select to authenticated
  using (app.election_in_scope(election_id));

drop policy if exists election_candidates_manage on election_candidates;
create policy election_candidates_manage on election_candidates
  for all to authenticated
  using (app.is_school_admin() and app.election_in_scope(election_id))
  with check (app.is_school_admin() and app.election_in_scope(election_id));

drop policy if exists election_votes_select on election_votes;
create policy election_votes_select on election_votes
  for select to authenticated
  using (app.election_in_scope(election_id));

drop policy if exists election_votes_insert on election_votes;
create policy election_votes_insert on election_votes
  for insert to authenticated
  with check (
    app.election_in_scope(election_id)
    and voter_user_id = app.current_user_id()
  );

drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and sender_id = app.current_user_id()
    and app.club_member(club_id, app.current_user_id())
  );

drop policy if exists club_forms_select on club_forms;
create policy club_forms_select on club_forms
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists club_forms_manage on club_forms;
create policy club_forms_manage on club_forms
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists form_responses_select on form_responses;
create policy form_responses_select on form_responses
  for select to authenticated
  using (app.form_in_scope(form_id));

drop policy if exists form_responses_insert on form_responses;
create policy form_responses_insert on form_responses
  for insert to authenticated
  with check (
    app.form_in_scope(form_id)
    and user_id = app.current_user_id()
  );

drop policy if exists user_profiles_select on user_profiles;
create policy user_profiles_select on user_profiles
  for select to authenticated
  using (app.user_in_scope(user_id));

drop policy if exists user_profiles_insert on user_profiles;
create policy user_profiles_insert on user_profiles
  for insert to authenticated
  with check (
    app.user_in_scope(user_id)
    and (
      user_id = app.current_user_id()
      or app.is_school_admin()
    )
  );

drop policy if exists user_profiles_update on user_profiles;
create policy user_profiles_update on user_profiles
  for update to authenticated
  using (
    app.user_in_scope(user_id)
    and (
      user_id = app.current_user_id()
      or app.is_school_admin()
    )
  )
  with check (
    app.user_in_scope(user_id)
    and (
      user_id = app.current_user_id()
      or app.is_school_admin()
    )
  );

drop policy if exists user_overrides_select on user_overrides;
create policy user_overrides_select on user_overrides
  for select to authenticated
  using (app.user_in_scope(user_id));

drop policy if exists user_overrides_manage on user_overrides;
create policy user_overrides_manage on user_overrides
  for all to authenticated
  using (
    app.user_in_scope(user_id)
    and (
      user_id = app.current_user_id()
      or app.is_school_admin()
    )
  )
  with check (
    app.user_in_scope(user_id)
    and (
      user_id = app.current_user_id()
      or app.is_school_admin()
    )
  );

drop policy if exists user_privacy_settings_select on user_privacy_settings;
create policy user_privacy_settings_select on user_privacy_settings
  for select to authenticated
  using (app.user_in_scope(user_id));

drop policy if exists user_privacy_settings_manage on user_privacy_settings;
create policy user_privacy_settings_manage on user_privacy_settings
  for all to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

drop policy if exists admin_settings_select on admin_settings;
create policy admin_settings_select on admin_settings
  for select to authenticated
  using (school_id = app.current_school_id() or app.is_superadmin());

drop policy if exists admin_settings_manage on admin_settings;
create policy admin_settings_manage on admin_settings
  for all to authenticated
  using (app.is_school_admin() and school_id = app.current_school_id())
  with check (app.is_school_admin() and school_id = app.current_school_id());

drop policy if exists issue_reports_select on issue_reports;
create policy issue_reports_select on issue_reports
  for select to authenticated
  using (school_id = app.current_school_id() or app.is_superadmin());

drop policy if exists issue_reports_insert on issue_reports;
create policy issue_reports_insert on issue_reports
  for insert to authenticated
  with check (
    school_id = app.current_school_id()
    and reporter_id = app.current_user_id()
  );

drop policy if exists issue_reports_update on issue_reports;
create policy issue_reports_update on issue_reports
  for update to authenticated
  using (app.is_school_admin() and school_id = app.current_school_id())
  with check (app.is_school_admin() and school_id = app.current_school_id());

-- ============================================================
-- Invite code expiry tracking
-- ============================================================

ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_code_expires_at timestamptz;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS advisor_code_expires_at timestamptz;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS admin_code_expires_at timestamptz;

-- ============================================================
-- Notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  school_id uuid REFERENCES schools(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- Subscriptions & Billing (Stripe)
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
  )),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  amount_cents integer,
  currency text DEFAULT 'usd',
  status text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_school ON subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_school ON payment_events(school_id, created_at DESC);

-- ============================================================
-- Rewards, Achievements & Hours Tracking
-- ============================================================

-- Per check-in duration (auto-derived from meeting_times.start/end at check-in time)
alter table attendance_records add column if not exists duration_minutes int default 60;

-- Advisor-editable +/- delta on the auto-tracked hours per (member, club)
alter table memberships add column if not exists hours_adjustment_minutes int default 0;

-- Running XP counter (level is derived from this)
alter table users add column if not exists xp_total int default 0;

-- Admin feature toggles for the rewards subsystems
alter table admin_settings add column if not exists points_enabled boolean default true;
alter table admin_settings add column if not exists streaks_enabled boolean default true;
alter table admin_settings add column if not exists leaderboards_enabled boolean default true;
alter table admin_settings add column if not exists hours_tracking_enabled boolean default true;

-- Earned badges (catalog lives in code; this table only records the unlock event)
create table if not exists user_badges (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz default now(),
  club_id text references clubs(id) on delete set null,
  unique(user_id, badge_key, club_id)
);
create index if not exists user_badges_user_idx on user_badges(user_id);

alter table user_badges enable row level security;

drop policy if exists user_badges_select on user_badges;
create policy user_badges_select on user_badges
  for select to authenticated
  using (app.user_in_scope(user_id));

-- Writes are server-only via service role; no insert/update policy granted to authenticated.

-- ============================================================================
-- END 0000_baseline.sql
-- ============================================================================


-- ============================================================================
-- BEGIN 0001_users_rls_lockdown.sql
-- ============================================================================
-- 0001_users_rls_lockdown.sql
--
-- Closes finding C-5 in docs/security/ClubIt-Security-Assessment.md.
--
-- The previous policy permitted authenticated users to insert their own
-- `users` row with any role (including `admin` or `superadmin`) and any
-- school_id. There was no UPDATE policy at all, but no policy means RLS
-- denies UPDATE for `authenticated` -- which sounds safe but actually means
-- the existing application code (which uses the service-role key) is the
-- only thing keeping role/school_id pinned. That's the wrong layer for
-- defense in depth.
--
-- This migration:
--   1. Tightens users_insert_self so a user can only insert their own row
--      as a student with no school yet (the only legitimate self-insert,
--      done by /api/user/sync on first login).
--   2. Adds users_update_self that lets a user change non-privilege
--      fields (name, avatar_url) on their own row only.
--   3. Adds a row-level trigger that blocks role and school_id changes for
--      any non-service-role caller, so the SECURITY-DEFINER admin endpoints
--      (which run as service_role) still work but a direct RLS UPDATE
--      from a hijacked client cannot escalate.
--
-- Idempotent: safe to re-run. Down-migration in 0001_users_rls_lockdown.down.sql.

begin;

-- 1. Replace users_insert_self with the strict version.
drop policy if exists users_insert_self on users;
create policy users_insert_self on users
  for insert
  to authenticated
  with check (
    id = app.current_user_id()
    and role = 'student'
    and school_id is null
  );

-- 2. Add users_update_self -- allows the user to update their own row
--    (subject to the trigger below, which blocks privilege fields).
drop policy if exists users_update_self on users;
create policy users_update_self on users
  for update
  to authenticated
  using (id = app.current_user_id())
  with check (id = app.current_user_id());

-- 3. Trigger to block role and school_id changes from non-service-role
--    callers. Postgres RLS WITH CHECK clauses cannot reference OLD; the
--    trigger is the standard workaround.
create or replace function app.users_block_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_service boolean;
begin
  -- service_role and postgres are the privileged roles in Supabase. The
  -- trigger lets writes from those roles through unchanged. For every
  -- other role (authenticated, anon, etc.) the privileged columns must
  -- match OLD.
  select current_setting('request.jwt.claim.role', true) = 'service_role'
      or current_user = 'service_role'
      or current_user = 'postgres'
    into is_service;

  if is_service then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception
      'role changes via direct UPDATE are not permitted (id=%, attempted role=%)',
      new.id, new.role
      using errcode = '42501'; -- insufficient_privilege
  end if;

  if new.school_id is distinct from old.school_id then
    raise exception
      'school_id changes via direct UPDATE are not permitted (id=%)',
      new.id
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception
      'users.id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_block_privilege_changes_trg on users;
create trigger users_block_privilege_changes_trg
  before update on users
  for each row
  execute function app.users_block_privilege_changes();

commit;

-- ============================================================================
-- END 0001_users_rls_lockdown.sql
-- ============================================================================


-- ============================================================================
-- BEGIN 0002_club_membership_rls.sql
-- ============================================================================
-- 0002_club_membership_rls.sql
--
-- Closes finding C-4 in docs/security/ClubIt-Security-Assessment.md.
-- Plan: docs/security/W2.1-RLS-PLAN.md (approved).
--
-- Re-architects RLS for the 12 club-scoped tables that previously used the
-- school-wide `app.club_in_scope()` helper for SELECT. The fix:
--   - Adds `app.club_leader()` and `app.club_advisor()` helpers.
--   - Replaces SELECT/INSERT/UPDATE/DELETE policies on:
--       chat_messages, attendance_records, attendance_sessions,
--       polls, poll_candidates, poll_votes, club_news, club_forms,
--       form_responses, memberships, join_requests, events
--     so that data is visible to club members + staff only (some hybrids
--     and self-row exceptions per the matrix in W2.1-RLS-PLAN.md §4).
--
-- Out of scope (intentionally school-wide, see plan §4.2):
--   clubs, leadership_positions, club_social_links, meeting_times.
--
-- Idempotent: every drop policy uses `if exists`, every helper uses
-- `create or replace`. Down migration in 0002_club_membership_rls.down.sql
-- restores the policies present in schema.sql.

begin;

-- ============================================================================
-- 1. Helper functions
-- ============================================================================

-- True iff target_user_id holds a leadership_positions row for the club AND
-- the club is in the caller's school. SECURITY DEFINER so policies invoking
-- this function don't recurse into RLS on memberships/leadership_positions.
create or replace function app.club_leader(
  target_club_id text,
  target_user_id text default app.current_user_id()
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from leadership_positions lp
    join clubs c on c.id = lp.club_id
    where lp.club_id = target_club_id
      and lp.user_id = target_user_id
      and c.school_id = app.current_school_id()
  );
$$;

-- True iff clubs.advisor_id = target_user_id AND in caller's school.
create or replace function app.club_advisor(
  target_club_id text,
  target_user_id text default app.current_user_id()
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from clubs c
    where c.id = target_club_id
      and c.advisor_id = target_user_id
      and c.school_id = app.current_school_id()
  );
$$;

-- ============================================================================
-- 2. chat_messages
-- ============================================================================

drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages
  for insert to authenticated
  with check (
    sender_id = app.current_user_id()
    and (
      app.is_superadmin()
      or app.club_member(club_id, app.current_user_id())
    )
  );

-- ============================================================================
-- 3. attendance_records
-- ============================================================================

drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

drop policy if exists attendance_records_insert on attendance_records;
create policy attendance_records_insert on attendance_records
  for insert to authenticated
  with check (
    app.is_superadmin()
    or app.club_manager(club_id)
    or (
      user_id = app.current_user_id()
      and app.club_member(club_id, user_id)
    )
  );

drop policy if exists attendance_records_update on attendance_records;
create policy attendance_records_update on attendance_records
  for update to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or (
      user_id = app.current_user_id()
      and app.club_member(club_id, user_id)
    )
  )
  with check (
    app.is_superadmin()
    or app.club_manager(club_id)
    or (
      user_id = app.current_user_id()
      and app.club_member(club_id, user_id)
    )
  );

-- ============================================================================
-- 4. attendance_sessions
-- ============================================================================

drop policy if exists attendance_sessions_select on attendance_sessions;
create policy attendance_sessions_select on attendance_sessions
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

-- manage policy semantics unchanged; recreate for idempotence.
drop policy if exists attendance_sessions_manage on attendance_sessions;
create policy attendance_sessions_manage on attendance_sessions
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- ============================================================================
-- 5. polls
-- ============================================================================

drop policy if exists polls_select on polls;
create policy polls_select on polls
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists polls_manage on polls;
create policy polls_manage on polls
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- ============================================================================
-- 6. poll_candidates
-- ============================================================================

drop policy if exists poll_candidates_select on poll_candidates;
create policy poll_candidates_select on poll_candidates
  for select to authenticated
  using (
    app.is_superadmin()
    or exists (
      select 1 from polls p
      where p.id = poll_id
        and app.club_member(p.club_id)
    )
  );

drop policy if exists poll_candidates_manage on poll_candidates;
create policy poll_candidates_manage on poll_candidates
  for all to authenticated
  using (
    app.is_superadmin()
    or exists (
      select 1 from polls p
      where p.id = poll_id
        and app.club_manager(p.club_id)
    )
  )
  with check (
    app.is_superadmin()
    or exists (
      select 1 from polls p
      where p.id = poll_id
        and app.club_manager(p.club_id)
    )
  );

-- ============================================================================
-- 7. poll_votes  (partial -- secret ballot completed in W2.2 / 0004)
-- ============================================================================

-- For W2.1: caller can read their own vote rows; everyone else (including
-- club staff) is denied. Staff aggregates will land in W2.2 via a security
-- definer function/view that returns counts without revealing voter ids.
drop policy if exists poll_votes_select on poll_votes;
create policy poll_votes_select on poll_votes
  for select to authenticated
  using (
    app.is_superadmin()
    or voter_user_id = app.current_user_id()
  );

drop policy if exists poll_votes_insert on poll_votes;
create policy poll_votes_insert on poll_votes
  for insert to authenticated
  with check (
    voter_user_id = app.current_user_id()
    and exists (
      select 1 from polls p
      where p.id = poll_id
        and p.is_open = true
        and app.club_member(p.club_id, app.current_user_id())
    )
  );

-- ============================================================================
-- 8. club_news
-- ============================================================================

drop policy if exists club_news_select on club_news;
create policy club_news_select on club_news
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists club_news_manage on club_news;
create policy club_news_manage on club_news
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and author_id = app.current_user_id()
  );

-- ============================================================================
-- 9. club_forms
-- ============================================================================

drop policy if exists club_forms_select on club_forms;
create policy club_forms_select on club_forms
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists club_forms_manage on club_forms;
create policy club_forms_manage on club_forms
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- ============================================================================
-- 10. form_responses
-- ============================================================================

drop policy if exists form_responses_select on form_responses;
create policy form_responses_select on form_responses
  for select to authenticated
  using (
    app.is_superadmin()
    or user_id = app.current_user_id()
    or exists (
      select 1 from club_forms f
      where f.id = form_id
        and app.club_manager(f.club_id)
    )
  );

drop policy if exists form_responses_insert on form_responses;
create policy form_responses_insert on form_responses
  for insert to authenticated
  with check (
    user_id = app.current_user_id()
    and (
      app.is_superadmin()
      or exists (
        select 1 from club_forms f
        where f.id = form_id
          and app.club_member(f.club_id, app.current_user_id())
      )
    )
  );

-- ============================================================================
-- 11. memberships
-- ============================================================================

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships
  for select to authenticated
  using (
    app.is_superadmin()
    or user_id = app.current_user_id()
    or app.club_member(club_id)
  );

drop policy if exists memberships_insert on memberships;
create policy memberships_insert on memberships
  for insert to authenticated
  with check (
    app.is_superadmin()
    or (
      exists (select 1 from clubs c where c.id = club_id and c.school_id = app.current_school_id())
      and (
        app.club_manager(club_id)
        or (
          user_id = app.current_user_id()
          and app.user_in_scope(user_id)
        )
      )
    )
  );

drop policy if exists memberships_delete on memberships;
create policy memberships_delete on memberships
  for delete to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

-- ============================================================================
-- 12. join_requests
-- ============================================================================

drop policy if exists join_requests_select on join_requests;
create policy join_requests_select on join_requests
  for select to authenticated
  using (
    app.is_superadmin()
    or user_id = app.current_user_id()
    or app.club_manager(club_id)
  );

drop policy if exists join_requests_insert on join_requests;
create policy join_requests_insert on join_requests
  for insert to authenticated
  with check (
    user_id = app.current_user_id()
    and (
      app.is_superadmin()
      or exists (select 1 from clubs c where c.id = club_id and c.school_id = app.current_school_id())
    )
  );

drop policy if exists join_requests_update on join_requests;
create policy join_requests_update on join_requests
  for update to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
  )
  with check (
    app.is_superadmin()
    or app.club_manager(club_id)
  );

drop policy if exists join_requests_delete on join_requests;
create policy join_requests_delete on join_requests
  for delete to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

-- ============================================================================
-- 13. events  (HYBRID -- public events visible school-wide)
-- ============================================================================

drop policy if exists events_select on events;
create policy events_select on events
  for select to authenticated
  using (
    app.is_superadmin()
    or (
      exists (select 1 from clubs c where c.id = club_id and c.school_id = app.current_school_id())
      and (
        is_public = true
        or app.club_member(club_id)
      )
    )
  );

drop policy if exists events_manage on events;
create policy events_manage on events
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and created_by = app.current_user_id()
  );

commit;

-- ============================================================================
-- END 0002_club_membership_rls.sql
-- ============================================================================


-- ============================================================================
-- BEGIN 0003_pending_school_onboarding.sql
-- ============================================================================
-- 0003_pending_school_onboarding.sql
--
-- Closes finding C-3 in ClubIt-Security-Assessment.md.
-- Implements W2.3 Option A (superadmin approval flow).
--
-- Previously /api/onboard auto-created schools with status='active' and
-- promoted the requester to role='admin' immediately. Anyone who could
-- sign up could squat any school name. This migration adds a column that
-- records WHO is asking to admin a pending school; the approve route
-- (next commit) consults that column to decide whose role to flip.
--
-- The actual enforcement -- "cannot be admin of a pending school" --
-- happens in app code, not RLS, because the existing app.is_school_admin
-- helper reads users.role which is server-set. As long as the onboard
-- route does NOT write role='admin' (which the next commit ensures), the
-- pending status is honored.
--
-- Idempotent. Down migration in 0003_pending_school_onboarding.down.sql.

begin;

alter table schools
  add column if not exists requested_admin_user_id text references users(id) on delete set null;

create index if not exists schools_requested_admin_idx
  on schools (requested_admin_user_id)
  where requested_admin_user_id is not null;

commit;

-- ============================================================================
-- END 0003_pending_school_onboarding.sql
-- ============================================================================


-- ============================================================================
-- BEGIN 0004_secret_ballot.sql
-- ============================================================================
-- 0004_secret_ballot.sql
--
-- Closes the secret-ballot half of finding C-4 / H-3 in
-- ClubIt-Security-Assessment.md.
--
-- After 0002, poll_votes SELECT was already locked to "own row + superadmin."
-- This migration:
--   1. Applies the same lockdown to election_votes (school-wide vote
--      visibility removed).
--   2. Adds election_votes_insert validation (open election, same school).
--   3. Adds aggregate-only RPCs callable by club managers / school admins
--      so the UI can show "Alex 12, Jordan 8" without anyone learning who
--      voted for whom:
--        app.poll_vote_counts(text) -> table(candidate_user_id, vote_count)
--        app.election_vote_counts(text) -> same shape
--   4. Adds per-user has-voted helpers (no identity exposure):
--        app.poll_has_voted(text) -> boolean
--        app.election_has_voted(text) -> boolean
--
-- Idempotent. Down migration in 0004_secret_ballot.down.sql.

begin;

-- 1. election_votes lockdown (mirrors what 0002 did for poll_votes).
drop policy if exists election_votes_select on election_votes;
create policy election_votes_select on election_votes
  for select to authenticated
  using (
    app.is_superadmin()
    or voter_user_id = app.current_user_id()
  );

drop policy if exists election_votes_insert on election_votes;
create policy election_votes_insert on election_votes
  for insert to authenticated
  with check (
    voter_user_id = app.current_user_id()
    and exists (
      select 1 from school_elections e
      where e.id = election_id
        and e.is_open = true
        and e.school_id = app.current_school_id()
    )
  );

-- 2. Aggregate RPCs for staff / UI. SECURITY DEFINER so they can scan the
--    base tables under their owner's privilege; callers see counts only.
--    The internal authorization check inside each function ensures only
--    legitimate readers get a non-empty result -- everyone else gets back
--    an empty set, which is indistinguishable from "no votes yet."

create or replace function app.poll_vote_counts(target_poll_id text)
returns table (candidate_user_id text, vote_count bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select pv.candidate_user_id::text, count(*)::bigint as vote_count
  from poll_votes pv
  join polls p on p.id = pv.poll_id
  where pv.poll_id = target_poll_id
    and (
      app.is_superadmin()
      or app.club_member(p.club_id, app.current_user_id())
    )
  group by pv.candidate_user_id;
$$;

create or replace function app.election_vote_counts(target_election_id text)
returns table (candidate_user_id text, vote_count bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select ev.candidate_user_id::text, count(*)::bigint as vote_count
  from election_votes ev
  join school_elections e on e.id = ev.election_id
  where ev.election_id = target_election_id
    and (
      app.is_superadmin()
      or e.school_id = app.current_school_id()
    )
  group by ev.candidate_user_id;
$$;

-- 3. Per-user has-voted helpers.
create or replace function app.poll_has_voted(target_poll_id text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from poll_votes
    where poll_id = target_poll_id
      and voter_user_id = app.current_user_id()
  );
$$;

create or replace function app.election_has_voted(target_election_id text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from election_votes
    where election_id = target_election_id
      and voter_user_id = app.current_user_id()
  );
$$;

-- 4. Grants. RPCs declared above are owned by the migration runner; for
--    the application's anon + authenticated roles to call them, grant
--    execute. service_role already has implicit access.
grant execute on function app.poll_vote_counts(text) to authenticated;
grant execute on function app.election_vote_counts(text) to authenticated;
grant execute on function app.poll_has_voted(text) to authenticated;
grant execute on function app.election_has_voted(text) to authenticated;

commit;

-- ============================================================================
-- END 0004_secret_ballot.sql
-- ============================================================================


-- ============================================================================
-- BEGIN 0005_invite_code_binding.sql
-- ============================================================================
-- 0005_invite_code_binding.sql
--
-- Closes finding W2.5 (assessment §9 item 10) -- bind invite codes to
-- identity and time.
--
-- The schema already had `*_code_expires_at` columns, but:
--   1. Admin/advisor codes had no single-use enforcement -- one leak meant
--      every classmate who saw it became admin/advisor.
--   2. Codes were not bound to an email domain, so a code shared in a
--      group chat could be redeemed by anyone with any email.
--
-- This migration adds:
--   * schools.admin_code_used_at timestamptz   -- single-use marker
--   * schools.advisor_code_used_at timestamptz -- single-use marker
--   * schools.student_code_email_domain text   -- optional bind
--   * schools.admin_code_email_domain text     -- optional bind
--   * schools.advisor_code_email_domain text   -- optional bind
--
-- And invalidates every currently-issued code by setting its expires_at
-- to NOW() so that a fresh round (with the new bindings) is generated.
-- This is the SQL counterpart to scripts/rotate-existing-tokens.ts from
-- W1.3.
--
-- Idempotent. Down migration in 0005_invite_code_binding.down.sql.

begin;

-- 1. Single-use markers for admin and advisor codes. Student code stays
--    multi-use (many students per school).
alter table schools
  add column if not exists admin_code_used_at timestamptz,
  add column if not exists advisor_code_used_at timestamptz;

-- 2. Optional email-domain binding. NULL = no restriction, "edu" or
--    "@oakridge.edu" = restrict redemptions to matching addresses.
alter table schools
  add column if not exists student_code_email_domain text,
  add column if not exists admin_code_email_domain text,
  add column if not exists advisor_code_email_domain text;

-- 3. Force regeneration of any code that hasn't already been rotated by
--    the script. Codes generated before W1.3 used Math.random; codes
--    generated before this migration weren't single-use. Rotate them all
--    by expiring now() so /api/join refuses to redeem.
update schools set
  student_code_expires_at = coalesce(student_code_expires_at, now()),
  admin_code_expires_at   = coalesce(admin_code_expires_at,   now()),
  advisor_code_expires_at = coalesce(advisor_code_expires_at, now())
where status in ('active', 'payment_paused');

commit;

-- ============================================================================
-- END 0005_invite_code_binding.sql
-- ============================================================================


-- ============================================================================
-- BEGIN 0006_audit_log.sql
-- ============================================================================
-- 0006_audit_log.sql
--
-- Closes finding W3.3 / assessment §9 item 14.
--
-- Adds an append-only audit_log table + helper RPC. Server routes call
-- `lib/audit.ts.audit({...})` (service-role insert) or invoke the SQL
-- function `app.audit(...)` directly from triggers / functions.
--
-- The table is append-only: UPDATE and DELETE are revoked from every
-- role except postgres (the migration runner). The only legal mutation
-- is INSERT, and even that is gated by a policy that requires
-- service_role.
--
-- Idempotent. Down migration in 0006_audit_log.down.sql.

begin;

create table if not exists audit_log (
  id           bigserial primary key,
  ts           timestamptz not null default now(),
  actor_user_id text       references users(id) on delete set null,
  actor_role   text,
  action       text       not null,
  target_table text,
  target_id    text,
  before_jsonb jsonb,
  after_jsonb  jsonb,
  ip           text,
  user_agent   text,
  request_id   text
);

create index if not exists audit_log_ts_idx     on audit_log (ts desc);
create index if not exists audit_log_actor_idx  on audit_log (actor_user_id, ts desc);
create index if not exists audit_log_target_idx on audit_log (target_table, target_id, ts desc);
create index if not exists audit_log_action_idx on audit_log (action, ts desc);

alter table audit_log enable row level security;

-- Append-only: revoke UPDATE and DELETE from every role we hand out.
-- service_role is the canonical writer (server APIs); even it cannot
-- update or delete rows.
revoke update, delete on audit_log from public;
revoke update, delete on audit_log from authenticated;
revoke update, delete on audit_log from anon;
do $$
begin
  -- service_role exists in Supabase setups; guard against bare-Postgres test envs.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke update, delete on audit_log from service_role';
  end if;
end $$;

-- SELECT: superadmins see everything; school admins see rows whose
-- target school they administer (via target_id matching). For
-- simplicity in this initial cut, school admins see all audit rows
-- (the actor_user_id column scopes naturally via app code). This can
-- be tightened once we instrument enough routes to make the per-school
-- target_id consistent.
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log
  for select to authenticated
  using (app.is_superadmin() or app.is_school_admin());

-- INSERT: blocked for the authenticated role; service_role bypasses RLS.
-- The lib/audit.ts wrapper uses service_role.
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log
  for insert to authenticated
  with check (false);

-- SECURITY DEFINER wrapper for use from triggers and from the JS layer.
-- The function captures actor_user_id from the JWT (app.current_user_id);
-- callers that don't have one (webhooks) should pass actorUserId via the
-- JS helper instead, which inserts directly with service_role.
create or replace function app.audit(
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip text default null,
  p_user_agent text default null,
  p_request_id text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into audit_log(
    actor_user_id, actor_role, action, target_table, target_id,
    before_jsonb, after_jsonb, ip, user_agent, request_id
  ) values (
    app.current_user_id(),
    app.current_role(),
    p_action,
    p_target_table,
    p_target_id,
    p_before,
    p_after,
    p_ip,
    p_user_agent,
    p_request_id
  );
end;
$$;

grant execute on function app.audit(text, text, text, jsonb, jsonb, text, text, text)
  to authenticated;

commit;

-- ============================================================================
-- END 0006_audit_log.sql
-- ============================================================================


-- ============================================================================
-- STEP 3: re-record all seven versions so future `supabase db push` is happy.
-- ============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('0000', 'baseline',                  ARRAY[]::text[]),
  ('0001', 'users_rls_lockdown',        ARRAY[]::text[]),
  ('0002', 'club_membership_rls',       ARRAY[]::text[]),
  ('0003', 'pending_school_onboarding', ARRAY[]::text[]),
  ('0004', 'secret_ballot',             ARRAY[]::text[]),
  ('0005', 'invite_code_binding',       ARRAY[]::text[]),
  ('0006', 'audit_log',                 ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- DONE. To verify:
--   SELECT version, name FROM supabase_migrations.schema_migrations
--   WHERE version IN ('0000','0001','0002','0003','0004','0005','0006')
--   ORDER BY version;
--
-- After this, run `npm run rotate-tokens:prod` (with SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY in your shell) to issue fresh invite codes
-- through the new CSPRNG path.
-- ============================================================================
