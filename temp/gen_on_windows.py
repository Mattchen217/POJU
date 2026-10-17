import sys, json
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
COPY = json.loads(Path(r"D:\POJU\pojulife\temp\how_get_copy.json").read_text(encoding="utf-8"))
en = COPY["en"]
PATH = Path(r"D:\POJU\pojulife\public\v2-landing.html")
text = PATH.read_text(encoding="utf-8")
assert 'id="eos-landing-how-get"' not in text
NL = "\n"
def micro(a,b,c,d):
    return '<p class="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"><span class="text-primary font-bold text-[10px] md:text-xs uppercase tracking-wide mr-1" data-howget="'+a+'">'+b+'</span><span data-howget="'+c+'">'+d+'</span></p>'
def card(n,title,rows):
    body = NL.join(micro(*r) for r in rows)
    num = "%02d"%n
    return '<div class="p-5 md:p-6 border border-slate-200 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/[0.01] text-left" data-howget-stage="'+str(n)+'">'+NL+'<div class="text-primary font-display font-bold text-sm md:text-base tracking-wide mb-3" data-howget="stage'+str(n)+'.label">'+num+'</div>'+NL+'<h3 class="font-bold text-sm md:text-base text-slate-900 dark:text-white mb-3" data-howget="stage'+str(n)+'.title">'+title+'</h3>'+NL+'<div class="space-y-2">'+NL+body+NL+'</div>'+NL+'</div>'
s1=card(1,en["stage1.title"],[("labelYou",en["labelYou"],"stage1.you",en["stage1.you"]),("labelWe",en["labelWe"],"stage1.we",en["stage1.we"]),("labelYouGet",en["labelYouGet"],"stage1.youGet",en["stage1.youGet"])])
s2=card(2,en["stage2.title"],[("labelWe",en["labelWe"],"stage2.we",en["stage2.we"]),("labelYou",en["labelYou"],"stage2.you",en["stage2.you"]),("labelYouGet",en["labelYouGet"],"stage2.youGet",en["stage2.youGet"])])
s3=card(3,en["stage3.title"],[("labelYou",en["labelYou"],"stage3.you",en["stage3.you"]),("labelWe",en["labelWe"],"stage3.we",en["stage3.we"]),("labelYouGet",en["labelYouGet"],"stage3.youGet",en["stage3.youGet"])])
s4=card(4,en["stage4.title"],[("labelWe",en["labelWe"],"stage4.we",en["stage4.we"]),("labelYou",en["labelYou"],"stage4.you",en["stage4.you"]),("labelYouGet",en["labelYouGet"],"stage4.youGet",en["stage4.youGet"])])
s5=card(5,en["stage5.title"],[("labelWe",en["labelWe"],"stage5.we",en["stage5.we"]),("labelYou",en["labelYou"],"stage5.you",en["stage5.you"]),("labelYouGet",en["labelYouGet"],"stage5.youGet",en["stage5.youGet"])])
parts=[]
parts.append('<section class="relative" id="eos-landing-how-get">')
parts.append('<div class="max-w-7xl mx-auto px-6"><div class="text-center mb-12">')
parts.append('<h2 id="eos-how-get-h2" class="text-2xl md:text-3xl font-display font-bold mb-4"><span class="gold-gradient glow-effect inline-block" data-howget="h2">'+en["h2"]+'</span></h2>')
parts.append('<p id="eos-how-get-sub" class="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto" data-howget="sub">'+en["sub"]+'</p></div>')
parts.append('<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">')
parts.extend([s1,s2,s3])
parts.append('</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl lg:max-w-4xl mx-auto mb-6">')
parts.extend([s4,s5])
parts.append('</div><div class="mt-16 md:mt-20 pt-12 md:pt-16 border-t border-slate-200/50 dark:border-white/10"><div class="text-center mb-10">')
parts.append('<h3 id="eos-how-get-list-h3" class="text-xl md:text-2xl font-display font-bold"><span class="gold-gradient glow-effect inline-block" data-howget="listH3">'+en["listH3"]+'</span></h3></div>')
parts.append('<div class="grid grid-cols-1 md:grid-cols-3 gap-6">')
for i in (1,2,3):
  parts.append('<div class="p-5 md:p-6 border border-slate-200 dark:border-white/5 rounded-lg bg-slate-50 dark:bg-white/[0.01] text-center"><span class="inline-flex items-center justify-center w-8 h-8 mb-3 text-primary text-lg" aria-hidden="true">&#10003;</span><p class="text-sm md:text-base text-slate-700 dark:text-slate-200 leading-relaxed" data-howget="item'+str(i)+'">'+en["item"+str(i)]+'</p></div>')
