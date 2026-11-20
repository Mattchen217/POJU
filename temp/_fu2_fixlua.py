from pathlib import Path
p = Path("temp/_fu2_lua_new.txt")
t = p.read_text(encoding="utf-8")
# remove the extra final end before the last blank
old = "    if head['change_type'] == 'freeze' or head['dc_status'] == 'final' then\n      return 3\n    end\n  end\nend\n\n"
new = "    if head['change_type'] == 'freeze' or head['dc_status'] == 'final' then\n      return 3\n    end\n  end\nend\n\n"
# Wait that's the same. The extra end is: inner freeze end, endVersion end, intake end, EXTRA end.
print(t.endswith("    end\n  end\nend\n\n"))
# Fix: should be freeze end, endVersion end, intake end
fixed = t.replace(
    "    if head['change_type'] == 'freeze' or head['dc_status'] == 'final' then\n      return 3\n    end\n  end\nend\n\n",
    "    if head['change_type'] == 'freeze' or head['dc_status'] == 'final' then\n      return 3\n    end\n  end\nend\n\n",
    1,
)
print('need different replacement')
print(repr(t[-60:]))
# actually count trailing ends
idx = t.rfind("if endVersion > 0")
print(t[idx:])
