CREATE TABLE payment_settings(id integer PRIMARY KEY CHECK(id=1),data jsonb NOT NULL,version integer NOT NULL DEFAULT 1);
CREATE TABLE gateway_attempts(
 id uuid PRIMARY KEY,order_id bigint NOT NULL UNIQUE REFERENCES records(id),user_id bigint NOT NULL REFERENCES records(id),
 method text NOT NULL CHECK(method IN ('esewa','khalti')),amount_cents bigint NOT NULL CHECK(amount_cents>0),
 config jsonb NOT NULL,pidx text UNIQUE,payment_url text,status text NOT NULL DEFAULT 'Created',
 transaction_id text,verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gateway_transaction_once ON gateway_attempts(method,transaction_id) WHERE transaction_id IS NOT NULL;
