# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

old = """        #v2-methodology .v2-method-left-art {
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

new = """        #v2-methodology .v2-method-left-art {
            /* was capped by max-height:14rem — card grew, ink stayed tiny */
            flex: 1 1 48%;
            min-height: 0;
            max-height: none;
            margin-top: 0.5rem;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            width: 100%;
            padding-top: 0.25rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: 92%;
            height: auto;
            max-width: 95%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

if old not in text:
    raise SystemExit("left art CSS not found exact")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("removed max-height:14rem; left art flex 48% + width 92%")
