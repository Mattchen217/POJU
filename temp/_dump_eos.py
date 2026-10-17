import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r"D:\POJU\pojulife\public\v2-landing.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
    lines = text.splitlines(True)

# find EOS_SCENARIOS_COPY
idx = text.find("EOS_SCENARIOS_COPY")
print("EOS_SCENARIOS_COPY at char", idx)
# find line number
pos = 0
for i, l in enumerate(lines, 1):
    if "EOS_SCENARIOS_COPY" in l:
        print(f"line {i}: {l.rstrip()[:120]}")
        
out = r"D:\POJU\pojulife\temp\_eos_copy_block.txt"
with open(out, "w", encoding="utf-8") as o:
    # dump SCENARIOS_COPY and EOS_SCENARIOS_COPY fully
    start = None
    for i, l in enumerate(lines):
        if "const SCENARIOS_COPY" in l or "const EOS_SCENARIOS_COPY" in l:
            start = i
            break
    # better: find both blocks
    for name in ["const SCENARIOS_COPY", "const EOS_SCENARIOS_COPY"]:
        for i, l in enumerate(lines):
            if name in l:
                # dump until matching }; at indent that closes
                o.write(f"\n===== {name} starting line {i+1} =====\n")
                depth = 0
                started = False
                for j in range(i, min(i+200, len(lines))):
                    o.write(f"{j+1}|{lines[j]}")
                    if "{" in lines[j]:
                        depth += lines[j].count("{")
                        started = True
                    if "}" in lines[j]:
                        depth -= lines[j].count("}")
                    if started and depth <= 0:
                        break
                break
    # also apply locale
    o.write("\n===== apply locale =====\n")
    for i in range(3805, 3860):
        o.write(f"{i+1}|{lines[i]}")
print("wrote", out)
