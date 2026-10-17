# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

old = """        #v2-methodology .v2-method-card-art {
            flex: 0 0 auto;
            height: 32%;
            min-height: 5.5rem;
            max-height: 7.5rem;
            margin-top: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.75rem;
        }
        #v2-methodology .v2-method-card-art img {
            width: auto;
            height: 100%;
            max-width: 72%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }
        #v2-methodology .v2-method-left-art {
            flex: 0 0 auto;
            height: 38%;
            min-height: 7rem;
            max-height: 10rem;
            margin-top: auto;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.75rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: auto;
            height: 100%;
            max-width: 88%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

new = """        #v2-methodology .v2-method-card-art {
            flex: 0 0 auto;
            height: 32%;
            min-height: 5.5rem;
            max-height: 7.5rem;
            margin-top: auto;
            margin-left: auto;
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            padding-top: 0.75rem;
            width: auto;
            max-width: 55%;
        }
        #v2-methodology .v2-method-card-art img {
            width: auto;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom right;
        }
        #v2-methodology .v2-method-left-art {
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

if old not in text:
    raise SystemExit("art CSS block not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("left bumped; mid/right bottom-right")
