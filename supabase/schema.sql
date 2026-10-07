-- =============================================================================
-- FormBridge.ai — Supabase / PostgreSQL schema (module 1)
--
-- Scope: Indian residents (freelancers, contractors, agencies) invoicing US
-- clients. Tracks dual-currency export invoices (GST LUT / zero-rated),
-- US withholding (W-8BEN / 1042-S), Indian FTC claims (Form 67 -> Form 44),
-- and AI OCR runs over uploaded tax documents.
--
-- Regime cutover baked into the model (verified Oct 2026):
--   * Income up to FY 2025-26  -> Income-tax Act 1961, FTC via Form 67 (Rule 128),
--                                  credit statement = Form 26AS / AIS.
--   * Tax year 2026-27 onwards -> Income-tax Act 2025, FTC via Form 44 (Rule 76),
--                                  credit statement = Form 168.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent where cheap.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type entity_kind        as enum ('individual', 'proprietorship', 'llp', 'private_limited', 'other');
  create type plan_tier          as enum ('free', 'pro', 'agency');
  create type w8_form_type       as enum ('W-8BEN', 'W-8BEN-E');
  create type export_mode        as enum ('lut_without_igst', 'igst_paid_refund', 'not_registered');
  create type invoice_status     as enum ('draft', 'issued', 'partially_paid', 'paid', 'void');
  create type fx_rate_source     as enum ('rbi_reference', 'cbic_notified', 'sbi_tt_buying', 'bank_actual', 'manual');
  create type ftc_form           as enum ('form_67', 'form_44');
  create type ftc_status         as enum ('not_applicable', 'pending', 'ready', 'filed', 'rejected');
  create type document_type      as enum (
    'form_1042s', 'form_1099_nec', 'form_1099_misc', 'remittance_advice',
    'firc', 'ebrc', 'form_26as', 'form_168', 'ais', 'tis',
    'w8ben', 'w8ben_e', 'trc', 'form_10f', 'other'
  );
  create type document_status    as enum ('uploaded', 'processing', 'parsed', 'needs_review', 'verified', 'failed');
  create type ocr_run_status     as enum ('running', 'succeeded', 'refused', 'invalid_output', 'failed');
  create type recon_status       as enum ('matched', 'amount_mismatch', 'missing_in_india', 'missing_in_us', 'manual_override');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Indian financial / tax year label for a date: 2026-05-10 -> '2026-27'.
create or replace function public.indian_fy(d date)
returns text language sql immutable parallel safe as $$
  select case
    when extract(month from d) >= 4
      then extract(year from d)::int || '-' || lpad(((extract(year from d)::int + 1) % 100)::text, 2, '0')
    else (extract(year from d)::int - 1) || '-' || lpad((extract(year from d)::int % 100)::text, 2, '0')
  end
$$;

-- Which FTC form applies to income of a given Indian FY.
create or replace function public.ftc_form_for_fy(fy text)
returns ftc_form language sql immutable parallel safe as $$
  select case when split_part(fy, '-', 1)::int >= 2026 then 'form_44'::ftc_form else 'form_67'::ftc_form end
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- -----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               citext,
  legal_name          text,
  trade_name          text,
  entity_kind         entity_kind not null default 'individual',
  -- PAN is sensitive: store masked + keyed hash only; full value lives in Vault if ever needed.
  pan_masked          text check (pan_masked ~ '^[A-Z]{5}\*{4}[A-Z]$' or pan_masked is null),
  pan_hash            text,
  gstin               text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' or gstin is null),
  state_code          char(2),                      -- first 2 digits of GSTIN / state of registration
  address             jsonb not null default '{}'::jsonb,
  us_tin              text,                         -- ITIN/SSN if any (rare); masked in UI
  plan                plan_tier not null default 'free',
  stripe_customer_id  text,
  razorpay_customer_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- lut_registrations: GST RFD-11 LUT, valid for exactly one Indian FY
-- -----------------------------------------------------------------------------
create table if not exists public.lut_registrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  financial_year text not null check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  arn           text not null,                       -- Application Reference Number from GST portal
  filed_on      date not null,
  document_id   uuid,                                -- FK added after documents table
  created_at    timestamptz not null default now(),
  unique (user_id, financial_year)
);

