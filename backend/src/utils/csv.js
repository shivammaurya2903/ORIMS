/**
 * Safe CSV formatting utility with formula injection protection.
 */

/**
 * Escapes a single cell value for CSV output.
 * Prevents formula injection (OWASP CSV Injection) by prefixing cells starting with =, +, -, @ with an apostrophe.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Formula injection prevention: if first character is =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If contains quotes, commas, newlines, or leading/trailing whitespace, wrap in quotes
  if (/[",\n\r]/.test(str) || str.startsWith(' ') || str.endsWith(' ')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts headers and row objects into a formatted CSV string.
 * @param {Array<{ key: string, label: string }>} columns
 * @param {Array<Object>} rows
 * @returns {string}
 */
export function formatToCsv(columns, rows) {
  const headerLine = columns.map(col => escapeCsvCell(col.label)).join(',');
  const rowLines = rows.map(row => {
    return columns.map(col => {
      const val = typeof col.key === 'function' ? col.key(row) : row[col.key];
      return escapeCsvCell(val);
    }).join(',');
  });

  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Helper to stream CSV response with appropriate headers
 */
export function sendCsvResponse(res, filename, csvString) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(csvString);
}
