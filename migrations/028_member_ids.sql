CREATE SEQUENCE member_public_id_seq START 100000;

CREATE FUNCTION assign_member_public_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate text; prior text;
BEGIN
 IF NEW.kind <> 'users' THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND OLD.data->>'memberId' ~ '^DLS[0-9]+$' THEN
  NEW.data = jsonb_set(NEW.data,'{memberId}',OLD.data->'memberId');
  RETURN NEW;
 END IF;
 prior = COALESCE(NULLIF(NEW.data->>'memberId',''),NULLIF(NEW.data->>'username',''),NEW.data->>'legacyUsername','');
 IF upper(prior) ~ '^DLS?[0-9]+$' THEN
  candidate = 'DLS' || regexp_replace(upper(prior),'^DLS?','');
 END IF;
 LOOP
  IF candidate IS NULL THEN candidate = 'DLS' || nextval('member_public_id_seq')::text; END IF;
  EXIT WHEN NOT EXISTS(SELECT 1 FROM records r WHERE r.kind='users' AND r.id<>NEW.id
    AND (r.data->>'memberId'=candidate OR lower(COALESCE(NULLIF(r.data->>'username',''),r.data->>'legacyUsername',''))=lower(candidate)));
  candidate = NULL;
 END LOOP;
 NEW.data = jsonb_set(NEW.data,'{memberId}',to_jsonb(candidate));
 RETURN NEW;
END $$;
CREATE TRIGGER assign_member_public_id_before_write BEFORE INSERT OR UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION assign_member_public_id();

-- Assign existing members in ID order so old DL numbers are retained consistently.
DO $$ DECLARE member record; BEGIN
 FOR member IN SELECT id FROM records WHERE kind='users' ORDER BY id LOOP
  UPDATE records SET data=data,version=version+1 WHERE id=member.id;
 END LOOP;
END $$;
CREATE UNIQUE INDEX unique_member_public_id ON records((data->>'memberId')) WHERE kind='users';
