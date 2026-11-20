lines = open("lib/poju/agent.ts", encoding="utf-8").read().splitlines()
# print around 160-180, 1050-1200, 1360-1450, 1680-1760
ranges = [(155,185),(1060,1200),(1360,1450),(1685,1760)]
for a,b in ranges:
    print(f"\n===== agent.ts {a}-{b} =====")
    for i in range(a-1, min(b, len(lines))):
        print(f"{i+1:4d}: {lines[i]}")
