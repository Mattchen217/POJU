const fs=require("fs");
function walk(o,p,hits,re){
  if(typeof o==="string"){
    if(re.test(o)) hits.push(p+": "+o.slice(0,140));
  } else if(o&&typeof o==="object"){
    for(const k of Object.keys(o)) walk(o[k], p?p+"."+k:k, hits, re);
  }
}
for (const loc of ["en","zh","es","fr"]) {
  const j=JSON.parse(fs.readFileSync(`messages/${loc}.json`,"utf8"));
  const hits=[];
  walk(j,"",hits,/true solar|真太阳|hour pillar|时辰柱|natal chart|astro-chronological|Personal Energy Profile|Daily Cosmic Resonance|Flex Pass|product unlock|Financial Protocols|Terminal Actions|Account Erasure|Initiate Erasure/i);
  console.log("====",loc, hits.length);
  hits.slice(0,40).forEach(h=>console.log(h));
}
