-- Sprint 11 feedback Oana §3: external rebate per campanie (1 rebate / campanie).
-- Coloane direct pe `campaigns` (NU tabel separat) — pattern simplu, 1:1 cu campania.
-- Daca apare nevoie de N rebate-uri, refactoram la `campaign_rebates` table.
--
-- rebate_type: 'percent' (procent din buget) sau 'fixed' (suma fixa in moneda)
-- rebate_status: 'estimated' (planuit) / 'confirmed' (semnat) / 'paid' (incasat)
-- rebate_applies_to_budget: opt-in explicit ca rebate-ul sa afecteze bugetul afisat
--   (default false — Oana cere ca rebate-ul sa nu afecteze automat bugetul)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rebate_type_enum') THEN
    CREATE TYPE rebate_type_enum AS ENUM ('percent', 'fixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rebate_status_enum') THEN
    CREATE TYPE rebate_status_enum AS ENUM ('estimated', 'confirmed', 'paid');
  END IF;
END $$;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS rebate_agency_name text,
  ADD COLUMN IF NOT EXISTS rebate_type rebate_type_enum,
  ADD COLUMN IF NOT EXISTS rebate_value numeric,
  ADD COLUMN IF NOT EXISTS rebate_currency text DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS rebate_status rebate_status_enum,
  ADD COLUMN IF NOT EXISTS rebate_notes text,
  ADD COLUMN IF NOT EXISTS rebate_applies_to_budget boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN campaigns.rebate_agency_name IS
  'Numele agentiei care a adus campania (text liber, poate diferi de agency_name dack agentia rebate-ului e alta).';
COMMENT ON COLUMN campaigns.rebate_type IS
  'percent = procent din total_budget; fixed = suma absoluta in rebate_currency.';
COMMENT ON COLUMN campaigns.rebate_status IS
  'estimated (planuit) / confirmed (semnat) / paid (incasat).';
COMMENT ON COLUMN campaigns.rebate_applies_to_budget IS
  'Opt-in: cand true, rebate-ul scade din total_budget afisat / utilizat in agregari.';
