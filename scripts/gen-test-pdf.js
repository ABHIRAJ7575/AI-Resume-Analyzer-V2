// Script to generate a valid minimal PDF for testing
const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');

const streamContent = 'BT /F1 12 Tf 100 700 Td (Hello World) Tj ET';

const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
const obj4 = '4 0 obj\n<< /Length ' + streamContent.length + ' >>\nstream\n' + streamContent + '\nendstream\nendobj\n';
const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

const header = '%PDF-1.4\n';
let pdf = header;
const offsets = [];
offsets.push(pdf.length); pdf += obj1;
offsets.push(pdf.length); pdf += obj2;
offsets.push(pdf.length); pdf += obj3;
offsets.push(pdf.length); pdf += obj4;
offsets.push(pdf.length); pdf += obj5;

const xrefOffset = pdf.length;
let xref = 'xref\n0 6\n';
xref += '0000000000 65535 f \n';
for (const off of offsets) {
  xref += String(off).padStart(10, '0') + ' 00000 n \n';
}
pdf += xref;
pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';

const buf = Buffer.from(pdf, 'ascii');
pdfParse(buf).then(function(d) {
  console.log('SUCCESS text:', JSON.stringify(d.text));
  console.log('pages:', d.numpages);
  console.log('BUFFER_HEX:' + buf.toString('hex'));
}).catch(function(e) {
  console.error('FAIL', e.message);
  process.exit(1);
});
