-- Attribution for web signup QR / campaign links (?ref=).
ALTER TABLE provider ADD COLUMN IF NOT EXISTS "signupSource" text;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS signup_source text;

CREATE INDEX IF NOT EXISTS provider_signup_source_idx ON provider ("signupSource");
CREATE INDEX IF NOT EXISTS customer_signup_source_idx ON customer (signup_source);
