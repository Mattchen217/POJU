from pathlib import Path
raw = Path(r"temp/m24/reg_m1.txt").read_bytes()
print("bom", raw[:4], "len", len(raw))
for enc in ("utf-16", "utf-16-le", "utf-8", "gbk"):
    try:
        text = raw.decode(enc)
        if "[m24" in text or "M2.4" in text:
            lines = [ln for ln in text.splitlines() if "[m24" in ln or "PASS  M2.4" in ln or "M1 done" in ln]
            Path(r"temp/m24/case_excerpts_utf8.txt").write_text("\n".join(lines)+"\n", encoding="utf-8")
            print("ok", enc, len(lines))
            for ln in lines[:5]:
                print(ln[:180])
            break
    except Exception as e:
        print(enc, e)