-- -----------------------------------------------------------------------------
-- clients: US (or other foreign) customers
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  legal_name      text not null,
  country_code    char(2) not null default 'US',     -- ISO-3166 alpha-2
  us_ein          text check (us_ein ~ '^[0-9]{2}-?[0-9]{7}$' or us_ein is null),
  billing_email   citext,
  ap_contact_name text,
  address         jsonb not null default '{}'::jsonb,
  vendor_id       text,                              -- client's internal vendor/supplier number (US AP format)
  po_required     boolean not null default false,
  payment_terms_days int not null default 30 check (payment_terms_days between 0 and 180),
  -- Where services are physically performed drives US sourcing (IRC 861/862):
  -- 100% outside the US => foreign-source => no US withholding, no 1042-S expected.
  services_performed_in_us boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists clients_user_idx on public.clients (user_id);

-- -----------------------------------------------------------------------------
-- w8_certifications: W-8BEN / W-8BEN-E furnished by the user to each client
-- Valid until 31 Dec of the third calendar year after signing (absent a change
-- in circumstances).
-- -----------------------------------------------------------------------------
create table if not exists public.w8_certifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  client_id         uuid not null references public.clients (id) on delete cascade,
  form_type         w8_form_type not null,
  signed_on         date not null,
  expires_on        date generated always as
                      (make_date(extract(year from signed_on)::int + 3, 12, 31)) stored,
  foreign_tin       text,                              -- PAN, masked
  treaty_country    char(2) not null default 'IN',
  treaty_article    text,                              -- e.g. '15' (independent personal services), '12' (FIS)
  treaty_rate_pct   numeric(5,2) check (treaty_rate_pct between 0 and 30),
  income_type_claimed text,
  lob_code          text,                              -- W-8BEN-E Part III limitation-on-benefits
  document_id       uuid,
  created_at        timestamptz not null default now()
);
create index if not exists w8_user_client_idx on public.w8_certifications (user_id, client_id);

-- -----------------------------------------------------------------------------
-- invoices: dual-currency, GST-export + US-AP compliant
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete restrict,
  invoice_number      text not null check (char_length(invoice_number) <= 16),  -- GST Rule 46: <=16 chars, unique per FY
  invoice_date        date not null,
  financial_year      text generated always as (public.indian_fy(invoice_date)) stored,
  due_date            date,
  po_number           text,
  export_mode         export_mode not null default 'lut_without_igst',
  lut_id              uuid references public.lut_registrations (id),
  place_of_supply     text not null default '96-Other Country',   -- GST state code 96 = outside India
  sac_code            text not null default '998314',             -- IT design & development services; edit per service
  currency            char(3) not null default 'USD',
  subtotal_fcy        numeric(14,2) not null check (subtotal_fcy >= 0),
  -- Rate used to value the supply in INR for GSTR-1 Table 6A; source recorded for audit.
  fx_rate_inr         numeric(12,4) not null check (fx_rate_inr > 0),
  fx_rate_source      fx_rate_source not null default 'rbi_reference',
  fx_rate_date        date not null,
  subtotal_inr        numeric(16,2) generated always as (round(subtotal_fcy * fx_rate_inr, 2)) stored,
  igst_rate_pct       numeric(5,2) not null default 0,
  igst_amount_inr     numeric(16,2) not null default 0,
  status              invoice_status not null default 'draft',
  -- Rule 46 endorsement, e.g. 'SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX'
  gst_declaration     text,
  pdf_document_id     uuid,
  issued_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, financial_year, invoice_number),
  constraint lut_requires_ref check (export_mode <> 'lut_without_igst' or status = 'draft' or lut_id is not null),
  constraint lut_means_zero_igst check (export_mode <> 'lut_without_igst' or igst_amount_inr = 0)
);
create index if not exists invoices_user_fy_idx on public.invoices (user_id, financial_year);
create index if not exists invoices_client_idx on public.invoices (client_id);

create table if not exists public.invoice_line_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,  -- denormalised for RLS
  position      int  not null default 0,
  description   text not null,
  sac_code      text,
  quantity      numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_fcy numeric(14,2) not null check (unit_price_fcy >= 0),
  amount_fcy    numeric(14,2) generated always as (round(quantity * unit_price_fcy, 2)) stored
);
create index if not exists line_items_invoice_idx on public.invoice_line_items (invoice_id);

