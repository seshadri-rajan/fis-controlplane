import ExcelJS from "exceljs";

export const MAX_UPLOAD_BYTES = 5_242_880;
export const XLSX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export type WorkbookVerification = {
  year: number;
  valid: boolean;
  items: Array<{
    row: number;
    value: string | null;
    date: string | null;
    valid: boolean;
    errors: string[];
  }>;
  errors: string[];
};

const DATE_HEADER = "Calendar date";
const MAX_ROWS = 367;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toIsoDate(value: string): string | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  return isRealDate(Number(yearText), Number(monthText), Number(dayText)) ? value : null;
}

function toExcelDate(value: string): string {
  const match = ISO_DATE.exec(value);
  if (!match || !isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return value;
}

export async function calendarWorkbook(dates: readonly string[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Calendar dates");
  sheet.columns = [{ header: DATE_HEADER, key: "date", width: 20 }];
  sheet.getColumn(1).numFmt = "@";
  for (const date of dates) {
    sheet.addRow([toExcelDate(date)]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MEDIA_TYPE });
}

export async function sampleCalendarWorkbook(year: number): Promise<Blob> {
  const dates: string[] = [];
  const day = new Date(Date.UTC(year, 0, 1));
  while (dates.length < 5) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return calendarWorkbook(dates);
}

export async function parseCalendarWorkbook(
  buffer: ArrayBuffer,
  year: number,
  amend: boolean,
): Promise<WorkbookVerification> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      year,
      valid: false,
      items: [],
      errors: ["The file is not a valid .xlsx workbook."],
    };
  }

  if (workbook.worksheets.length !== 1) {
    return {
      year,
      valid: false,
      items: [],
      errors: ["The workbook must contain exactly one worksheet."],
    };
  }

  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > MAX_ROWS || sheet.actualColumnCount > 1) {
    return {
      year,
      valid: false,
      items: [],
      errors: ["The worksheet must contain one date column and no more than 366 dates."],
    };
  }

  const errors: string[] = [];
  const header = sheet.getRow(1).getCell(1).value;
  if (header !== DATE_HEADER) {
    errors.push(`The column heading must be "${DATE_HEADER}".`);
    return { year, valid: false, items: [], errors };
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = Number(today.slice(0, 4));
  if (!amend && year !== currentYear && year !== currentYear + 1) {
    errors.push("Only the current or next calendar year can be uploaded.");
  }
  const seen = new Map<string, number>();
  const items: WorkbookVerification["items"] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const rowErrors: string[] = [];
    for (let column = 2; column <= row.cellCount; column++) {
      if (row.getCell(column).value !== null && row.getCell(column).value !== undefined) {
        rowErrors.push("Only the Calendar date column is allowed.");
        break;
      }
    }

    const value = row.getCell(1).value;
    const displayValue = typeof value === "string" ? value : null;
    const date = displayValue ? toIsoDate(displayValue) : null;
    if (displayValue && /[A-Za-z]/.test(displayValue)) {
      rowErrors.push("Dates must not contain letters.");
    }
    if (!date) {
      rowErrors.push("Date must use the YYYY-MM-DD format and be a real date.");
    } else {
      if (date < today) rowErrors.push("Past dates are not allowed.");
      const dateYear = Number(date.slice(0, 4));
      if (!amend && dateYear !== currentYear && dateYear !== currentYear + 1) {
        rowErrors.push("Date must be in the current or next calendar year.");
      }
      const firstRow = seen.get(date);
      if (firstRow !== undefined) {
        rowErrors.push(`Duplicate date; it first appears in row ${firstRow}.`);
      } else {
        seen.set(date, rowNumber);
      }
    }
    items.push({
      row: rowNumber,
      value: displayValue,
      date,
      valid: rowErrors.length === 0,
      errors: rowErrors,
    });
  }

  if (sheet.rowCount < 2) {
    errors.push("The worksheet must contain at least one date.");
  }

  if (items.length === 0) errors.push("The worksheet must contain at least one date.");
  return {
    year,
    valid: errors.length === 0 && items.length > 0 && items.every((item) => item.valid),
    items,
    errors,
  };
}
