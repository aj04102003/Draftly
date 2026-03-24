import { RawJobData } from "../types";

/**
 * Parses a CSV string into an array of RawJobData.
 *
 * Supports TWO column schemas:
 *
 * Schema A — Original Juno format:
 *   Emails | Phone Numbers | Description
 *
 * Schema B — LinkedIn Lead Collector export:
 *   S.No | Date/Time | Recruiter Name | Recruiter Title | Job Title |
 *   Email(s) | Phone(s) | Job Description | Post URL
 *
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

  const headers = rows[0].map((h) => h.trim().toLowerCase());

  // ── Schema B: LinkedIn Lead Collector export ──────────────────────────────
  // Headers: s.no | date/time | recruiter name | recruiter title | job title |
  //          email(s) | phone(s) | job description | post url
  const emailsColB = headers.findIndex((h) => h === "email(s)" || h === "emails");
  const phonesColB = headers.findIndex((h) => h === "phone(s)" || h === "phone numbers");
  const descColB = headers.findIndex(
    (h) => h === "job description" || h === "description"
  );

  if (emailsColB !== -1 && descColB !== -1) {
    // Use Schema B
    const results: RawJobData[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.length || (row.length === 1 && row[0] === "")) continue;

      const email = row[emailsColB]?.trim() || "";
      const phone = phonesColB !== -1 ? row[phonesColB]?.trim() : "";
      const description = row[descColB]?.trim() || "";

      if (!email && !description) continue; // skip empty rows

      results.push({ email, phone: phone ?? "", description });
    }
    return results;
  }

  // ── Schema A: Original Juno format ───────────────────────────────────────
  const emailIndex = headers.indexOf("emails");
  const phoneIndex = headers.indexOf("phone numbers");
  const descIndex = headers.indexOf("description");

  if (emailIndex === -1 || descIndex === -1) {
    throw new Error(
      `CSV columns not recognised.\n\n` +
        `Expected either:\n` +
        `  • Juno format: "Emails", "Phone Numbers", "Description"\n` +
        `  • LinkedIn export: "Email(s)", "Phone(s)", "Job Description"\n\n` +
        `Found: ${rows[0].join(", ")}`
    );
  }

  const results: RawJobData[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.length || (row.length === 1 && row[0] === "")) continue;

    results.push({
      email: row[emailIndex]?.trim() || "",
      phone: phoneIndex !== -1 ? row[phoneIndex]?.trim() ?? "" : "",
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
 * - Auto-detected delimiter (comma / semicolon / tab)
 */
function robustCSVParser(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let col = "";
  let inQuotes = false;

  // Auto-detect delimiter from the first line
  const firstLine = text.split("\n")[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ",";
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
  if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote: ""
        col += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        col += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(col);
        col = "";
      } else if (char === "\n" || char === "\r") {
        row.push(col);
        result.push(row);
        row = [];
        col = "";
        // Handle CRLF
        if (char === "\r" && nextChar === "\n") i++;
      } else {
        col += char;
      }
    }
  }

  // Handle last field/row if file doesn't end with newline
  if (row.length > 0 || col !== "") {
    row.push(col);
    result.push(row);
  }

  return result;
}
