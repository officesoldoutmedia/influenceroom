-- Migration 039: extend brands with company + industry.
--
-- Feedback echipa (Sprint 14) — brand creation form needs 5 fields total:
--   name (existing, required), company, industry, contact_person (existing),
--   contact_email (existing). company is the legal entity / client behind the
--   brand (e.g. "The Coca-Cola Company" for brand "Coca-Cola"); industry is
--   the FMCG/Tech/Fashion bucket. Both optional — most agencies fill them in
--   over time as relationships mature.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS industry text;

COMMENT ON COLUMN brands.company  IS 'Compania/clientul (poate diferi de brand name).';
COMMENT ON COLUMN brands.industry IS 'Industria/categoria (FMCG, Tech, Fashion, etc.).';
