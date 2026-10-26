import { describe, it, expect } from 'vitest';
import { escapeCsvCell, formatToCsv } from '../src/utils/csv.js';

describe('CSV Serialization & Formula Injection Prevention Suite (F-REP-02)', () => {
  it('escapes cells containing commas, double quotes, and newlines', () => {
    expect(escapeCsvCell('Milk, Organic 2%')).toBe('"Milk, Organic 2%"');
    expect(escapeCsvCell('12" Screen')).toBe('"12"" Screen"');
    expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
  });

  it('neutralizes spreadsheet formula injection characters (=, +, -, @)', () => {
    // Attack payloads that would execute commands in Excel/Sheets
    expect(escapeCsvCell('=cmd|"/C calc"!A0')).toBe(`"'=cmd|""/C calc""!A0"`);
    expect(escapeCsvCell('+1+2')).toBe(`'+1+2`);
    expect(escapeCsvCell('-2+5')).toBe(`'-2+5`);
    expect(escapeCsvCell('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`);
    expect(escapeCsvCell('\tmaliciousTab')).toBe(`'\tmaliciousTab`);
  });

  it('leaves standard numbers, booleans, and null/undefined values safe', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(42.5)).toBe('42.5');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(true)).toBe('true');
  });

  it('formats rows into valid RFC 4180 CSV with header row', () => {
    const columns = [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'price', label: 'Selling Price ($)' },
      { key: r => r.category?.name || 'Uncategorized', label: 'Category' },
    ];

    const rows = [
      { sku: 'SKU-001', name: 'Standard Widget', price: 9.99, category: { name: 'Hardware' } },
      { sku: 'SKU-002', name: 'Widget, Deluxe "Special"', price: 19.99, category: null },
      { sku: '=DANGEROUS-SKU', name: '+Formula Product', price: 5.0, category: { name: 'Safety' } },
    ];

    const csvOutput = formatToCsv(columns, rows);
    const lines = csvOutput.split('\r\n');

    expect(lines[0]).toBe('SKU,Product Name,Selling Price ($),Category');
    expect(lines[1]).toBe('SKU-001,Standard Widget,9.99,Hardware');
    expect(lines[2]).toBe('SKU-002,"Widget, Deluxe ""Special""",19.99,Uncategorized');
    // Verifies formula characters neutralized
    expect(lines[3]).toContain(`'=DANGEROUS-SKU`);
    expect(lines[3]).toContain(`'+Formula Product`);
  });
});
