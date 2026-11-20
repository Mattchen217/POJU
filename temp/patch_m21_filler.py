from pathlib import Path
p = Path(r"scripts/test-m2-1-readiness-confirm-freeze.ts")
text = p.read_text(encoding="utf-8")
# Replace filler - avoid ESTIMATE_RE tokens: 大概|估计|大约|maybe|perhaps|roughly|i think|我觉得|可能
import re
text2, n = re.subn(
    r'answers\[guard\] \?\?\s*`[^`]+`',
    'answers[guard] ??\n          `继续补充第${guard + 1}点：针对当前调查问题，我的明确答复如下——会给出可核验的具体事实说明。`',
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f'filler replace count={n}')
p.write_text(text2, encoding="utf-8")
print("filler fixed")
