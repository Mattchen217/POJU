const r = require(process.argv[2]);
for (const t of r.transcript.slice(-5)) console.log(t.n, t.label, JSON.stringify((t.openrouter||[]).map(o=>({s:o.http_status,e:o.error,p:o.provider}))));
