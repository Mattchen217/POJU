lines = open("lib/poju/agent.ts", encoding="utf-8").read().splitlines()
print("===== 1220-1280 adopt m1 session =====")
for i in range(1219, 1280):
    print(f"{i+1:4d}: {lines[i]}")
print("\n===== 1755-1800 readiness merge =====")
for i in range(1754, min(1820, len(lines))):
    print(f"{i+1:4d}: {lines[i]}")
