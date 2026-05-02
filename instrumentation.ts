export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateSignsData } = await import("./lib/oracle/drawSign");
  const result = validateSignsData();

  if (process.env.NODE_ENV === "development") {
    if (result.valid) {
      console.log("[oracle] validateSignsData: OK (100 signs)");
    } else {
      console.warn("[oracle] validateSignsData:", result.errors.slice(0, 8));
      if (result.errors.length > 8) {
        console.warn(`[oracle] … and ${result.errors.length - 8} more errors`);
      }
    }
  }
}
