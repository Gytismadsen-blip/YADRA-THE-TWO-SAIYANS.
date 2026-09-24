// Builds ../index.html: the game template with combat-core.js pasted in (one file, no external files).
// index.html is GENERATED. Edit dev/game-template.html (or dev/combat-core.js), then run: node dev/build.js
// dev/check-build.js fails if index.html does not match what this script produces.
const fs = require('fs');
const path = require('path');

const HEADER = '<!-- GENERATED FILE. EDIT dev/game-template.html (or dev/combat-core.js) AND RUN node dev/build.js. -->';

function render() {
  const core = fs.readFileSync(path.join(__dirname, 'combat-core.js'), 'utf8');
  const tpl = fs.readFileSync(path.join(__dirname, 'game-template.html'), 'utf8');
  if (!tpl.includes('/*CORE*/')) throw new Error('template is missing the /*CORE*/ marker');
  // The comment goes after the doctype: a comment before it would push old browsers into quirks mode.
  const nl = tpl.indexOf('\n') + 1;
  if (!/^<!doctype html>/i.test(tpl)) throw new Error('template must start with <!DOCTYPE html>');
  const withHeader = tpl.slice(0, nl) + HEADER + '\n' + tpl.slice(nl);
  return withHeader.replace('/*CORE*/', () => core);
}

module.exports = { render };

if (require.main === module) {
  const out = path.join(__dirname, '..', 'index.html');
  fs.writeFileSync(out, render());
  console.log('built index.html', (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
}
