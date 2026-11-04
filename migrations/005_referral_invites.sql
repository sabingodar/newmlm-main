CREATE TABLE member_referral_invites (
 token text PRIMARY KEY,
 owner_id bigint NOT NULL REFERENCES records(id),
 parent_id bigint NOT NULL REFERENCES records(id),
 position text NOT NULL CHECK(position IN ('Left','Right')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 used_by bigint REFERENCES records(id)
);
CREATE INDEX member_referral_invites_owner ON member_referral_invites(owner_id);
