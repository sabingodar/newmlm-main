CREATE TABLE order_payment_slips (
 order_id bigint PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
 name text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 2097152)
);
