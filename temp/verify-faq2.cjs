const fs=require("fs");
const faq=fs.readFileSync("public/v2/faq-i18n.js","utf8");
// find all course/chat with line numbers
faq.split(/\n/).forEach((l,i)=>{
  if(/\bcourse\b|\bchat\b/i.test(l)) console.log((i+1)+": "+l.trim().slice(0,240));
});
console.log("--- q1/q2/q7/q9/q13 FR snippets ---");
const keys=["En une","1 PASS","stockage local","sauvegarde","plusieurs appareils","historique"];
faq.split(/\n/).forEach((l,i)=>{
  if(i>330 && i<460 && keys.some(k=>l.includes(k))) console.log((i+1)+": "+l.trim().slice(0,240));
});
