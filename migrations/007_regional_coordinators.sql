CREATE TABLE coordinator_assignments (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES member_profiles(user_id),
 role TEXT NOT NULL CHECK(role IN ('country','province','district','city')),
 country TEXT NOT NULL CHECK(country='NP'),
 province_id TEXT NOT NULL DEFAULT '',
 district_id TEXT NOT NULL DEFAULT '',
 city_id TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(role,country,province_id,district_id,city_id),
 CHECK((role='country' AND province_id='' AND district_id='' AND city_id='') OR
 (role='province' AND province_id<>'' AND district_id='' AND city_id='') OR
 (role='district' AND province_id<>'' AND district_id<>'' AND city_id='') OR
 (role='city' AND province_id<>'' AND district_id<>'' AND city_id<>''))
);
CREATE INDEX coordinator_assignments_user ON coordinator_assignments(user_id);
CREATE INDEX member_location_province ON records ((data->'location'->>'provinceId')) WHERE kind='users';
CREATE INDEX member_location_district ON records ((data->'location'->>'districtId')) WHERE kind='users';
CREATE INDEX member_location_city ON records ((data->'location'->>'cityId')) WHERE kind='users';
