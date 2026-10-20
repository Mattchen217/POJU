const fs=require('fs');
const html=fs.readFileSync(process.env.TEMP+'/eos-zh.html','utf8');
const rsc=fs.readFileSync(process.env.TEMP+'/eos-zh-rsc.txt','utf8');
for (const [name,t] of [['html',html],['rsc',rsc]]) {
  console.log('====',name,'len',t.length);
  const needles=['什么是 Pivot','什么是 Eastern OS','What is Pivot','What is Eastern OS','true solar','真太阳'];
  for (const n of needles) {
    let i=0,c=0; while((i=t.indexOf(n,i))!==-1){ c++; if(c<=3) console.log(' ',n,'@',i, JSON.stringify(t.slice(Math.max(0,i-40), i+n.length+80))); i+=n.length; }
    console.log(' count',n,'=',c);
  }
  const re=/"what_is":\{[^}]{0,500}\}/g;
  let m; let k=0; while((m=re.exec(t)) && k<10){ console.log(' what_is:', m[0].slice(0,350)); k++; }
}
