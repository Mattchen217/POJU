const fs=require('fs');
for (const loc of ['en','zh','es','fr','de']) {
  const p=`messages/${loc}/match.json`;
  if (!fs.existsSync(p)) { console.log(loc,'no match.json'); continue; }
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  console.log('===',loc,'match.json keys', Object.keys(j));
  const s=JSON.stringify(j);
  if (s.includes('Pivot')||s.includes('what_is')||s.includes('true solar')||s.includes('什么是')) {
    console.log(' hits Pivot', (s.match(/Pivot/g)||[]).length);
    // find what_is
    function walk(o,p){ if(!o||typeof o!=='object')return; for(const [k,v] of Object.entries(o)){ const np=p+'.'+k; if(typeof v==='string'){ if(/what_is|Pivot|Eastern|solar|什么是/i.test(np+' '+v)) console.log(' ',np,'=',v.slice(0,160)); } else walk(v,np);} }
    walk(j,'match');
  }
}
// Also check if next-intl merges match.json under match namespace overlapping home.what_is
