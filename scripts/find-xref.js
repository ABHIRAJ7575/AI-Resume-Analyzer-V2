'use strict';
const fs = require('fs');
const src = fs.readFileSync('./node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js', 'utf8');
const idx = src.indexOf('bad XRef entry');
if (idx === -1) { console.log('NOT FOUND'); process.exit(1); }
console.log('--- context around "bad XRef entry" ---');
console.log(src.substring(Math.max(0, idx - 800), idx + 300));
