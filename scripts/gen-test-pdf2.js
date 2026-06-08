// Generate a minimal valid PDF using cross-reference stream (PDF 1.5+)
// which is simpler to get right than classic xref tables
const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');

// Use a known-good minimal PDF (from pdf-parse test suite format)
// This is a linearized minimal PDF that pdf.js can parse
const minPdf = [
  '%PDF-1.4',
  '%\xe2\xe3\xcf\xd3',
  '',
  '1 0 obj',
  '<< /Type /Catalog /Pages 2 0 R >>',
  'endobj',
  '',
  '2 0 obj',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  'endobj',
  '',
  '3 0 obj',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]',
  '/Contents 4 0 R',
  '/Resources << /Font << /F1 5 0 R >> >>',
  '>>',
  'endobj',
  '',
  '4 0 obj',
  '<< /Length 44 >>',
  'stream',
  'BT /F1 12 Tf 100 700 Td (Hello World) Tj ET',
  'endstream',
  'endobj',
  '',
  '5 0 obj',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  'endobj',
  '',
].join('\n');

// Calculate byte offsets for xref
const lines = minPdf.split('\n');
let pos = 0;
const objOffsets = {};
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^(\d+) 0 obj$/);
  if (m) {
    objOffsets[parseInt(m[1])] = pos;
  }
  pos += Buffer.byteLength(line + '\n', 'binary');
}

const xrefPos = pos;
let xref = 'xref\n0 6\n';
xref += '0000000000 65535 f \n';
for (let i = 1; i <= 5; i++) {
  xref += String(objOffsets[i]).padStart(10, '0') + ' 00000 n \n';
}

const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';

const fullPdf = minPdf + xref + trailer;
const buf = Buffer.from(fullPdf, 'binary');

console.log('Buffer length:', buf.length);
console.log('Offsets:', objOffsets);

pdfParse(buf).then(function(d) {
  console.log('SUCCESS text:', JSON.stringify(d.text));
  console.log('pages:', d.numpages);
  console.log('BUFFER_HEX:' + buf.toString('hex'));
}).catch(function(e) {
  console.error('FAIL', e.message, e.details || '');
  process.exit(1);
});
