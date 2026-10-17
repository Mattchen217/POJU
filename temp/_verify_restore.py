from pathlib import Path
t = Path("public/v2-landing.html").read_text(encoding="utf-8")
print("lines", t.count("\n")+1)
for c in ["$4.99","$29.99","$9.99","Five</span> Specialized","id=\"v2-engines\"","id=\"eos-landing-v2-top\"","Unstick it","破开它"]:
    print(c, t.count(c))
