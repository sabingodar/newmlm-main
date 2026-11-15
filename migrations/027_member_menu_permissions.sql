ALTER TABLE member_profiles ALTER COLUMN permissions SET DEFAULT
 '["dashboard","products","quick","referrals","registration","detailed","reports","kyc","points","rewards","earnings","security","tracking","orders","deposits","withdrawals","ledger","profile","notifications","regions","card","password"]'::jsonb;

UPDATE member_profiles p SET permissions = DEFAULT
FROM records r WHERE r.id = p.user_id AND r.kind = 'users'
 AND lower(COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername','')) <> 'root';

UPDATE member_profiles p
SET permissions = p.permissions || '["dashboard","products","discount","wholesale","quick","card","password","regions"]'::jsonb
     || CASE WHEN p.permissions ? 'profile'
        THEN '["referrals","team","registration","earth","sky","detailed","reports","kyc","points","rewards","earnings","security"]'::jsonb
        ELSE '[]'::jsonb END
     || CASE WHEN p.permissions ? 'orders' THEN '["tracking"]'::jsonb ELSE '[]'::jsonb END
FROM records r WHERE r.id = p.user_id AND r.kind = 'users'
 AND lower(COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername','')) = 'root';

CREATE OR REPLACE FUNCTION initialize_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind='users' THEN
    INSERT INTO member_profiles(user_id,country) VALUES(NEW.id,COALESCE(NEW.data->>'country',''));
    IF lower(COALESCE(NULLIF(NEW.data->>'username',''),NEW.data->>'legacyUsername','')) = 'root' THEN
      UPDATE member_profiles
      SET permissions = permissions || '["discount","wholesale","team","earth","sky"]'::jsonb
      WHERE user_id = NEW.id;
    END IF;
    INSERT INTO member_accounts(user_id,opening_balance,balance) VALUES(NEW.id,COALESCE((NEW.data->>'legacyBalance')::numeric,0),COALESCE((NEW.data->>'legacyBalance')::numeric,0));
  END IF;
  RETURN NEW;
END $$;
