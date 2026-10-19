from pathlib import Path
import re

p = Path(r"D:\POJU\pojulife\styles\workspace.css")
text = p.read_text(encoding="utf-8")

# 1) Add rail hover tokens after --ws-gold-soft
old_tokens = "  --ws-gold-soft: #d4af37;\n  --ws-cyan: #9cf0ff;"
new_tokens = """  --ws-gold-soft: #d4af37;
  /* Left-rail row hover/active: charcoal fill (PASS-like) + metallic gold strip */
  --ws-rail-row-hover-bg: rgba(255, 255, 255, 0.08);
  --ws-rail-gold-strip: linear-gradient(
    180deg,
    #c9a227 0%,
    #f0d78c 45%,
    #d4af37 70%,
    #a8861a 100%
  );
  --ws-cyan: #9cf0ff;"""
assert old_tokens in text, "tokens anchor missing"
text = text.replace(old_tokens, new_tokens, 1)

# 2) Account chip hover/active
old_acct = """.workspace-account-chip--button:hover,
.workspace-account-chip--button.is-active {
  background: rgba(212, 175, 55, 0.2);
  border-color: transparent;
  border-left: 2px solid #f2ca50;
  color: #f2ca50;
}"""
new_acct = """.workspace-account-chip--button:hover,
.workspace-account-chip--button.is-active {
  background: var(--ws-rail-row-hover-bg);
  border-color: transparent;
  color: #f2ca50;
}"""
assert old_acct in text, "account chip hover missing"
text = text.replace(old_acct, new_acct, 1)

# 3) Lang/legal trigger hover
old_lang = """.workspace-lang-row__trigger:hover,
.workspace-legal-row__trigger:hover {
  background: rgba(212, 175, 55, 0.08);
  color: var(--ws-gold);
}"""
new_lang = """.workspace-lang-row__trigger:hover,
.workspace-legal-row__trigger:hover {
  background: var(--ws-rail-row-hover-bg);
  color: var(--ws-gold);
}"""
assert old_lang in text, "lang/legal hover missing"
text = text.replace(old_lang, new_lang, 1)

# 4) Collapsed aria-current gold fill
old_col = """.workspace-sidebar.is-collapsed .workspace-sidebar__item[aria-current="page"] {
  background: rgba(212, 175, 55, 0.28);
  border-color: transparent;
  box-shadow: none;
}"""
new_col = """.workspace-sidebar.is-collapsed .workspace-sidebar__item[aria-current="page"] {
  background: var(--ws-rail-row-hover-bg);
  border-color: transparent;
  box-shadow: none;
}"""
assert old_col in text, "collapsed aria-current missing"
text = text.replace(old_col, new_col, 1)

# 5) Item base
old_item = """.workspace-sidebar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 0;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--ws-text-secondary);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-align: left;
  cursor: pointer;
  transition: background 200ms ease-in-out, border-color 200ms ease-in-out, color 200ms ease-in-out;
}"""
new_item = """.workspace-sidebar__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ws-text-secondary);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-align: left;
  cursor: pointer;
  transition: background 200ms ease-in-out, border-color 200ms ease-in-out, color 200ms ease-in-out;
}"""
assert old_item in text, "item base missing"
text = text.replace(old_item, new_item, 1)

# 6) Item hover + aria-current (comment may have encoding quirks)
pat = re.compile(
    r"\.workspace-sidebar__item:hover \{\n"
    r"  background: rgba\(242, 202, 80, 0\.08\);\n"
    r"  color: var\(--ws-text\);\n"
    r"\}\n"
    r"\n"
    r"/\* Parent engine .*? \*/\n"
    r"\.workspace-sidebar__item\[aria-current=\"page\"\] \{\n"
    r"  background: rgba\(212, 175, 55, 0\.2\);\n"
    r"  border-color: transparent;\n"
    r"  border-left-color: #f2ca50;\n"
    r"  color: #f2ca50;\n"
    r"  box-shadow: none;\n"
    r"  border-radius: 0;\n"
    r"\}",
    re.DOTALL,
)
m = pat.search(text)
assert m, "item hover/active block missing"
new_hover = """.workspace-sidebar__item:hover {
  background: var(--ws-rail-row-hover-bg);
  color: var(--ws-text);
}

/* Active/selected: charcoal + metallic gold left strip (see ::before below) */
.workspace-sidebar__item[aria-current="page"],
.workspace-sidebar__item.is-active {
  background: var(--ws-rail-row-hover-bg);
  border-color: transparent;
  color: #f2ca50;
  box-shadow: none;
  border-radius: 0;
}"""
text = pat.sub(new_hover, text, count=1)

