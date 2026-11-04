CREATE TABLE member_checkouts (
 user_id bigint NOT NULL REFERENCES records(id),
 request_key text NOT NULL,
 fingerprint text NOT NULL,
 order_id bigint NOT NULL REFERENCES records(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
CREATE INDEX member_checkouts_order ON member_checkouts(order_id);
