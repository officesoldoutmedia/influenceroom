-- Initial owner seed. Stefan can update self via /admin/team after login.
-- Idempotent — only inserts if email not already present.

INSERT INTO team_members (name, email, pin_hash, role, active)
VALUES ('Stefan Sprianu', 'office@soldoutmedia.ro', hash_pin('1234'), 'owner', true)
ON CONFLICT (email) DO NOTHING;
