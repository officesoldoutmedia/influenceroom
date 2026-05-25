-- Sprint 11 Faza A: storage bucket + table pentru rapoarte campanie.
--
-- Per (influencer × campanie) via FK obligatoriu la campaign_participants.
-- Denormalizate campaign_id + influencer_id (SET NULL pe delete) pentru
-- query rapid + retentie istoric dupa delete campanie.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-uploads', 'report-uploads', false, 10 * 1024 * 1024,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "report_uploads_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-uploads');
CREATE POLICY "report_uploads_authenticated_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-uploads');
CREATE POLICY "report_uploads_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-uploads');

CREATE TABLE IF NOT EXISTS report_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  influencer_id uuid REFERENCES influencers(id) ON DELETE SET NULL,

  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes int,
  file_mime text,

  kpi_views int,
  kpi_reach int,
  kpi_engagement int,
  kpi_saves int,
  kpi_profile_visits int,
  kpi_link_clicks int,
  kpi_watch_time_sec int,

  notes text,

  uploaded_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES team_members(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (
    (kpi_views IS NULL OR kpi_views >= 0) AND
    (kpi_reach IS NULL OR kpi_reach >= 0) AND
    (kpi_engagement IS NULL OR kpi_engagement >= 0) AND
    (kpi_saves IS NULL OR kpi_saves >= 0) AND
    (kpi_profile_visits IS NULL OR kpi_profile_visits >= 0) AND
    (kpi_link_clicks IS NULL OR kpi_link_clicks >= 0) AND
    (kpi_watch_time_sec IS NULL OR kpi_watch_time_sec >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_report_uploads_participant
  ON report_uploads(participant_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_uploads_campaign
  ON report_uploads(campaign_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_uploads_influencer
  ON report_uploads(influencer_id, uploaded_at DESC);

ALTER TABLE report_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_uploads_read_authn ON report_uploads;
CREATE POLICY report_uploads_read_authn ON report_uploads
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE report_uploads IS
  'Rapoarte incarcate per (influencer x campanie). KPI manual entry in faza A.';
