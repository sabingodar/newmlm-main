ALTER TABLE administrators
 ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN import_metadata JSONB NOT NULL DEFAULT '{}';
