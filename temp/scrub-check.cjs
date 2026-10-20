const fs=require("fs");
for (const loc of ["en","zh","es","fr"]) {
  const j=JSON.parse(fs.readFileSync(`messages/${loc}.json`,"utf8"));
  const dump=JSON.stringify(j);
  const hits=[];
  for (const needle of ["Field compliance","fortune-telling","不是算命","no es adivinación","pas de voyance","True solar","真太阳","natal","hour pillar","时辰","Flex Pass","product unlock","Financial Protocols"]) {
    if (dump.toLowerCase().includes(needle.toLowerCase())) hits.push(needle);
  }
  console.log(loc, hits.join(", ")||"clean-of-banned");
}
