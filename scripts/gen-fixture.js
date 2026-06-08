/**
 * Generates a valid minimal PDF buffer that pdf-parse can parse,
 * then writes it as a base64 string to stdout.
 *
 * The XRef table uses CRLF line endings (required by PDF spec).
 * Each entry is exactly 20 bytes: OOOOOOOOOO GGGGG X \r\n
 */
'use strict';

const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');
const fs = require('fs');
const path = require('path');

function buildMinimalPdf(textContent) {
  const streamContent = 'BT /F1 12 Tf 72 720 Td (' + textContent + ') Tj ET';
  const streamLen = Buffer.byteLength(streamContent, 'ascii');

  const o1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const o2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const o3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
    '/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const o4 =
    '4 0 obj\n<< /Length ' +
    streamLen +
    ' >>\nstream\n' +
    streamContent +
    '\nendstream\nendobj\n';
  const o5 =
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  const header = '%PDF-1.4\n';
  let body = header;
  const offsets = [];
  offsets.push(body.length); body += o1;
  offsets.push(body.length); body += o2;
  offsets.push(body.length); body += o3;
  offsets.push(body.length); body += o4;
  offsets.push(body.length); body += o5;

  const xrefPos = body.length;

  // XRef table — each entry MUST be exactly 20 bytes (PDF spec §7.5.4)
  // Format: OOOOOOOOOO GGGGG X \r\n  (10 + 1 + 5 + 1 + 1 + 1 + 2 = 21? No.)
  // Correct: "0000000000 65535 f \r\n" = 10+1+5+1+1+1+1+1 = 21 bytes? Let's count:
  // '0000000000' = 10, ' ' = 1, '65535' = 5, ' ' = 1, 'f' = 1, ' ' = 1, '\r' = 1, '\n' = 1 = 21
  // Actually PDF spec says 20 bytes. The trailing space before \r\n is optional in some readers.
  // pdf.js requires: offset(10) SP gen(5) SP keyword(1) SP EOL(2) = 20 bytes
  // EOL can be: SP CR, SP LF, or CR LF
  // So: "0000000009 00000 n \r\n" — that's 10+1+5+1+1+1+1+1 = 21 bytes
  // OR: "0000000009 00000 n\r\n" — 10+1+5+1+1+1+1 = 20 bytes (no trailing space)
  // Let's try without trailing space: "OOOOOOOOOO GGGGG X\r\n" = 20 bytes exactly

  let xref = 'xref\n0 6\n';
  xref += '0000000000 65535 f\r\n';
  for (const off of offsets) {
    xref += String(off).padStart(10, '0') + ' 00000 n\r\n';
  }
  body += xref;
  body += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';

  return Buffer.from(body, 'ascii');
}

const buf = buildMinimalPdf('Hello World');

pdfParse(buf)
  .then(function (d) {
    console.log('SUCCESS text=' + JSON.stringify(d.text) + ' pages=' + d.numpages);
    // Write fixture file
    const fixtureDir = path.join(__dirname, '..', 'src', 'lib', 'pdf', '__tests__', 'fixtures');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'minimal.pdf'), buf);
    console.log('Fixture written to src/lib/pdf/__tests__/fixtures/minimal.pdf');
    console.log('BASE64:' + buf.toString('base64'));
  })
  .catch(function (e) {
    console.error('FAIL:', e.message, e.details || '');
    process.exit(1);
  });
