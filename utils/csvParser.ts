
import { RawJobData } from "../types";

/**
 * Parses a CSV string into an array of RawJobData.
 * Features:
 * - Handles escaped quotes ("")
 * - Handles fields containing delimiters or newlines
 * - Auto-detects delimiter (comma, semicolon, or tab)
 * - Robust error handling for malformed lines
 */
export function parseCSV(csvText: string): RawJobData[] {
  if (!csvText.trim()) return [];

  const rows = robustCSVParser(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  // Header matching based on user requirements: "Emails", "Phone Numbers", "Description"
  const emailIndex = headers.indexOf('emails');
  const phoneIndex = headers.indexOf('phone numbers');
  const descIndex = headers.indexOf('description');

  if (emailIndex === -1 || descIndex === -1) {
    throw new Error("CSV must contain 'Emails' and 'Description' columns. Found: " + rows[0].join(', '));
  }

  const results: RawJobData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && row[0] === "")) continue;

    results.push({
      email: row[emailIndex]?.trim() || "",
      phone: phoneIndex !== -1 ? row[phoneIndex]?.trim() : "",
      description: row[descIndex]?.trim() || "",
    });
  }

  return results;
}

/**
 * A robust CSV parser that handles:
 * - Delimiters within quoted fields
 * - Newlines within quoted fields
 * - Escaped double quotes ("")
 */
function robustCSVParser(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let col = "";
  let inQuotes = false;

  // Auto-detect delimiter from the first line
  const firstLine = text.split('\n')[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote: ""
        col += '"';
        i++; // skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        col += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === delimiter) {
        // Field boundary
        row.push(col);
        col = "";
      } else if (char === '\n' || char === '\r') {
        // Line boundary
        row.push(col);
        result.push(row);
        row = [];
        col = "";
        // Handle CRLF
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        col += char;
      }
    }
  }

  // Handle the last field/row if file doesn't end in newline
  if (row.length > 0 || col !== "") {
    row.push(col);
    result.push(row);
  }

  return result;
}
