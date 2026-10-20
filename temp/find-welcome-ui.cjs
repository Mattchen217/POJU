const fs=require("fs"); const path=require("path");
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()&&!["node_modules",".next"].includes(e.name)) walk(p,acc); else if(/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p);} return acc;}
for (const f of walk("components").concat(walk("app"))) {
  const t=fs.readFileSync(f,"utf8");
  if(/poju_matrix\.card\.welcome|welcome\.(title|body|guide|intro|cta|loading|note)/.test(t) || /t\(.*welcome/.test(t) && /matrix|empty|chat/.test(f)) {
    if(/welcome/.test(t) && (/poju_matrix|card\.welcome|empty/.test(t)||/WelcomeEmpty|ChatWelcome|EmptyState/.test(t))) {
      console.log(f);
      t.split(/\n/).forEach((l,i)=>{ if(/welcome|hero_solar|Pivot|True.solar|真太阳/.test(l)) console.log("  "+(i+1)+": "+l.trim().slice(0,140)); });
    }
  }
}
