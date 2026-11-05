CREATE TABLE product_share_links(token uuid PRIMARY KEY,user_id bigint NOT NULL REFERENCES records(id),product_id bigint NOT NULL REFERENCES records(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,product_id));
CREATE TABLE direct_sales_awards(id bigserial PRIMARY KEY,order_id bigint NOT NULL REFERENCES records(id),user_id bigint NOT NULL REFERENCES records(id),amount numeric(18,2) NOT NULL CHECK(amount>0),ledger_id bigint NOT NULL UNIQUE REFERENCES member_ledger(id),snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,user_id));

CREATE TRIGGER direct_sales_awards_immutable BEFORE UPDATE OR DELETE ON direct_sales_awards FOR EACH ROW EXECUTE FUNCTION protect_member_ledger();
