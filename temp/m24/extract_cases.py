from pathlib import Path
# Capture UTF-8 case lines from the test run by re-running a quick extract via python reading the tee file as binary/utf-8
raw = Path(r"temp/m24/reg_m1.txt").read_bytes()
# try utf-8 then gbk
for enc in ("utf-8", "utf-8-sig", "gbk", "cp936"):
    try:
        text = raw.decode(enc)
        break
    except Exception:
        text = None
else:
    text = raw.decode("utf-8", errors="replace")
lines = [ln for ln in text.splitlines() if "[m24" in ln or "PASS  M2.4" in ln or "M1 done" in ln]
Path(r"temp/m24/case_excerpts_utf8.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("enc used; lines", len(lines))
for ln in lines:
    print(ln[:200])
