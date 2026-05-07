-- Seed: 3 starter campaign templates per PRD §9.
-- T = publish date (the campaign's start_date). due_offset_days is signed
-- relative to T (negative = before publish, positive = after).
-- Idempotent: only inserts if templates table is empty.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM campaign_templates) THEN
    RAISE NOTICE 'campaign_templates already seeded; skipping';
    RETURN;
  END IF;

  INSERT INTO campaign_templates (name, description, default_task_groups) VALUES
  (
    'Brand Collab Standard (IG)',
    'Default 28-day Instagram brand partnership: pitch → brief → production → publish → wrap.',
    $jsonb$
    [
      {
        "name": "Pitch & Negotiation",
        "position": 1,
        "due_offset_days": -21,
        "tasks": [
          {"title": "Identify targets", "role_default": "account", "priority": "normal"},
          {"title": "Draft pitch email", "role_default": "account", "priority": "normal"},
          {"title": "Send pitch", "role_default": "account", "priority": "normal"},
          {"title": "Negotiate fee", "role_default": "account", "priority": "normal"},
          {"title": "Sign contract", "role_default": "manager", "priority": "high"}
        ]
      },
      {
        "name": "Brief & Creative",
        "position": 2,
        "due_offset_days": -14,
        "tasks": [
          {"title": "Deliver brief to creator", "role_default": "account", "priority": "normal"},
          {"title": "Mood-board approved by brand", "role_default": "manager", "priority": "normal"},
          {"title": "Captions/scripts approved", "role_default": "manager", "priority": "normal"}
        ]
      },
      {
        "name": "Production",
        "position": 3,
        "due_offset_days": -7,
        "tasks": [
          {"title": "Shoot scheduled", "role_default": "account", "priority": "normal"},
          {"title": "Content received", "role_default": "account", "priority": "normal"},
          {"title": "Brand approval cycle", "role_default": "manager", "priority": "high"}
        ]
      },
      {
        "name": "Publishing",
        "position": 4,
        "due_offset_days": 0,
        "tasks": [
          {"title": "Scheduled in Meta", "role_default": "account", "priority": "normal"},
          {"title": "Live monitoring first 2h", "role_default": "account", "priority": "high"},
          {"title": "Paid boost (optional)", "role_default": "manager", "priority": "low"}
        ]
      },
      {
        "name": "Reporting & Wrap",
        "position": 5,
        "due_offset_days": 7,
        "tasks": [
          {"title": "Collect metrics", "role_default": "account", "priority": "normal"},
          {"title": "Screenshots", "role_default": "account", "priority": "normal"},
          {"title": "Draft report", "role_default": "account", "priority": "normal"},
          {"title": "Send report to client", "role_default": "manager", "priority": "normal"},
          {"title": "Issue invoice", "role_default": "manager", "priority": "normal"}
        ]
      }
    ]
    $jsonb$::jsonb
  ),
  (
    'TikTok Challenge',
    'Faster ~14-day hashtag challenge with 3-5 creators publishing in a coordinated window.',
    $jsonb$
    [
      {
        "name": "Concept & Cast",
        "position": 1,
        "due_offset_days": -10,
        "tasks": [
          {"title": "Define hashtag", "role_default": "manager", "priority": "normal"},
          {"title": "Cast 3-5 creators", "role_default": "account", "priority": "normal"},
          {"title": "Confirm participation", "role_default": "account", "priority": "normal"}
        ]
      },
      {
        "name": "Brief",
        "position": 2,
        "due_offset_days": -7,
        "tasks": [
          {"title": "Send creative brief", "role_default": "account", "priority": "normal"},
          {"title": "Approve sounds", "role_default": "manager", "priority": "normal"},
          {"title": "Approve outfits/props", "role_default": "manager", "priority": "normal"}
        ]
      },
      {
        "name": "Production",
        "position": 3,
        "due_offset_days": -3,
        "tasks": [
          {"title": "Receive content", "role_default": "account", "priority": "normal"},
          {"title": "Brand approval", "role_default": "manager", "priority": "high"}
        ]
      },
      {
        "name": "Launch",
        "position": 4,
        "due_offset_days": 0,
        "tasks": [
          {"title": "Coordinated post window", "role_default": "account", "priority": "high"},
          {"title": "Boost top-performer at +24h", "role_default": "account", "priority": "normal"}
        ]
      },
      {
        "name": "Wrap",
        "position": 5,
        "due_offset_days": 5,
        "tasks": [
          {"title": "Collect metrics", "role_default": "account", "priority": "normal"},
          {"title": "Report", "role_default": "account", "priority": "normal"},
          {"title": "Invoice", "role_default": "manager", "priority": "normal"}
        ]
      }
    ]
    $jsonb$::jsonb
  ),
  (
    'YouTube Long-form Sponsorship',
    'Extended ~56-day integrated YouTube sponsorship with full creative review cycles.',
    $jsonb$
    [
      {
        "name": "Outreach",
        "position": 1,
        "due_offset_days": -49,
        "tasks": [
          {"title": "Pitch creators", "role_default": "account", "priority": "normal"},
          {"title": "Negotiate flat + CPM", "role_default": "manager", "priority": "normal"},
          {"title": "Contract signed", "role_default": "manager", "priority": "high"}
        ]
      },
      {
        "name": "Brief",
        "position": 2,
        "due_offset_days": -35,
        "tasks": [
          {"title": "Brief delivered", "role_default": "account", "priority": "normal"},
          {"title": "Talking points approved", "role_default": "manager", "priority": "normal"},
          {"title": "Disclosures aligned", "role_default": "manager", "priority": "normal"}
        ]
      },
      {
        "name": "Production",
        "position": 3,
        "due_offset_days": -21,
        "tasks": [
          {"title": "Script approved", "role_default": "manager", "priority": "normal"},
          {"title": "Rough cut received", "role_default": "account", "priority": "normal"},
          {"title": "Brand revisions", "role_default": "manager", "priority": "normal"},
          {"title": "Final cut approved", "role_default": "manager", "priority": "high"}
        ]
      },
      {
        "name": "Publishing",
        "position": 4,
        "due_offset_days": 0,
        "tasks": [
          {"title": "Video live", "role_default": "account", "priority": "high"},
          {"title": "Pinned comment", "role_default": "account", "priority": "normal"},
          {"title": "Cross-promo on Shorts", "role_default": "account", "priority": "normal"}
        ]
      },
      {
        "name": "Reporting",
        "position": 5,
        "due_offset_days": 14,
        "tasks": [
          {"title": "14-day metrics", "role_default": "account", "priority": "normal"},
          {"title": "Audience demo", "role_default": "account", "priority": "normal"},
          {"title": "Report", "role_default": "account", "priority": "normal"},
          {"title": "Invoice", "role_default": "manager", "priority": "normal"}
        ]
      }
    ]
    $jsonb$::jsonb
  );
END $$;
