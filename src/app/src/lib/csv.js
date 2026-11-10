/**
 * Minimal CSV reader for the import screen. Handles quoted fields, doubled quotes,
 * embedded commas and newlines, CRLF, a UTF-8 byte-order mark (Excel adds one), and
 * semicolon or tab separators (Excel in some locales).
 *
 * Returns one object per data row, keyed by the header text. Blank lines are skipped.
 */
export function parseCsv(text) {
  let src = String(text ?? '');
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);

  const delimiter = detectDelimiter(src);
  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      record.push(field); field = '';
      records.push(record); record = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length) { record.push(field); records.push(record); }

  const nonBlank = records.filter(r => r.some(c => String(c).trim() !== ''));
  if (!nonBlank.length) return { headers: [], rows: [] };

  const headers = nonBlank[0].map(h => String(h).trim());
  const rows = nonBlank.slice(1).map(cells => {
    const obj = {};
    headers.forEach((h, idx) => { if (h) obj[h] = (cells[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, rows };
}

/** Pick the separator by counting unquoted candidates on the header line. */
function detectDelimiter(src) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';
}

/** Accept JSON that is an array of rows, or a Power BI style { value: [...] } wrapper. */
export function rowsFromJson(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.value)) return data.value;
  throw new Error('JSON must be an array of rows, or an object with a "value" array.');
}
