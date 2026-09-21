// Builds ../index.html: the game template with combat-core.js pasted in (one file, no external files).
const fs = require('fs');
const path = require('path');
const core = fs.readFileSync(path.join(__dirname, 'combat-core.js'), 'utf8');
const tpl = fs.readFileSync(path.join(__dirname, 'game-template.html'), 'utf8');
if (!tpl.includes('/*CORE*/')) throw new Error('template is missing the /*CORE*/ marker');
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), tpl.replace('/*CORE*/', () => core));
console.log('built index.html', (fs.statSync(path.join(__dirname, '..', 'index.html')).size / 1024).toFixed(1) + ' KB');
