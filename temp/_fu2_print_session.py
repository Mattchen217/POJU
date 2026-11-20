lines = open("lib/poju/types.ts", encoding="utf-8").read().splitlines()
# print POJUSessionState fully (starts 248, file is 452)
for i in range(247, len(lines)):
    print(f"{i+1:4d}: {lines[i]}")
