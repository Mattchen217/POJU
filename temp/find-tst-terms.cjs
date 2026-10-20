const fs=require("fs"); const path=require("path");
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()&&!["node_modules",".next"].includes(e.name)) walk(p,acc); else if(/\.(ts|tsx|json|js)$/.test(e.name)) acc.push(p);} return acc;}
for (const f of walk("lib/poju").concat(walk("components")).concat(["messages/en.json"])) {
  if(!fs.existsSync(f)) continue;
  const t=fs.readFileSync(f,"utf8");
  if(/tm_true_solar_time|True Solar|真太阳时/.test(t) && /term|label|glossary|SoftTerm|matrix-term/i.test(f+t.slice(0,200))) {
    if(/tm_true_solar|True Solar|真太阳/.test(t)) {
      console.log("FILE",f);
      t.split(/\n/).forEach((l,i)=>{ if(/tm_true_solar|True Solar|真太阳时|true solar/i.test(l)) console.log((i+1)+": "+l.trim().slice(0,180)); });
    }
  }
}
