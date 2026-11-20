from pathlib import Path
lines=Path("scripts/test-m1-production-adaptive-question-loop.ts").read_text(encoding="utf-8").splitlines()
# print specific regions: Case J, Case M, FU3-A, FU3-B, FU3-G, Case E last, and handleUserMessage input around first drafts
ranges = [
 (3120, 3320), # E
 (3630, 3840), # J K L M
 (4440, 4720), # FU3 A B C D
 (4810, 4880), # G
 (2760, 2800),
]
# Actually write those line ranges
out=[]
for a,b in [
 (2768,2810),
 (2838,2890),
 (3020,3070),
 (3088,3130),
 (3200,3310),
 (3330,3370),
 (3428,3470),
 (3500,3550),
 (3560,3610),
 (3638,3675),
 (3690,3725),
 (3730,3770),
 (3775,3860),
 (3870,3910),
 (4090,4180),
 (4450,4710),
 (4828,4860),
 (4948,5040),
 (5288,5320),
]:
    out.append("="*30 + f" {a}-{b} " + "="*30)
    out.extend(f"{i}:{lines[i-1]}" for i in range(a, min(b+1, len(lines)+1)))
    out.append("")
Path("temp/_fu8_draft_regions.txt").write_text("\n".join(out), encoding="utf-8")
print("wrote regions", len(out))
