CREATE TABLE crm_lead_details (
  record_id bigint PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('New', 'Contacted', 'Qualified', 'Closed')),
  customer_review text NOT NULL DEFAULT '',
  followup_on date,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_lead_followups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id bigint NOT NULL REFERENCES crm_lead_details(record_id) ON DELETE CASCADE,
  note text NOT NULL,
  author text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_lead_followups_record ON crm_lead_followups(record_id, id DESC);
CREATE INDEX crm_delivered_orders ON records(id) WHERE kind = 'orders' AND data->>'status' = 'Delivered';
