// Debug: print the actual bytes around the xref table
const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');

function buildPdf() {
  const parts = [];
  
  function addLine(s) {
    parts.push(Buffer.from(s + '\n', 'binary'));
  }
  
  function currentOffset() {
    return parts.reduce((sum, b) => sum + b.length, 0);
  }
  
  // Header
  addLine('%PDF-1.4');
  
  // Object 1 - Catalog
  const off1 = currentOffset();
  addLine('1 0 obj');
  addLine('<< /Type /Catalog /Pages 2 0 R >>');
  addLine('endobj');
  addLine('');
  
  // Object 2 - Pages
  const off2 = currentOffset();
  addLine('2 0 obj');
  addLine('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addLine('endobj');
  addLine('');
  
  // Object 3 - Page
  const off3 = currentOffset();
  addLine('3 0 obj');
  addLine('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  addLine('endobj');
  addLine('');
  
  // Object 4 - Content stream
  const streamData = 'BT /F1 12 Tf 100 700 Td (Hello World) Tj ET';
  const off4 = currentOffset();
  addLine('4 0 obj');
  addLine('<< /Length ' + streamData.length + ' >>');
  addLine('stream');
  parts.push(Buffer.from(streamData + '\n', 'binary'));
  addLine('endstream');
  addLine('endobj');
  addLine('');
  
  // Object 5 - Font
  const off5 = currentOffset();
  addLine('5 0 obj');
  addLine('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addLine('endobj');
  addLine('');
  
  const xrefOffset = currentOffset();
  
  console.log('Offsets:', { off1, off2, off3, off4, off5, xrefOffset });
  
  // Each entry is exactly 20 bytes: offset(10) space gen(5) space type space \r\n
  function xrefEntry(offset, gen, type) {
    const entry = String(offset).padStart(10, '0') + ' ' + String(gen).padStart(5, '0') + ' ' + type + ' \r\n';
    console.log('Entry bytes:', entry.length, JSON.stringify(entry));
    return Buffer.from(entry, 'binary');
  }
  
  parts.push(Buffer.from('xref\n', 'binary'));
  parts.push(Buffer.from('0 6\n', 'binary'));
  parts.push(xrefEntry(0, 65535, 'f'));
  parts.push(xrefEntry(off1, 0, 'n'));
  parts.push(xrefEntry(off2, 0, 'n'));
  parts.push(xrefEntry(off3, 0, 'n'));
  parts.push(xrefEntry(off4, 0, 'n'));
  parts.push(xrefEntry(off5, 0, 'n'));
  
  parts.push(Buffer.from('trailer\n', 'binary'));
  parts.push(Buffer.from('<< /Size 6 /Root 1 0 R >>\n', 'binary'));
  parts.push(Buffer.from('startxref\n', 'binary'));
  parts.push(Buffer.from(String(xrefOffset) + '\n', 'binary'));
  parts.push(Buffer.from('%%EOF\n', 'binary'));
  
  return Buffer.concat(parts);
}

const buf = buildPdf();

// Print the xref section
const str = buf.toString('binary');
const xrefIdx = str.indexOf('xref');
console.log('\nXref section (raw):');
console.log(JSON.stringify(str.slice(xrefIdx, xrefIdx + 200)));

pdfParse(buf).then(function(d) {
  console.log('SUCCESS text:', JSON.stringify(d.text));
}).catch(function(e) {
  console.error('FAIL', e.message, e.details || '');
});
