-- Migration 036: rate-cards Storage bucket + RLS policies.
--
-- Sprint 13b PDF export drops generated rate-card PDFs in Supabase Storage
-- under `rate-cards/<influencer_id>/<timestamp>-rate-card.pdf`. Public is
-- false so the only way to access objects is via service_role (server-side)
-- or signed URLs (1h TTL minted by the API route). Path A: every server-side
-- code path uses service_role and bypasses RLS — the policies below are
-- defence-in-depth + intent documentation, same pattern as the rest of the
-- schema's `*_authenticated_*` policies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('rate-cards', 'rate-cards', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS rate_cards_authenticated_insert ON storage.objects;
CREATE POLICY rate_cards_authenticated_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'rate-cards' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS rate_cards_authenticated_select ON storage.objects;
CREATE POLICY rate_cards_authenticated_select ON storage.objects
  FOR SELECT USING (bucket_id = 'rate-cards' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS rate_cards_authenticated_delete ON storage.objects;
CREATE POLICY rate_cards_authenticated_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'rate-cards' AND auth.role() = 'authenticated');
