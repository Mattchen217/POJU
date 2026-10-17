import sys,re
sys.stdout.reconfigure(encoding="utf-8")
text=open(r"public/v2-landing.html",encoding="utf-8").read()
ids=re.findall(r"<section[^>]*\bid=[\"']([^\"']+)[\"']", text, re.I)
print("sections:", ids)
i=text.find('id="eos-landing-how-get"')
# find previous closing section and next
before=text[:i]
prev_ids=re.findall(r"<section[^>]*\bid=[\"']([^\"']+)[\"']", before, re.I)
print("prev section id:", prev_ids[-1] if prev_ids else None)
after=text[i+10:]
nxt=re.search(r"<section[^>]*\bid=[\"']([^\"']+)[\"']", after, re.I)
print("next section id:", nxt.group(1) if nxt else None)
gap=text[text.find("eos-section-gap"):text.find("eos-section-gap")+900]
print("in gap CSS:", "#eos-landing-how-get" in gap)
print("HOW_GET_COPY", "HOW_GET_COPY" in text)
print("applyHowGetCopy call", "applyHowGetCopy(currentLocale)" in text)
m=re.search(r'<a href="([^"]+)"[^>]*id="eos-how-get-cta"', text)
if not m:
  m=re.search(r'id="eos-how-get-cta"[^>]*href="([^"]+)"', text)
print("cta href", m.group(1) if m else None)
print("bihan", text.count("\u5fc5\u542b"))
print("tongbu", text.count("\u540c\u6b65\u63d0\u4f9b"))
print("required30", text.lower().count("required 30"))
print("provided", text.count("provided together"))
print("zh_h2", "\u600e\u4e48\u8fd0\u4f5c\uff0c\u4f60\u5e26\u8d70\u4ec0\u4e48" in text)
print("stage5_zh", "\u540c\u6b65\u63d0\u4f9b 30 \u5929\u63d0\u9192" in text)
