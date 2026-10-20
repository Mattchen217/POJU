const fs=require('fs');
const rsc=fs.readFileSync(process.env.TEMP+'/eos-zh-rsc.txt','utf8');
// all Pivot occurrences with context
let i=0,c=0;
while((i=rsc.indexOf('Pivot',i))!==-1 && c<40){
  console.log(c, JSON.stringify(rsc.slice(Math.max(0,i-60), i+80)));
  i+=5; c++;
}
console.log('total Pivot=', (rsc.match(/Pivot/g)||[]).length);
console.log('total POJU=', (rsc.match(/POJU/g)||[]).length);