-- -----------------------------------------------------------------------------
-- payments: inward remittances realised against invoices (FIRC / e-BRC proof)
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  invoice_id          uuid references public.invoices (id) on delete set null,
  client_id           uuid references public.clients (id) on delete set null,
  received_on         date not null,
  financial_year      text generated always as (public.indian_fy(received_on)) stored,
  amount_fcy          numeric(14,2) not null check (amount_fcy >= 0),
  currency            char(3) not null default 'USD',
  intermediary_fees_fcy numeric(14,2) not null default 0,         -- Wise/Skydo/PayPal/bank charges
  amount_inr_credited numeric(16,2) not null check (amount_inr_credited >= 0),
  effective_fx_rate   numeric(12,4) generated always as
                        (case when amount_fcy - intermediary_fees_fcy > 0
                              then round(amount_inr_credited / (amount_fcy - intermediary_fees_fcy), 4) end) stored,
  rbi_purpose_code    text,                                         -- e.g. P0802 software consultancy
  firc_number         text,
  ebrc_number         text,
  bank_reference      text,
  document_id         uuid,
  created_at          timestamptz not null default now()
);
create index if not exists payments_user_fy_idx on public.payments (user_id, financial_year);

-- -----------------------------------------------------------------------------
-- documents: uploaded files in Supabase Storage bucket 'tax-documents'
-- Object path convention: '<user_id>/<document_id>/<original_filename>'
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete set null,
  doc_type        document_type not null default 'other',
  storage_path    text not null unique,
  original_name   text not null,
  mime_type       text not null check (mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024),
  sha256          text,
  tax_year        int,                         -- US calendar year for US slips
  financial_year  text,                        -- Indian FY for Indian statements
  status          document_status not null default 'uploaded',
  latest_ocr_run_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint storage_path_owned check (split_part(storage_path, '/', 1) = user_id::text)
);
create index if not exists documents_user_type_idx on public.documents (user_id, doc_type);
create unique index if not exists documents_user_sha_idx on public.documents (user_id, sha256) where sha256 is not null;

