// Try using a different pdf.js version that might be more lenient
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
  
  console.log('Offsets:', { off1, off2, off3, off4, off5, xrefOffset });
  
  // Try the format from the PDF spec: exactly 20 bytes with \r\n (no trailing space)
  // "nnnnnnnnnn ggggg n\r\n" = 10+1+5+1+1+2 = 20 bytes
  function xrefEntry(offset, gen, type) {
    const entry = String(offset).padStart(10, '0') + ' ' + String(gen).padStart(5, '0') + ' ' + type + '\r\n';
    console.log('Entry:', entry.length, 'bytes:', JSON.stringify(entry));
    return Buffer.from(entry, 'binary');
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
console.log('Total length:', buf.length);

pdfParse(buf).then(function(d) {
  console.log('SUCCESS text:', JSON.stringify(d.text));
  console.log('BUFFER_HEX:' + buf.toString('hex'));
}).catch(function(e) {
  console.error('FAIL', e.message, e.details || '');
  process.exit(1);
});
