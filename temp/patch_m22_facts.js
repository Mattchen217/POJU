const fs = require("fs");
const path = "scripts/test-m2-2-freeze-report-binding.ts";
let s = fs.readFileSync(path, "utf8");
s = s.replace('category: "hard_constraint"', 'category: "financial"');
// enrich facts with related_dir_ids for aggregator
s = s.replace(
  'fact_roles: ["option"],\n      },\n      {\n        fact_id: "f_status"',
  'fact_roles: ["option"],\n        related_dir_ids: ["dir_options"],\n      },\n      {\n        fact_id: "f_status"'
);
s = s.replace(
  'fact_roles: ["status_quo"],\n      },\n      {\n        fact_id: "f_hard"',
  'fact_roles: ["status_quo"],\n        related_dir_ids: ["dir_status_quo"],\n      },\n      {\n        fact_id: "f_hard"'
);
s = s.replace(
  'fact_roles: ["hard_constraint"],\n      },\n      {\n        fact_id: "f_risk"',
  'fact_roles: ["hard_constraint"],\n        related_dir_ids: ["dir_hard_constraint"],\n      },\n      {\n        fact_id: "f_risk"'
);
s = s.replace(
  'fact_roles: ["risk"],\n      },\n    ];',
  'fact_roles: ["risk"],\n        related_dir_ids: ["dir_risk"],\n      },\n    ];'
);
fs.writeFileSync(path, s);
console.log("facts enriched");
