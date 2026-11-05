export const MAX_UPLOAD_BYTES = 5_242_880;

export type ParsedDates = {
  /** Unique, ascending YYYY-MM-DD values. Only meaningful when `errors` is empty. */
  dates: string[];
  errors: string[];
};

const MAX_REPORTED_ERRORS = 50;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

const unquote = (cell: string) => cell.trim().replace(/^"(.*)"$/, "$1").trim();

/** A valid upload file for the given dates (YYYY-MM-DD), in the format the spec requires. */
export function datesCsv(dates: string[]): string {
  return ["date", ...dates].join("\r\n") + "\r\n";
}

/** A valid example file: the header plus five consecutive weekdays at the start of `year`. */
export function sampleCsv(year: number): string {
  const rows: string[] = [];
  const day = new Date(Date.UTC(year, 0, 1));
  while (rows.length < 5) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) rows.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return datesCsv(rows);
}

/**
 * Validates the upload format from the API spec: a single column with the header
 * `date`, one YYYY-MM-DD value per record, no duplicates, at least one date.
 */
export function parseDatesCsv(text: string): ParsedDates {
  const errors: string[] = [];
  const fail = (message: string) => {
    if (errors.length < MAX_REPORTED_ERRORS) errors.push(message);
  };

  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  if (lines.length === 0) {
    return { dates: [], errors: ["The file is empty."] };
  }

  if (lines[0].includes(",")) {
    fail("Line 1: the file must contain exactly one column, named date.");
  } else if (unquote(lines[0]) !== "date") {
    fail('Line 1: the header must be "date".');
  }

  const seen = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    if (lines[i].includes(",")) {
      fail(`Line ${lineNumber}: expected a single column.`);
      continue;
    }
    const value = unquote(lines[i]);
    if (value === "") {
      fail(`Line ${lineNumber}: empty value.`);
    } else if (!isRealDate(value)) {
      fail(`Line ${lineNumber}: "${value}" is not a valid date (expected YYYY-MM-DD).`);
    } else if (seen.has(value)) {
      fail(`Line ${lineNumber}: ${value} is a duplicate of line ${seen.get(value)}.`);
    } else {
      seen.set(value, lineNumber);
    }
  }

  if (errors.length === 0 && seen.size === 0) {
    errors.push("The file has a header but no dates.");
  }

  return { dates: [...seen.keys()].sort(), errors };
}
