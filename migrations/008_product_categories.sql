ALTER TABLE audit ALTER COLUMN record_id DROP NOT NULL;
CREATE TABLE product_categories (
 id BIGSERIAL PRIMARY KEY,
 parent_id BIGINT REFERENCES product_categories(id),
 name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(parent_id IS NULL OR parent_id<>id)
);
CREATE UNIQUE INDEX product_category_name ON product_categories(COALESCE(parent_id,0),lower(name));
INSERT INTO product_categories(name) SELECT DISTINCT ON (lower(btrim(data->>'category'))) btrim(data->>'category') FROM records WHERE kind='products' AND length(btrim(data->>'category')) BETWEEN 1 AND 120 ORDER BY lower(btrim(data->>'category')),btrim(data->>'category');
UPDATE records r SET data=r.data||jsonb_build_object('categoryId',c.id) FROM product_categories c WHERE r.kind='products' AND lower(btrim(r.data->>'category'))=lower(c.name);
