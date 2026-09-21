const C=require('./combat-core.js');
// reuse smart from sim.js by copying its text
const fs=require('fs');
const code=fs.readFileSync('./sim.js','utf8');
const m=code.match(/function smart[\s\S]*?\n}\n/)[0];
eval(m);
const s=C.newFight(7);
while(!s.over){const l=C.legalMoves(s);const mv=smart(s,l);C.step(s,mv);const e=s.log[s.log.length-1];
console.log(String(e.t).padStart(2),e.player.padEnd(8),'roku:',(e.roku.type+(e.roku.target?'('+e.roku.target+')':'')).padEnd(14),'->roku',String(e.toRoku).padStart(3),'->you',String(e.toPlayer).padStart(3),'| HP',s.p.hp,'Ki',s.p.ki,'St',s.p.st,'Str',s.p.strain,'| Roku',s.r.hp,e.notes.join(','));}
console.log(s.over);
