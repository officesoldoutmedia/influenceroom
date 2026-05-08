-- Migration 035: rate cards per platform.
--
-- Replaces the four flat numeric columns (rate_post/story/reel/video) with a
-- single JSONB blob keyed by platform. The old columns were ambiguous —
-- "video" was sometimes a Reel, sometimes Usage Rights, sometimes a YouTube
-- insert. Per Oana 2026-05-08 the team needs separate tariffs per platform
-- with platform-appropriate rate types (photo/video/story_set on FB+IG, boost
-- tiers on TikTok, video_insert/shorts/dedicated on YouTube) plus UR-30
-- (Usage Rights 30d) on every platform.
--
-- Whitelisted rate types per platform are enforced application-side
-- (lib/rate-cards/types.ts → RATE_TYPES_PER_PLATFORM). The DB stays permissive
-- so future rate types don't need a migration; the API rejects unknown keys
-- before they hit the column.

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS rate_cards jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN influencers.rate_cards IS
'EUR rate cards per platform. Shape:
 {
   "facebook":  {"photo": n, "video": n, "story_set": n, "ur_30d": n},
   "instagram": {"photo": n, "video": n, "story_set": n, "ur_30d": n},
   "tiktok":    {"video": n, "boost_7d": n, "boost_15d": n, "boost_30d": n, "ur_30d": n},
   "youtube":   {"video_insert": n, "shorts": n, "dedicated": n, "ur_30d": n}
 }
 All keys optional. n = numeric EUR or absent (jsonb_strip_nulls keeps it lean).
 Whitelist of valid rate types per platform enforced in
 lib/rate-cards/types.ts → RATE_TYPES_PER_PLATFORM.';

CREATE INDEX IF NOT EXISTS idx_influencers_rate_cards
  ON influencers USING gin(rate_cards);

-- Backfill existing rows: vechile rate_post/story/reel/video → instagram subset.
-- Per spec mapping: post→photo, story→story_set, reel→video (Reel is the IG
-- video format), video→ur_30d (was used ambiguously, redenumit la UR-30).
UPDATE influencers
   SET rate_cards = jsonb_strip_nulls(jsonb_build_object(
         'instagram', jsonb_strip_nulls(jsonb_build_object(
           'photo', rate_post,
           'story_set', rate_story,
           'video', rate_reel,
           'ur_30d', rate_video
         ))
       ))
 WHERE (rate_post IS NOT NULL OR rate_story IS NOT NULL
        OR rate_reel IS NOT NULL OR rate_video IS NOT NULL)
   AND rate_cards = '{}'::jsonb;

ALTER TABLE influencers
  DROP COLUMN IF EXISTS rate_post,
  DROP COLUMN IF EXISTS rate_story,
  DROP COLUMN IF EXISTS rate_reel,
  DROP COLUMN IF EXISTS rate_video;
