# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

old = """        #v2-methodology .v2-method-left-art {
            flex: 0 0 auto;
            height: 42%;
            min-height: 8rem;
            max-height: 11.5rem;
            margin-top: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.75rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: auto;
            height: 100%;
            max-width: 92%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

new = """        #v2-methodology .v2-method-left-art {
            flex: 0 0 auto;
            height: 44%;
            min-height: 10rem;
            max-height: 14rem;
            margin-top: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.75rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: auto;
            height: 100%;
            max-width: 96%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

if old not in text:
    raise SystemExit("left art CSS not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("left art bumped to ~40-45%")
