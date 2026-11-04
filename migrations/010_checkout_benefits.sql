CREATE TABLE shop_coupons (
 id BIGSERIAL PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 discount_type TEXT NOT NULL CHECK(discount_type IN ('Fixed','Percentage')),
 value NUMERIC(20,2) NOT NULL CHECK(value>0),
 minimum_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK(minimum_amount>=0),
 maximum_discount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK(maximum_discount>=0),
 usage_limit INTEGER NOT NULL DEFAULT 0 CHECK(usage_limit>=0),
 per_member_limit INTEGER NOT NULL DEFAULT 1 CHECK(per_member_limit>=0),
 starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,
 active BOOLEAN NOT NULL DEFAULT true,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE member_reward_accounts (
 user_id BIGINT PRIMARY KEY REFERENCES member_profiles(user_id),
 balance NUMERIC(20,2) NOT NULL DEFAULT 0
);
CREATE TABLE member_reward_ledger (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES member_reward_accounts(user_id),
 amount NUMERIC(20,2) NOT NULL CHECK(amount<>0),
 balance_after NUMERIC(20,2) NOT NULL,
 reference TEXT NOT NULL,
 reason TEXT NOT NULL,
 order_id BIGINT REFERENCES records(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,reference)
);
CREATE INDEX member_reward_history ON member_reward_ledger(user_id,id DESC);
CREATE TRIGGER reward_ledger_immutable BEFORE UPDATE OR DELETE ON member_reward_ledger FOR EACH ROW EXECUTE FUNCTION protect_member_ledger();
CREATE TABLE coupon_redemptions (
 order_id BIGINT PRIMARY KEY REFERENCES records(id),
 coupon_id BIGINT NOT NULL REFERENCES shop_coupons(id),
 user_id BIGINT NOT NULL REFERENCES member_profiles(user_id),
 discount NUMERIC(20,2) NOT NULL CHECK(discount>=0),
 released BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coupon_usage ON coupon_redemptions(coupon_id,user_id) WHERE released=false;
