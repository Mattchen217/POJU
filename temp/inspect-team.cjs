const fs=require("fs");
const html=fs.readFileSync("public/v2-landing.html","utf8");
const idx=html.indexOf("TEAM_COPY");
console.log("TEAM_COPY idx", idx);
const slice=html.slice(idx, idx+15000);
fs.writeFileSync("temp/team_slice.txt", slice, "utf8");
const names=["Max C.","Arthur M.","Marcus T.","Elena S.","Maya C."];
for (const n of names) {
  let from=0; let count=0;
  while (true) {
    const i=slice.indexOf(n, from);
    if (i<0) break;
    count++;
    console.log(n, "#"+count, "at", i, JSON.stringify(slice.slice(i, i+120)));
    from=i+1;
  }
}
