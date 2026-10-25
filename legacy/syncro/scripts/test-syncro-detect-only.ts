import { detectSyncroOutputViolations } from "@/lib/syncro/sanitize-output";

const leaky = "Qimen shows auspicious southeast; you will succeed at 3pm.";
const v = detectSyncroOutputViolations(leaky, "en");
console.log("violations:", v.length);
console.log(v.slice(0, 5));