parts.append('</div>')
parts.append('<p id="eos-how-get-close" class="text-center text-sm text-slate-500 dark:text-slate-400 mt-6" data-howget="close">'+en["close"]+'</p>')
parts.append('<div class="mt-10 flex justify-center"><a href="/app" target="_top" id="eos-how-get-cta" class="v2-hero-cta-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold tracking-wide shadow-xl shadow-primary/25"><span data-howget="cta">'+en["cta"]+'</span><span class="material-icons-outlined text-base" aria-hidden="true">arrow_forward</span></a></div></div></div></section>')
SECTION=NL.join(parts)
old_pt=("        #eos-landing-scenarios,"+NL+"        #v2-engines,"+NL+"        #v2-methodology,"+NL+"        #v2-team-section,"+NL+"        #v2-pricing,"+NL+"        #v2-faq {"+NL+"            padding-top: var(--eos-section-gap) !important;"+NL+"        }")
new_pt=("        #eos-landing-scenarios,"+NL+"        #v2-engines,"+NL+"        #v2-methodology,"+NL+"        #eos-landing-how-get,"+NL+"        #v2-team-section,"+NL+"        #v2-pricing,"+NL+"        #v2-faq {"+NL+"            padding-top: var(--eos-section-gap) !important;"+NL+"        }")
assert old_pt in text
text=text.replace(old_pt,new_pt,1)
old_pb=("        #eos-landing-scenarios,"+NL+"        #v2-engines,"+NL+"        #v2-methodology,"+NL+"        #v2-team-section,"+NL+"        #v2-pricing {"+NL+"            padding-bottom: 0 !important;"+NL+"        }")
new_pb=("        #eos-landing-scenarios,"+NL+"        #v2-engines,"+NL+"        #v2-methodology,"+NL+"        #eos-landing-how-get,"+NL+"        #v2-team-section,"+NL+"        #v2-pricing {"+NL+"            padding-bottom: 0 !important;"+NL+"        }")
assert old_pb in text
text=text.replace(old_pb,new_pb,1)
MARKER='<section class="relative reveal" id="v2-team-section">'
assert MARKER in text
text=text.replace(MARKER,SECTION+NL+MARKER,1)
js=["            const HOW_GET_COPY = {"+NL]
for loc in ("en","zh"):
  js.append("              "+loc+": {"+NL)
  for k,v in COPY[loc].items():
    js.append("                "+json.dumps(k,ensure_ascii=False)+": "+json.dumps(v,ensure_ascii=False)+","+NL)
  js.append("              },"+NL)
js.append("            };"+NL+NL)
js.append("            function applyHowGetCopy(locale) {"+NL)
js.append("              const pack = HOW_GET_COPY[locale] || HOW_GET_COPY.en;"+NL)
js.append("              if (!pack) return;"+NL)
js.append("              document.querySelectorAll('[data-howget]').forEach((el) => {"+NL)
js.append("                const key = el.getAttribute('data-howget');"+NL)
js.append("                if (!key || typeof pack[key] !== 'string') return;"+NL)
js.append("                el.innerHTML = pack[key];"+NL)
js.append("              });"+NL)
js.append("            }"+NL+NL)
HOW="".join(js)
APPLY=("            function applyBuiltCopy(locale) {"+NL+"              const pack = BUILT_COPY[locale] || BUILT_COPY.en;"+NL+"              if (!pack) return;"+NL+"              document.querySelectorAll('[data-built]').forEach((el) => {"+NL+"                const key = el.getAttribute('data-built');"+NL+"                if (!key || typeof pack[key] !== 'string') return;"+NL+"                el.innerHTML = pack[key];"+NL+"              });"+NL+"            }"+NL+NL+"const ENGINE_COPY = {")
assert APPLY in text
text=text.replace(APPLY,APPLY.replace("const ENGINE_COPY = {",HOW+"const ENGINE_COPY = {"),1)
old_o=("            applyPricingCopy(currentLocale);"+NL+NL+"            applyBuiltCopy(currentLocale);"+NL+"            applyEngineCopy(currentLocale);"+NL+"            applyTeamCopy(currentLocale);"+NL+"            applyFaqCopy(currentLocale);")
new_o=("            applyPricingCopy(currentLocale);"+NL+NL+"            applyBuiltCopy(currentLocale);"+NL+"            applyHowGetCopy(currentLocale);"+NL+"            applyEngineCopy(currentLocale);"+NL+"            applyTeamCopy(currentLocale);"+NL+"            applyFaqCopy(currentLocale);")
assert old_o in text
text=text.replace(old_o,new_o,1)
PATH.write_text(text,encoding="utf-8",newline="\n")
print("OK")
print("section", 'id="eos-landing-how-get"' in text)
print("apply", "applyHowGetCopy(currentLocale)" in text)
print("bihan", text.count("\u5fc5\u542b"))
print("tongbu", text.count("\u540c\u6b65\u63d0\u4f9b"))
print("provided", text.count("provided together"))
