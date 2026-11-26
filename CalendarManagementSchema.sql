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

CREATE OR REPLACE FUNCTION GET_RUN_DATES(
    p_run_calendar varchar,
    p_exclude_calendar varchar DEFAULT NULL
)
RETURNS TABLE(run_date date) AS $$
BEGIN
    RETURN QUERY
    SELECT cd.calendar_date
    FROM calendar_date cd
    INNER JOIN calendar c ON cd.calendar_id = c.calendar_id
    WHERE c.calendar_name = p_run_calendar
    AND cd.calendar_date NOT IN (
        SELECT cd2.calendar_date
        FROM calendar_date cd2
        INNER JOIN calendar c2 ON cd2.calendar_id = c2.calendar_id
        WHERE c2.calendar_name = p_exclude_calendar
        AND p_exclude_calendar IS NOT NULL
    )
    ORDER BY cd.calendar_date;
END;
$$ LANGUAGE plpgsql;

COMMIT;
