-- Initializing the database

CREATE SCHEMA IF NOT EXISTS pgjson;

CREATE TABLE IF NOT EXISTS pgjson.main(
    id text PRIMARY KEY,
    doc jsonb
);

CREATE OR REPLACE FUNCTION pgjson.upsert(key text, data jsonb)
RETURNS VOID AS
$$
BEGIN
    LOOP
        UPDATE pgjson.main SET doc = data WHERE id = key;
        IF found THEN
            RETURN;
        END IF;
        BEGIN
            INSERT INTO pgjson.main(id, doc) VALUES (key, data);
            RETURN;
        EXCEPTION WHEN unique_violation THEN
        END;
    END LOOP;
END;
$$
LANGUAGE plpgsql;
