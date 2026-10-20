const fs=require("fs"); const path=require("path");
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()&&!["node_modules",".next",".git"].includes(e.name)) walk(p,acc); else if(/\.(ts|tsx|json|js|md)$/.test(e.name)) acc.push(p);} return acc; }
const files=walk(".").filter(f=>!f.includes("node_modules")&&!f.includes(".next")&&!f.includes("temp\\eos-mf")&&!f.includes("temp\\_"));
let n=0;
for (const f of files) {
  let t; try{t=fs.readFileSync(f,"utf8")}catch{continue}
  if(t.includes("tm_true_solar_time") || t.includes('"true_solar_time"') && t.includes("True solar")) {
    if(/tm_true_solar_time/.test(t)) {
      console.log(f);
      t.split(/\n/).forEach((l,i)=>{ if(/tm_true_solar_time|True [Ss]olar|真太阳时/.test(l)) console.log("  "+(i+1)+": "+l.trim().slice(0,160)); });
      if(++n>25) break;
    }
  }
}
