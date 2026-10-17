# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

old = """        #v2-methodology .v2-method-left-art {
            /* no flex-grow — fixed visual size, not fill leftover column height */
            flex: 0 0 auto;
            width: 70%;
            max-width: 11rem;
            max-height: 11rem;
            margin-top: auto;
            margin-left: auto;
            margin-right: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.75rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: 100%;
            height: 100%;
            max-width: 11rem;
            max-height: 11rem;
            object-fit: contain;
            object-position: bottom center;
        }"""

new = """        #v2-methodology .v2-method-left-art {
            /* mid size: no flex-grow; 13.5rem ≈ 216px */
            flex: 0 0 auto;
            width: 78%;
            max-width: 13.5rem;
            max-height: 13.5rem;
            margin-top: auto;
            margin-left: auto;
            margin-right: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.75rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: 100%;
            height: 100%;
            max-width: 13.5rem;
            max-height: 13.5rem;
            object-fit: contain;
            object-position: bottom center;
        }"""

if old not in text:
    raise SystemExit("11rem block not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("mid: 78% / 13.5rem (~216px)")