-- Deferred FKs to documents
do $$ begin
  alter table public.lut_registrations add constraint lut_document_fk
    foreign key (document_id) references public.documents (id) on delete set null;
  alter table public.w8_certifications add constraint w8_document_fk
    foreign key (document_id) references public.documents (id) on delete set null;
  alter table public.invoices add constraint invoice_pdf_fk
    foreign key (pdf_document_id) references public.documents (id) on delete set null;
  alter table public.payments add constraint payment_document_fk
    foreign key (document_id) references public.documents (id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- ocr_runs: one row per AI extraction attempt (audit trail, cost tracking)
-- -----------------------------------------------------------------------------
create table if not exists public.ocr_runs (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.documents (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  provider          text not null default 'anthropic',
  model             text not null,
  schema_version    text not null,
  status            ocr_run_status not null default 'running',
  detected_doc_type document_type,
  extracted         jsonb,                     -- strict-schema JSON from the model
  validation_issues jsonb not null default '[]'::jsonb,  -- deterministic post-checks
  overall_confidence numeric(4,3) check (overall_confidence between 0 and 1),
  input_tokens      int,
  output_tokens     int,
  latency_ms        int,
  error_message     text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);
create index if not exists ocr_runs_document_idx on public.ocr_runs (document_id, created_at desc);

do $$ begin
  alter table public.documents add constraint documents_latest_ocr_fk
    foreign key (latest_ocr_run_id) references public.ocr_runs (id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- tax_withholdings: US tax withheld (1042-S / remittance advice) and its
-- conversion into an Indian Foreign Tax Credit claim.
-- -----------------------------------------------------------------------------
create table if not exists public.tax_withholdings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  client_id             uuid references public.clients (id) on delete set null,
  source_document_id    uuid references public.documents (id) on delete set null,
  source_ocr_run_id     uuid references public.ocr_runs (id) on delete set null,
  -- US side (Form 1042-S box references)
  us_tax_year           int not null check (us_tax_year between 2015 and 2100),
  unique_form_identifier text,                 -- 1042-S UFI, unique per withholding agent per year
  is_amended            boolean not null default false,
  income_code           text,                  -- box 1 (17 = independent personal services)
  gross_income_usd      numeric(14,2) not null check (gross_income_usd >= 0),  -- box 2
  chapter_indicator     smallint check (chapter_indicator in (3, 4)),          -- box 3
  ch3_exemption_code    text,                  -- box 3a ('04' = treaty, '00' = not exempt)
  ch3_tax_rate_pct      numeric(5,2),          -- box 3b
  federal_tax_withheld_usd numeric(14,2) not null default 0 check (federal_tax_withheld_usd >= 0), -- box 7a
  total_withholding_credit_usd numeric(14,2), -- box 10
  withholding_agent_ein text,                  -- box 12a
  withholding_agent_name text,                 -- box 12d
  recipient_country_code text,                 -- box 13b (IRS code 'IN' = India)
  recipient_foreign_tin text,                  -- box 13i, masked
  withheld_on           date,                  -- payment date per remittance advice (for TT rate lookup)
  -- India side: Rule 128 (old) / Rule 76 (new) — convert at SBI TT buying rate on the
  -- last day of the month immediately preceding the month of deduction.
  indian_fy             text,
  ftc_form              ftc_form generated always as
                          (case when indian_fy is not null then public.ftc_form_for_fy(indian_fy) end) stored,
  dtaa_article          text,
  dtaa_rate_cap_pct     numeric(5,2),
  sbi_tt_rate           numeric(12,4),
  sbi_tt_rate_date      date,
  tax_withheld_inr      numeric(16,2) generated always as
                          (case when sbi_tt_rate is not null then round(federal_tax_withheld_usd * sbi_tt_rate, 2) end) stored,
  -- FTC is capped at the lower of foreign tax paid and Indian tax attributable to that income.
  indian_tax_on_income_inr numeric(16,2),
  ftc_allowable_inr     numeric(16,2),
  ftc_status            ftc_status not null default 'pending',
  refund_claimable_usd  numeric(14,2),         -- over-withholding recoverable via 1040-NR
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists withholdings_user_fy_idx on public.tax_withholdings (user_id, indian_fy);
create unique index if not exists withholdings_ufi_idx
  on public.tax_withholdings (user_id, withholding_agent_ein, us_tax_year, unique_form_identifier)
  where unique_form_identifier is not null and not is_amended;

-- -----------------------------------------------------------------------------
-- reconciliation_matches: link US-side evidence to India-side evidence
-- -----------------------------------------------------------------------------
create table if not exists public.reconciliation_matches (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  financial_year      text not null,
  withholding_id      uuid references public.tax_withholdings (id) on delete cascade,
  invoice_id          uuid references public.invoices (id) on delete set null,
  payment_id          uuid references public.payments (id) on delete set null,
  india_document_id   uuid references public.documents (id) on delete set null,  -- AIS / 26AS / 168 / FIRC
  status              recon_status not null,
  us_amount_usd       numeric(14,2),
  india_amount_inr    numeric(16,2),
  variance_inr        numeric(16,2),
  explanation         text,
  created_at          timestamptz not null default now()
);
create index if not exists recon_user_fy_idx on public.reconciliation_matches (user_id, financial_year);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','clients','invoices','documents','tax_withholdings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- =============================================================================
-- Row-Level Security: every row is owned by exactly one auth user.
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.lut_registrations      enable row level security;
alter table public.clients                enable row level security;
alter table public.w8_certifications      enable row level security;
alter table public.invoices               enable row level security;
alter table public.invoice_line_items     enable row level security;
alter table public.payments               enable row level security;
alter table public.documents              enable row level security;
alter table public.ocr_runs               enable row level security;
alter table public.tax_withholdings       enable row level security;
alter table public.reconciliation_matches enable row level security;

-- profiles: id is the owner; no client-side insert/delete (trigger + cascade handle those).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Owner-only CRUD on user_id-scoped tables.
do $$
declare t text;
begin
  foreach t in array array[
    'lut_registrations','clients','w8_certifications','invoices','invoice_line_items',
    'payments','documents','tax_withholdings','reconciliation_matches'
  ] loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format($p$
      create policy %I_owner_all on public.%I for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $p$, t, t);
  end loop;
end $$;

-- ocr_runs are written by the server route (with the user's JWT) and are
-- append-only from the user's perspective: read + insert + update, no delete.
drop policy if exists ocr_runs_select on public.ocr_runs;
create policy ocr_runs_select on public.ocr_runs for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists ocr_runs_insert on public.ocr_runs;
create policy ocr_runs_insert on public.ocr_runs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.documents d where d.id = document_id and d.user_id = (select auth.uid()))
  );
drop policy if exists ocr_runs_update on public.ocr_runs;
create policy ocr_runs_update on public.ocr_runs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Child rows must point at parents the user owns (prevents cross-tenant FK smuggling).
drop policy if exists line_items_parent_owned on public.invoice_line_items;
create policy line_items_parent_owned on public.invoice_line_items as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = (select auth.uid())));

drop policy if exists invoices_client_owned on public.invoices;
create policy invoices_client_owned on public.invoices as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid())));

drop policy if exists w8_client_owned on public.w8_certifications;
create policy w8_client_owned on public.w8_certifications as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid())));

-- =============================================================================
-- Storage: private bucket, objects namespaced by '<user_id>/...'
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tax-documents', 'tax-documents', false, 20971520,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists tax_docs_select on storage.objects;
create policy tax_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'tax-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists tax_docs_insert on storage.objects;
create policy tax_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tax-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists tax_docs_delete on storage.objects;
create policy tax_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tax-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
