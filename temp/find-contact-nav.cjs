const fs=require("fs"); const path=require("path");
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()&&!["node_modules",".next",".git"].includes(e.name)) walk(p,acc); else if(/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p);} return acc;}
const files=walk("app").concat(walk("components"));
for(const f of files){
  const t=fs.readFileSync(f,"utf8");
  if(/contact/i.test(f) || /useTranslations\(\s*[\"']contact/.test(t) || /namespace:\s*[\"']contact/.test(t)) console.log("CONTACT_I18N",f);
  if(/Glyph|Syncro|Atmos|Archive/.test(t) && /nav|Nav|header|Header|footer|Footer/.test(t) && /legal|contact|Contact|Marketing/.test(f+t.slice(0,500))) console.log("NAV_HIT",f);
}
