import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv, rowsFromJson } from '../src/lib/csv.js';

test('parses a plain CSV into objects keyed by header', () => {
  const { headers, rows } = parseCsv('name,report_url\nA,https://x.example/a\nB,https://x.example/b\n');
  assert.deepEqual(headers, ['name', 'report_url']);
  assert.deepEqual(rows, [
    { name: 'A', report_url: 'https://x.example/a' },
    { name: 'B', report_url: 'https://x.example/b' },
  ]);
});

test('handles quotes, doubled quotes, embedded commas and newlines', () => {
  const { rows } = parseCsv('name,description\n"Spend, by dept","Says ""hello""\nsecond line"\n');
  assert.equal(rows[0].name, 'Spend, by dept');
  assert.equal(rows[0].description, 'Says "hello"\nsecond line');
});

test('handles CRLF, a byte-order mark, blank lines and a missing final newline', () => {
  const { rows } = parseCsv('\uFEFFname,owner\r\nA,a@example.org\r\n\r\nB,b@example.org');
  assert.deepEqual(rows.map(r => r.name), ['A', 'B']);
});

test('detects semicolon and tab separators', () => {
  assert.deepEqual(parseCsv('name;owner\nA;a@example.org').rows[0], { name: 'A', owner: 'a@example.org' });
  assert.deepEqual(parseCsv('name\towner\nA\ta@example.org').rows[0], { name: 'A', owner: 'a@example.org' });
});

test('short rows pad with empty strings; empty input gives no rows', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,2').rows[0], { a: '1', b: '2', c: '' });
  assert.deepEqual(parseCsv(''), { headers: [], rows: [] });
});

test('JSON input can be an array or a Power BI style value wrapper', () => {
  assert.deepEqual(rowsFromJson('[{"name":"A"}]'), [{ name: 'A' }]);
  assert.deepEqual(rowsFromJson('{"value":[{"name":"A"}]}'), [{ name: 'A' }]);
  assert.throws(() => rowsFromJson('{"x":1}'), /array/);
});
