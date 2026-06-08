'use strict';
const fs = require('fs');
const src = fs.readFileSync('./node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
// Search for XRef related error strings
const terms = ['bad XRef', 'XRef entry', 'xref', 'startxref', 'readXRef', 'parseXRef'];
for (const t of terms) {
  const idx = src.indexOf(t);
  console.log(t + ' -> index: ' + idx);
}
// Also check the actual error message format
const errIdx = src.indexOf('FormatError');
console.log('First FormatError at:', errIdx);
if (errIdx !== -1) {
  console.log(src.substring(errIdx, errIdx + 200));
}
