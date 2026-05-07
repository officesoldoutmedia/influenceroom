-- Dev seed: placeholder owner. PRD §13 — replace before deploy.

INSERT INTO team_members (name, email, pin_hash, role, active)
VALUES ('Founder', 'founder@influencerroom.local', hash_pin('0000'), 'owner', true)
ON CONFLICT (email) DO NOTHING;
