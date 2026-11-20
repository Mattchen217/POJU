from pathlib import Path
for name in sorted(Path("temp").glob("_fu2_fail_chunk_*.txt")):
    if name.stem.split("_")[-1] in {"39","67","110","139","186"}:
        print("="*60, name.name)
        print(name.read_text(encoding="utf-8")[:3500])
        print()