# 7) Subitem hover + history active
pat2 = re.compile(
    r"\.workspace-sidebar__subitem:hover \{\n"
    r"  background: transparent;\n"
    r"  color: #fff;\n"
    r"\}\n"
    r"\n"
    r"/\* New / History:.*? \*/\n"
    r"\.workspace-sidebar__subitem--new\.is-active,\n"
    r"\.workspace-sidebar__subitem--new\[aria-current=\"page\"\],\n"
    r"\.workspace-sidebar__past-toggle\.is-active,\n"
    r"\.workspace-sidebar__past-toggle\[aria-current=\"page\"\] \{\n"
    r"  background: transparent;\n"
    r"  border-color: transparent;\n"
    r"  color: #fff;\n"
    r"  box-shadow: none;\n"
    r"\}\n"
    r"\n"
    r"\.workspace-sidebar__history-row\.is-active \.workspace-sidebar__subitem \{\n"
    r"  background: rgba\(212, 175, 55, 0\.2\);\n"
    r"  border-color: transparent;\n"
    r"  border-left: 2px solid #f2ca50;\n"
    r"  border-radius: 0;\n"
    r"  color: #f2ca50;\n"
    r"  box-shadow: none;\n"
    r"\}",
    re.DOTALL,
)
m2 = pat2.search(text)
assert m2, "subitem hover/history active missing"
new_sub = """.workspace-sidebar__subitem:hover {
  background: var(--ws-rail-row-hover-bg);
  color: #fff;
}

/* New / History toggles: text emphasis only (no fill) */
.workspace-sidebar__subitem--new.is-active,
.workspace-sidebar__subitem--new[aria-current="page"],
.workspace-sidebar__past-toggle.is-active,
.workspace-sidebar__past-toggle[aria-current="page"] {
  background: transparent;
  border-color: transparent;
  color: #fff;
  box-shadow: none;
}

.workspace-sidebar__history-row.is-active .workspace-sidebar__subitem {
  background: var(--ws-rail-row-hover-bg);
  border-color: transparent;
  border-radius: 0;
  color: #f2ca50;
  box-shadow: none;
}"""
text = pat2.sub(new_sub, text, count=1)

# 8) PASS row hover
old_pass_hover = """.workspace-pass-row__buy:hover,
.workspace-pass-row__balance:hover,
.workspace-pass-row__hint:hover {
  background: rgba(242, 202, 80, 0.08);
  color: #f2ca50;
}"""
new_pass_hover = """.workspace-pass-row__buy:hover,
.workspace-pass-row__balance:hover,
.workspace-pass-row__hint:hover {
  background: var(--ws-rail-row-hover-bg);
  color: #f2ca50;
}"""
assert old_pass_hover in text, "pass hover missing"
text = text.replace(old_pass_hover, new_pass_hover, 1)

# 9) Append shared gold-strip ::before block
anchor = "/* === Session stage timeline (11-session-stage-timeline) === */"
strip_block = """/* === Left-rail metallic gold accent strip (hover/active) === */
.workspace-sidebar__item::before,
.workspace-sidebar__subitem::before,
.workspace-account-chip--button::before,
.workspace-lang-row__trigger::before,
.workspace-legal-row__trigger::before,
.workspace-pass-row__hint::before,
.workspace-pass-row__balance::before,
.workspace-pass-row__buy::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--ws-rail-gold-strip);
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-in-out;
  z-index: 1;
}

.workspace-account-chip--button,
.workspace-lang-row__trigger,
.workspace-legal-row__trigger,
.workspace-sidebar__subitem,
.workspace-pass-row__hint,
.workspace-pass-row__balance,
.workspace-pass-row__buy {
  position: relative;
}

.workspace-sidebar__item:hover::before,
.workspace-sidebar__item[aria-current="page"]::before,
.workspace-sidebar__item.is-active::before,
.workspace-sidebar__subitem:hover::before,
.workspace-sidebar__history-row.is-active .workspace-sidebar__subitem::before,
.workspace-account-chip--button:hover::before,
.workspace-account-chip--button.is-active::before,
.workspace-lang-row__trigger:hover::before,
.workspace-legal-row__trigger:hover::before,
.workspace-pass-row__hint:hover::before,
.workspace-pass-row__balance:hover::before,
.workspace-pass-row__buy:hover::before {
  opacity: 1;
}

"""
assert anchor in text, "timeline anchor missing"
assert "Left-rail metallic gold accent strip" not in text, "strip already present"
text = text.replace(anchor, strip_block + anchor, 1)

p.write_text(text, encoding="utf-8")
print("OK")
print("hover-bg token:", "--ws-rail-row-hover-bg" in text)
print("strip block:", "Left-rail metallic gold accent strip" in text)
print("remaining rgba(242, 202, 80, 0.08) count:", text.count("rgba(242, 202, 80, 0.08)"))
print("remaining rgba(212, 175, 55, 0.2) count:", text.count("rgba(212, 175, 55, 0.2)"))
