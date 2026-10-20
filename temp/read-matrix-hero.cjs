const fs=require("fs");
// Read hero strip context in PojuEnergyMatrix around 1170-1280
const t=fs.readFileSync("components/poju/PojuEnergyMatrix.tsx","utf8");
const lines=t.split(/\n/);
for(let i=1160;i<1290;i++) console.log((i+1)+": "+lines[i]);
