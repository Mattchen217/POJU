const fs=require("fs");
// Where is hero_solar used?
const path=require("path");
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()&&!["node_modules",".next",".git"].includes(e.name)) walk(p,acc); else if(/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p);} return acc;}
for(const f of walk("components").concat(walk("app"))){
  const t=fs.readFileSync(f,"utf8");
  if(/hero_solar|session_prep\.welcome|welcome_title|true_solar|真太阳/.test(t)) console.log(f);
}
