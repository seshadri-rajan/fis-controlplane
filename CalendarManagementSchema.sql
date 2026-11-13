BEGIN;

CREATE TABLE calendar (
    calendar_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    calendar_name varchar(256) NOT NULL UNIQUE,
    is_migrated char(1) NOT NULL DEFAULT 'N',
    is_uploaded char(1) NOT NULL DEFAULT 'N',
    status char(1) NOT NULL DEFAULT 'A',
    created_by varchar(256) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calendar_date (
    calendar_id bigint NOT NULL REFERENCES calendar (calendar_id) ON DELETE CASCADE,
    calendar_date date NOT NULL,
    PRIMARY KEY (calendar_id, calendar_date)
);

CREATE TABLE audit_log (
    audit_log_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resource_type varchar(256),
    resource_name varchar(256),
    action varchar(256) NOT NULL,
    performed_by varchar(256) NOT NULL,
    performed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;