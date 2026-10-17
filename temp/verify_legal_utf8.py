from pathlib import Path

files = [
    r"app/[locale]/disclaimer/page.tsx",
    r"app/[locale]/privacy/page.tsx",
    r"app/[locale]/terms/page.tsx",
    r"app/[locale]/refund/page.tsx",
    r"app/[locale]/cookies/page.tsx",
    r"components/disclaimer/disclaimer-modal.tsx",
    r"lib/config/site.ts",
    r"app/providers.tsx",
    r"styles/legal-pages.css",
]
needle = "PENDING COUNSEL REVIEW / \u987b\u771f\u4eba\u5f8b\u5e08\u786e\u8ba4"
checks = {
    "disclaimer/page": ["unified multi-turn decision dialogue", "USD $19.99", "POJU"],
    "privacy/page": ["browser-local", "Data Sovereignty Request", "POJU"],
    "terms/page": ["carryover", "Buy Pass", "expire", "POJU"],
    "refund/page": ["one-click refund", "unused", "Buy Pass", "POJU"],
    "cookies/page": ["Engineer must sync live names", "checkout host", "Stripe", "Dodo"],
    "disclaimer-modal": ["Reflective decision support", "easternos_disclaimer_", "AES-256", "Cookie"],
}

for f in files:
    p = Path(f)
    raw = p.read_bytes()
    bom = raw.startswith(b"\xef\xbb\xbf")
    t = raw.decode("utf-8-sig")
    has = needle in t
    print(f"{f}: bom={bom} banner={has} size={len(raw)}")
    for key, needles in checks.items():
        if key in f.replace("\\", "/"):
            for n in needles:
                print(f"  [{n}]: {('HIT' if n in t else 'MISS')}")

for f in ["lib/config/site.ts", "app/providers.tsx", "styles/legal-pages.css"]:
    p = Path(f)
    raw = p.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        p.write_bytes(raw[3:])
        print("stripped BOM", f)
    else:
        print("no BOM", f)

# Re-copy page files from TEMP if Chinese missing (should be present if copy was binary-correct)
src = Path(r"C:\Users\13306\AppData\Local\Temp\legal-out\disclaimer-page.tsx")
dst = Path(r"app/[locale]/disclaimer/page.tsx")
src_t = src.read_text(encoding="utf-8")
dst_t = dst.read_text(encoding="utf-8")
print("src has banner:", needle in src_t)
print("dst has banner:", needle in dst_t)
print("src==dst banner section equal:", src_t[src_t.find("PENDING"):src_t.find("PENDING")+80] == dst_t[dst_t.find("PENDING"):dst_t.find("PENDING")+80] if "PENDING" in src_t and "PENDING" in dst_t else "n/a")
if "PENDING" in dst_t:
    i = dst_t.find("PENDING")
    print("dst snippet:", repr(dst_t[i:i+60]))
