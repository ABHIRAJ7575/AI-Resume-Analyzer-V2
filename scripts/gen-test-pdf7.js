// Debug: verify the startxref offset points to 'xref'
const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');

function buildPdf() {
  const parts = [];
  
  function add(s) {
    parts.push(Buffer.from(s, 'binary'));
  }
  
  function currentOffset() {
    return parts.reduce((sum, b) => sum + b.length, 0);
  }
  
  add('%PDF-1.4\n');
  
  const off1 = currentOffset();
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  
  const off2 = currentOffset();
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  
  const off3 = currentOffset();
  add('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');
  
  const streamData = 'BT /F1 12 Tf 100 700 Td (Hello World) Tj ET';
  const off4 = currentOffset();
  add('4 0 obj\n<< /Length ' + streamData.length + ' >>\nstream\n' + streamData + '\nendstream\nendobj\n');
  
  const off5 = currentOffset();
  add('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  
  const xrefOffset = currentOffset();
  
  function xrefEntry(offset, gen, type) {
    return Buffer.from(String(offset).padStart(10, '0') + ' ' + String(gen).padStart(5, '0') + ' ' + type + '\r\n', 'binary');
  }
  
  add('xref\n');
  add('0 6\n');
  parts.push(xrefEntry(0, 65535, 'f'));
  parts.push(xrefEntry(off1, 0, 'n'));
  parts.push(xrefEntry(off2, 0, 'n'));
  parts.push(xrefEntry(off3, 0, 'n'));
  parts.push(xrefEntry(off4, 0, 'n'));
  parts.push(xrefEntry(off5, 0, 'n'));
  
  add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n');
  
  return Buffer.concat(parts);
}

const buf = buildPdf();

// Verify: check what's at the xrefOffset
const str = buf.toString('binary');
const xrefIdx = str.indexOf('xref');
console.log('xref found at index:', xrefIdx);

// Find startxref value
const startxrefMatch = str.match(/startxref\n(\d+)\n/);
if (startxrefMatch) {
  const offset = parseInt(startxrefMatch[1]);
  console.log('startxref value:', offset);
  console.log('Content at that offset:', JSON.stringify(str.slice(offset, offset + 30)));
  console.log('Match:', offset === xrefIdx);
}

// Also check object 1 offset
const obj1Match = str.match(/1 0 obj/);
console.log('obj1 found at:', str.indexOf('1 0 obj'));

// Print full PDF as string for inspection
console.log('\nFull PDF:');
console.log(str);

pdfParse(buf).then(function(d) {
  console.log('SUCCESS text:', JSON.stringify(d.text));
}).catch(function(e) {
  console.error('FAIL', e.message, e.details || '');
});
