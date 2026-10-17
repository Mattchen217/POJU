# -*- coding: utf-8 -*-
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
path = r"public/v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Print apply functions around those offsets
for pos in [168612, 179158, 180126, 183084, 195725, 212961]:
    print(f"\n===== around {pos} =====")
    print(text[pos:pos+700])
    print("---")
