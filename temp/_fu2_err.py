from pathlib import Path
for name in ["tsc", "m23", "build"]:
    t = Path(f"temp/out_m24r2fu2_{name}.txt").read_text(encoding="utf-8", errors="replace")
    safe = t.encode("ascii", "backslashreplace").decode("ascii")
    Path(f"temp/out_m24r2fu2_{name}_ascii.txt").write_text(safe, encoding="utf-8")
    print("="*20, name, "len", len(safe), "="*20)
    # print errors, skip noise
    lines = safe.splitlines()
    shown = 0
    for l in lines:
        if any(k in l.lower() for k in ["error", "fail", "fail=", "pass=", "error ts"]):
            print(l[:500])
            shown += 1
            if shown > 80:
                print("...truncated...")
                break
    if shown == 0:
        print(safe[-2000:])
