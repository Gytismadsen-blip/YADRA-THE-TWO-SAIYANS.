// Fails if ../index.html is not exactly what dev/build.js produces from the template.
// Catches the case where someone edits the generated index.html and forgets the source.
// Compares against the file on disk, so it works whether or not the change is staged/committed.
const fs = require('fs');
const path = require('path');
const { render } = require('./build.js');

// Windows checkouts may turn LF into CRLF (git autocrlf). Line endings are not a real difference.
const lf = s => s.replace(/\r\n/g, '\n');
const actual = lf(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
const expected = lf(render());

if (actual === expected) {
  console.log('OK: index.html matches dev/game-template.html + dev/combat-core.js');
  process.exit(0);
}

const a = actual.split('\n'), e = expected.split('\n');
let i = 0;
while (i < a.length && i < e.length && a[i] === e[i]) i++;
console.error('FAIL: index.html is out of sync with its source.');
console.error('First difference at line ' + (i + 1) + ':');
console.error('  index.html: ' + (a[i] === undefined ? '(end of file)' : a[i].slice(0, 160)));
console.error('  rebuilt   : ' + (e[i] === undefined ? '(end of file)' : e[i].slice(0, 160)));
console.error('Fix: put the change in dev/game-template.html, then run node dev/build.js');
process.exit(1);
