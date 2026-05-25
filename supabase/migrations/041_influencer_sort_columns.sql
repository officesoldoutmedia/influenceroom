-- Sprint 15 Faza 2 §10: coloane derivate pentru sortarea listei /influencers.
--
-- tier_rank   = rank numeric din enum-ul tier (macro=1 → nano=4) ca să putem
--               face ORDER BY ASC fără CASE în query.
-- max_followers = GREATEST din followers-urile per platformă (IG/TT/YT/FB).
--                 Reflectă "reach total" — același semnal pe care îl folosește
--                 trigger-ul trg_influencers_auto_tier (migration 026) pentru
--                 a determina automat tier-ul.
--
-- Ambele sunt GENERATED ALWAYS STORED → recalculate automat la UPDATE pe
-- coloanele sursă. STORED (nu VIRTUAL) e obligatoriu ca să putem crea index.

ALTER TABLE influencers
  ADD COLUMN tier_rank smallint GENERATED ALWAYS AS (
    CASE tier
      WHEN 'macro' THEN 1
      WHEN 'mid'   THEN 2
      WHEN 'micro' THEN 3
      WHEN 'nano'  THEN 4
    END
  ) STORED;

ALTER TABLE influencers
  ADD COLUMN max_followers integer GENERATED ALWAYS AS (
    GREATEST(
      COALESCE((social_handles->'instagram'->>'followers')::int, 0),
      COALESCE((social_handles->'tiktok'->>'followers')::int, 0),
      COALESCE((social_handles->'youtube'->>'followers')::int, 0),
      COALESCE((social_handles->'facebook'->>'followers')::int, 0)
    )
  ) STORED;

CREATE INDEX idx_influencers_tier_rank ON influencers(tier_rank);
CREATE INDEX idx_influencers_max_followers ON influencers(max_followers DESC NULLS LAST);

COMMENT ON COLUMN influencers.tier_rank IS
  'Rank numeric pentru sortare ASC: macro=1, mid=2, micro=3, nano=4. Generated din tier.';
COMMENT ON COLUMN influencers.max_followers IS
  'MAX(followers) din social_handles pe IG/TT/YT/FB. 0 dacă niciuna populat. Generated.';
