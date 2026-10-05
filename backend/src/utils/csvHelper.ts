/**
 * CSV Generation & Escaping Utility
 * Handles RFC-4180 CSV escaping and neutralizes spreadsheet formula injection.
 */

/**
 * Escapes a single cell value for CSV export:
 * 1. Converts null / undefined to empty string.
 * 2. If the value is a number (or explicitly numeric), returns raw string with no guard.
 * 3. Neutralizes formula injection:
 *    - Values starting with \t (tab), \r (carriage return), =, or @ are always prefixed with a single quote (').
 *    - Values starting with + or - are prefixed ONLY IF they do not look like a plain phone number or number.
 *      Safe check: matches /^[+-]?[\d\s().-]+$/ (digits with optional spaces, dashes, parentheses, dots).
 * 4. Wraps value in double quotes and doubles internal double quotes if it contains commas, quotes, or newlines.
 */
export function escapeCsvCell(value: any, isNumeric: boolean = false): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    if (isNaN(value)) return "";
    return String(value);
  }

  if (isNumeric) {
    const num = Number(value);
    if (!isNaN(num)) {
      return String(value);
    }
  }

  let str = String(value);

  // Neutralize values starting with tab (\t) or carriage return (\r)
  if (/^[\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Cells that start with = or @ are always prefixed with a single quote
  else if (/^[=@]/.test(str)) {
    str = `'${str}`;
  }
  // Cells that start with + or - are prefixed ONLY IF they do not look like a plain phone number or number
  else if (/^[+-]/.test(str)) {
    const isSafePhoneOrNumber = /^[+-]?[\d\s().-]+$/.test(str);
    if (!isSafePhoneOrNumber) {
      str = `'${str}`;
    }
  }

  // RFC-4180 CSV escaping: wrap in double quotes if containing quotes, commas, newlines, or carriage returns
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts an array of cell values into a single CSV line.
 */
export function generateCsvRow(cells: any[], numericColumnIndices?: Set<number>): string {
  return cells.map((cell, idx) => escapeCsvCell(cell, numericColumnIndices?.has(idx))).join(",");
}

/**
 * Converts headers and 2D row array into full CSV string.
 */
export function generateCsv(
  headers: string[],
  rows: any[][],
  numericColumnIndices?: Set<number>
): string {
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(",");
  const dataLines = rows.map((r) => generateCsvRow(r, numericColumnIndices));
  return [headerLine, ...dataLines].join("\n");
}
