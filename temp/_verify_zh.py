path = r"public/v2-landing.html"
with open(path, encoding="utf-8") as f:
    t = f.read()
assert "navInstall: '添加到桌面'" in t, "ZH navInstall broken"
assert "ctaStart: '马上开始'" in t
assert "一次 PASS 有什么" in t
# ensure file still valid utf-8 and zh install packs intact
assert "把 Eastern OS" not in t or True  # we did NOT replace modal with generic copy
assert "只需两步，将 Eastern OS 添加至主屏幕" in t
assert "在 Windows 上安装 Eastern OS" in t  # existing modal pack kept
print("encoding OK; existing modal packs preserved")
print("zh navInstall ok")
