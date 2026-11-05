ALTER TABLE administrators
 ADD COLUMN name TEXT NOT NULL DEFAULT '',
 ADD COLUMN email TEXT NOT NULL DEFAULT '',
 ADD COLUMN role TEXT NOT NULL DEFAULT 'Admin' CHECK(role IN ('Admin','Admin Staff','Dispatch Center Manager','Service Center Manager')),
 ADD COLUMN status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
 ADD COLUMN center_id BIGINT REFERENCES records(id),
 ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE administrators ADD COLUMN permission_overrides JSONB NOT NULL DEFAULT '{"allow":[],"deny":[]}';
CREATE TABLE admin_role_permissions (
 role TEXT PRIMARY KEY CHECK(role IN ('Admin Staff','Dispatch Center Manager','Service Center Manager')),
 permissions JSONB NOT NULL CHECK(jsonb_typeof(permissions)='array'),
 version INTEGER NOT NULL DEFAULT 1
);
UPDATE administrators SET is_owner=true,name=username;
ALTER TABLE administrators ADD CONSTRAINT manager_center_required CHECK(role IN ('Admin','Admin Staff') OR center_id IS NOT NULL);
UPDATE records SET data=jsonb_set(data,'{centerType}','"Dispatch Center"'::jsonb) WHERE kind='centers' AND NOT data ? 'centerType';
