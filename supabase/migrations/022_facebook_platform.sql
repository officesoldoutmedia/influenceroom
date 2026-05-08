-- Sprint 9 Faza 3a — recognise Facebook as a fourth platform.
--
-- influencers.platforms is a JSONB blob keyed by platform name (no enum
-- constraint at the DB level), so the schema needs no DDL change. Facebook
-- already lives in the social_platform ENUM created by migration 021 for
-- campaign_participants.platform.
--
-- This file exists for changelog continuity (so the migrations folder
-- shows the explicit moment Facebook was admitted as a platform). The
-- corresponding TypeScript change lives in lib/influencers/types.ts —
-- the PLATFORMS const gains 'facebook'.

-- No-op SQL — kept for trace.
SELECT 1;
