# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

old = """        #v2-methodology .v2-method-left-art img {
            width: 92%;
            height: auto;
            max-width: 95%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

new = """        #v2-methodology .v2-method-left-art img {
            width: 82%;
            height: auto;
            max-width: 85%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

if old not in text:
    raise SystemExit("left img CSS not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("left img width 92% -> 82% (max 85%)")
