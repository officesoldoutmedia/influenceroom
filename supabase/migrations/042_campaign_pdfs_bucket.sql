-- Sprint 15 Faza 3 §11: bucket pentru PDF-urile generate per campanie + rapoarte bulk.
--
-- Path single: campaign-pdfs/<campaign_id>/<timestamp>-campaign.pdf
-- Path bulk:   campaign-pdfs/_reports/<timestamp>-<from>-<to>.pdf
--
-- Prune logic e în API handler (5 latest per campanie, 10 latest în _reports).
-- Policies: defense-in-depth, server-side foloseşte service_role (Path A).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-pdfs',
  'campaign-pdfs',
  false,
  10 * 1024 * 1024,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "campaign_pdfs_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'campaign-pdfs');

CREATE POLICY "campaign_pdfs_authenticated_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'campaign-pdfs');

CREATE POLICY "campaign_pdfs_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'campaign-pdfs');
