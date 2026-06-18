-- Sprint 15 — "Tip PR" per campanie (cerință echipă 2026-06-17): arhetipul de
-- PR al colaborării, ales la creare/editare campanie.
--   pr_seeding   — seeding de produs către mai mulți influenceri (postări organice)
--   pr_blitz     — burst coordonat de postări pe o fereastră scurtă
--   pr_eveniment — PR axat pe participarea la un eveniment
--
-- Coloană direct pe `campaigns` (1:1, ca rebate_* din migrarea 047), opțională,
-- fără logică dependentă deocamdată. ADD COLUMN IF NOT EXISTS = idempotent.
-- Reversibilă la nevoie (DROP COLUMN + DROP TYPE), spre deosebire de enum
-- ADD VALUE. Niciun GRANT necesar — alterăm un tabel existent, nu creăm tabel
-- nou (vezi convenția din CLAUDE.md).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pr_type_enum') THEN
    CREATE TYPE pr_type_enum AS ENUM ('pr_seeding', 'pr_blitz', 'pr_eveniment');
  END IF;
END $$;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pr_type pr_type_enum;

COMMENT ON COLUMN campaigns.pr_type IS
  'Arhetip PR al campaniei: pr_seeding / pr_blitz / pr_eveniment. Opțional, fără logică dependentă.';
