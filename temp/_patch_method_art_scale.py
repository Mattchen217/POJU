# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = path.read_text(encoding="utf-8")

old_css = """        #v2-methodology .v2-method-mid-grid > .v2-method-card {
            min-height: clamp(17rem, 30vw, 23rem);
        }
        #v2-methodology .v2-method-card-art {
            flex: 1 1 48%;
            min-height: 9.5rem;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.5rem;
        }
        #v2-methodology .v2-method-card-art img {
            width: 100%;
            height: 100%;
            max-height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }
        #v2-methodology .v2-method-left-art {
            flex: 1 1 48%;
            min-height: 0;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-top: 0.5rem;
        }
        #v2-methodology .v2-method-left-art img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: bottom center;
        }"""

new_css = """        #v2-methodology .v2-method-mid-grid > .v2-method-card {
            min-height: 0;
        }
        #v2-methodology .v2-method-card-art {
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

if old_css not in text:
    raise SystemExit("old art CSS block not found")
text = text.replace(old_css, new_css, 1)
path.write_text(text, encoding="utf-8")
print("art scale dialed back")
# quick sanity
assert "max-height: 7.5rem" in text
assert "flex: 1 1 48%" not in text.split("Methodology cards: type hierarchy")[1].split("</style>")[0]
print("ok")
