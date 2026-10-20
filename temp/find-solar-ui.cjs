const fs=require("fs");
// Where hero_solar is rendered — hide if still solar branded
const files=[
  "components/poju/PojuEnergyMatrix.tsx",
  "components/poju/SessionPreparation.tsx",
  "components/forms/BirthLocationField.tsx",
  "components/base-analysis/BaseAnalysisIdentityBand.tsx",
  "components/profile/ProfileAccuracyBadge.tsx",
];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const t=fs.readFileSync(f,"utf8");
  if (/hero_solar|true_solar|True.solar|真太阳|Pivot|POJU|energy matrix|Energy Matrix/i.test(t)) {
    console.log("====",f,"====");
    t.split(/\n/).forEach((l,i)=>{
      if (/hero_solar|true_solar|True.solar|真太阳|welcome_title|birth_flow|thinking_wait|Pivot|POJU|energy matrix/i.test(l))
        console.log((i+1)+": "+l.trim().slice(0,160));
    });
  }
}
