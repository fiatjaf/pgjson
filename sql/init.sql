-- Initializing the database

BEGIN;

CREATE SCHEMA IF NOT EXISTS ${schema~};

CREATE TABLE IF NOT EXISTS ${schema~}.main(
    id text PRIMARY KEY,
    doc jsonb
);

CREATE OR REPLACE FUNCTION ${schema~}.upsert(key text, data jsonb)
RETURNS VOID AS
$$
BEGIN
    LOOP
        UPDATE ${schema~}.main SET doc = data WHERE id = key;
        IF found THEN
            RETURN;
        END IF;
        BEGIN
            INSERT INTO ${schema~}.main(id, doc) VALUES (key, data);
            RETURN;
        EXCEPTION WHEN unique_violation THEN
        END;
    END LOOP;
END;
$$
LANGUAGE plpgsql;

COMMIT;
