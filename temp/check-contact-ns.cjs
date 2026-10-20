const fs=require("fs");
// Check if en.json has nested contact that overrides
const en=JSON.parse(fs.readFileSync("messages/en.json","utf8"));
console.log("en.json has contact?", !!en.contact);
if(en.contact) console.log(JSON.stringify(en.contact,null,2).slice(0,1500));
// Check live-sources
const p="temp/eos-mf";
if(fs.existsSync(p)) console.log("eos-mf",fs.readdirSync(p));
