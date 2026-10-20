const fs=require("fs");
function walk(o,p,hits,re){
  if(typeof o==="string"){ if(re.test(o)) hits.push(p+": "+JSON.stringify(o).slice(0,160)); }
  else if(o&&typeof o==="object"){ for(const k of Object.keys(o)) walk(o[k],p?p+"."+k:k,hits,re); }
}
const j=JSON.parse(fs.readFileSync("messages/en.json","utf8"));
const hits=[];
walk(j,"",hits,/Personal Energy|energy analysis|true solar|natal|hour pillar|Flex Pass|product unlock/i);
hits.forEach(h=>console.log(h));
