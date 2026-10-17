path = r"public/v2-landing.html"
with open(path, encoding="utf-8") as f:
    t = f.read()
checks = [
    "v2-nav-install",
    "data-nav-install-label",
    "navInstall: 'Install app'",
    "navInstall: '添加到桌面'",
    "shouldShowNavInstall",
    "void handleInstallClick()",
    "v2-hero-cta-desktop",
    "What's in one PASS",
    "一次 PASS 有什么",
    "openInstallModal",
    "eastern-os-v2-landing:pwa-install",
]
for c in checks:
    print(("FOUND" if c in t else "MISSING"), c, "count=", t.count(c))
# ensure secondary button markup gone
if 'id="v2-hero-cta-desktop"' in t:
    print("FAIL: secondary button still in HTML")
else:
    print("OK: secondary hero button removed from HTML")
# dump nav snippet
i = t.find('id="v2-nav-install"')
print("--- nav ---")
print(t[i-80:i+350])
print("--- sync ---")
i = t.find("function shouldShowNavInstall")
print(t[i:i+900])
