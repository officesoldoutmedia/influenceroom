-- Sprint 11 feedback Oana §2: status nou "invoiced" (Facturat) pentru echipa
-- financiara. Vine dupa "completed" (campania s-a terminat) — semnaleaza ca
-- factura a fost emisa/achitata.

ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft','active','in_review','completed','invoiced','cancelled'));
