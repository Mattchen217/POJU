import subprocess
from pathlib import Path

html = subprocess.check_output(
    ["git", "show", "9912f5e8:public/v2-landing.html"],
    text=True,
    encoding="utf-8",
    errors="replace",
)

# --- CSS ---
css_start = html.find("        /* Eastern OS landing v2 top block")
css_nav = html.find("#eos-landing-v2-top + nav.fixed")
i = css_nav
depth = 0
started = False
while i < len(html):
    ch = html[i]
    if ch == "{":
        depth += 1
        started = True
    elif ch == "}":
        depth -= 1
        if started and depth == 0:
            css_end = i + 1
            break
    i += 1
while css_end < len(html) and html[css_end] in "\r\n":
    css_end += 1
css = html[css_start:css_end]
Path("temp/_eos_css_extract.css").write_text(css, encoding="utf-8")
print("CSS bytes", len(css))
print("CSS head:", css[:120].replace("\n", "\\n"))
print("CSS tail:", css[-120:].replace("\n", "\\n"))

# --- HTML ---
html_start = html.find("<!-- EOS landing v2 top")
# ends at </div> immediately before <nav class="fixed
nav_pos = html.find('<nav class="fixed top-0', html_start)
# walk back to the closing </div> of eos-landing-v2-top
before = html[:nav_pos].rstrip()
assert before.endswith("</div>"), repr(before[-40:])
# include the closing </div> and a newline
html_end = len(before)
block_html = html[html_start:html_end] + "\n"
Path("temp/_eos_html_extract.html").write_text(block_html, encoding="utf-8")
print("HTML bytes", len(block_html))
print("Has 19.99", "$19.99" in block_html)
print("Has 59.99", "$59.99" in block_html)
print("HTML head:", block_html[:100].replace("\n", "\\n"))
print("HTML tail:", block_html[-150:].replace("\n", "\\n"))

# --- JS: EOS_LANDING_V2_COPY + applyEos* ---
js_start = html.find("const EOS_LANDING_V2_COPY")
# find applyEos function start slightly before or after
apply_start = html.find("function applyEos", js_start)
print("applyEos at", apply_start)
print(html[apply_start:apply_start+200])

# Find where COPY starts - may have leading blank line; include from const
# Find end of apply function: after applyEos call site or function body
# Look for usage / end
print("--- context after apply ---")
print(html[apply_start:apply_start+2500][:2500])
