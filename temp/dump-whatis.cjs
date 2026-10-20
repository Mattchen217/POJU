const fs=require('fs');
const en=JSON.parse(fs.readFileSync('messages/en.json','utf8'));
const zh=JSON.parse(fs.readFileSync('messages/zh.json','utf8'));
console.log('=== EN glyph what_is ===');
console.log(JSON.stringify(en.marketingSite.glyph.what_is,null,2));
console.log('=== EN syncro what_is ===');
console.log(JSON.stringify(en.marketingSite.syncro.what_is,null,2));
console.log('=== EN match what_is ===');
console.log(JSON.stringify(en.match.home.what_is,null,2));
console.log('=== EN syncro hero/ask ===');
const sync=en.syncro;
function dump(obj,p,depth=0){ if(depth>4||!obj)return; for(const [k,v] of Object.entries(obj)){ const np=p+'.'+k; if(typeof v==='string'){ if(/solar|location|ask|body|title|message/i.test(np)||/solar/i.test(v)) console.log(np+'=',v); } else if(typeof v==='object') dump(v,np,depth+1);} }
dump(en.marketingSite.syncro,'marketingSite.syncro');
dump(en.syncro,'syncro');
