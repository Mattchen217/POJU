from pathlib import Path
import subprocess
text = Path(r"public/v2-landing.html").read_text(encoding="utf-8")
checks = {
    "structured decision model": "structured decision model" in text,
    "结构化决策模型": "结构化决策模型" in text,
    "方法论": "方法论" in text,
    "底层架构 gone from built heading zh": '"heading": "我们的<span class=\\"gold-gradient\\">底层架构</span>' not in text,
    "no deterministic forecasting in notice en": "deterministic forecasting" not in text.split("const ENGINE_COPY")[0].split("const BUILT_COPY")[-1] if "const BUILT_COPY" in text else False,
    "确定性的预测 gone from built": "确定性的预测" not in text[text.find("const BUILT_COPY"):text.find("const ENGINE_COPY")],
}
# Design UI markers from stash - glass strip gold glow / hero typography
design_needles = [
    "v2-glass-strip__panel",
    "glow",
]
diff = subprocess.check_output(["git", "diff", "--", "public/v2-landing.html"], encoding="utf-8", errors="replace")
Path(r"temp/_post_pop_diff_stat.txt").write_text(diff[:5000], encoding="utf-8")
print("WORKING COPY CHECKS:")
for k,v in checks.items():
    print(k, "->", v)
print("diff lines", diff.count("\n"), "stat hunks", sum(1 for l in diff.splitlines() if l.startswith("@@")))
# show if CSS-looking changes present in dirty diff
css_hits = [l for l in diff.splitlines() if l.startswith("+") and any(x in l for x in ["text-shadow", "box-shadow", "max-w-", "tracking-", "gold", "glow", "font-size", "letter-spacing", "ch)"] )]
print("design-ish added lines sample:")
for l in css_hits[:20]:
    print(l[:140])
# methodology still in HEAD committed file vs working? ensure methodology strings not lost
print("three millennia in file", "three millennia" in text)
print("About <span" in text or "About <span class" in text)
