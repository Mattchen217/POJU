const fs=require('fs');
const path=require('path');

const needles=[
  '什么是 Pivot','What is Pivot','Was ist POJU','Qué es Pivot',"Qu'est-ce que Pivot",
  'true solar','True solar','True Solar','真太阳时','真太陽時'
];

function walkDir(d, out=[]) {
  for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    if (['node_modules','.next','temp','.git','dist','.data','coverage'].includes(e.name)) continue;
    const p=path.join(d,e.name);
    if (e.isDirectory()) walkDir(p,out);
    else if (/\.(json|tsx?|jsx?|html|md|mjs|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files=walkDir('.');
const hits=[];
for (const f of files) {
  let t; try { t=fs.readFileSync(f,'utf8'); } catch { continue; }
  for (const n of needles) {
    if (t.includes(n)) {
      // collect contexts
      let i=0,c=0;
      while ((i=t.indexOf(n,i))!==-1 && c<3) {
        hits.push({f, n, ctx: t.slice(Math.max(0,i-30), i+n.length+50).replace(/\s+/g,' ')});
        i+=n.length; c++;
      }
    }
  }
}
console.log('HIT COUNT', hits.length);
for (const h of hits) console.log(h.f+' | '+h.n+' | '+JSON.stringify(h.ctx));

// Exact what_is titles
for (const loc of ['en','zh','es','fr','de']) {
  const j=JSON.parse(fs.readFileSync('messages/'+loc+'.json','utf8'));
  console.log(loc, 'poju.what_is.title=', j.marketingSite?.poju?.what_is?.title);
  console.log(loc, 'glyph=', j.marketingSite?.glyph?.what_is?.title);
  console.log(loc, 'syncro=', j.marketingSite?.syncro?.what_is?.title);
  console.log(loc, 'match=', j.match?.home?.what_is?.title);
  console.log(loc, 'asking_message=', j.syncro?.location?.asking_message || j.syncro?.asking_message || findAsking(j));
}
function findAsking(obj,p=''){
  if(!obj||typeof obj!=='object') return null;
  for(const [k,v] of Object.entries(obj)){
    if(k==='asking_message' && typeof v==='string') return p+'.'+k+'='+v;
    const r=findAsking(v,p?p+'.'+k:k); if(r) return r;
  }
  return null;
}
