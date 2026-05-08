-- Sprint 9 Faza 3b — per-participant deliverables.
--
-- A deliverable is a concrete piece of content owed by a campaign
-- participant on a specific platform: e.g. "1 reel + 2 stories" becomes
-- two rows here, one per type, both attached to the same participant_id.
-- Cascade-deletes when its participant is removed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverable_type') THEN
    CREATE TYPE deliverable_type AS ENUM (
      'story', 'reel', 'tiktok', 'carousel', 'post',
      'youtube_long', 'youtube_short', 'live', 'custom'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverable_status') THEN
    CREATE TYPE deliverable_status AS ENUM (
      'draft', 'sent_to_influencer', 'content_in_review',
      'approved', 'published', 'cancelled'
    );
  END IF;
END $$;

CREATE TABLE campaign_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  type deliverable_type NOT NULL,
  custom_type_label text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  post_date date,
  collab_handles text[] NOT NULL DEFAULT '{}',
  hashtags text[] NOT NULL DEFAULT '{}',
  brief text,
  caption text,
  notes text,
  status deliverable_status NOT NULL DEFAULT 'draft',
  published_url text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_published_requires_url CHECK (
    status <> 'published' OR (published_url IS NOT NULL AND post_date IS NOT NULL)
  ),
  CONSTRAINT chk_custom_label CHECK (
    type <> 'custom' OR custom_type_label IS NOT NULL
  )
);

CREATE INDEX idx_deliverables_participant ON campaign_deliverables(participant_id);
CREATE INDEX idx_deliverables_status ON campaign_deliverables(status);
CREATE INDEX idx_deliverables_post_date ON campaign_deliverables(post_date)
  WHERE post_date IS NOT NULL;

-- Reuse the trigger function from migration 021.
CREATE TRIGGER trg_deliverables_updated_at
  BEFORE UPDATE ON campaign_deliverables
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_participants();

ALTER TABLE campaign_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_deliverables_authenticated_read
  ON campaign_deliverables FOR SELECT
  USING (true);
