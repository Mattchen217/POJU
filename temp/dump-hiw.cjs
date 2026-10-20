const fs=require('fs');
for (const loc of ['en','zh','es','fr']) {
  const j=JSON.parse(fs.readFileSync('messages/'+loc+'.json','utf8'));
  const hiw=j.marketingSite.poju.how_it_works;
  console.log('==='+loc+'===');
  console.log('heading', hiw.heading);
  for (const [k,v] of Object.entries(hiw.steps||{})) {
    console.log(k, v.title, '|', (v.description||'').slice(0,120));
  }
  console.log('footer', (hiw.footer||hiw.footer_title||''), JSON.stringify(hiw.footer||hiw).slice(0,200));
  // brand_tag + tagline
  console.log('brand_tag', j.marketingSite.poju.hero?.brand_tag);
  console.log('tagline', j.marketingSite.poju.two_columns?.tagline || j.marketingSite.poju.tagline);
}
