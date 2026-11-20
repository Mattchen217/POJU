# Run all FU1 patches in order. Execute from the repo root.
import os
import runpy
from pathlib import Path

here = Path(__file__).resolve().parent
cwd = os.environ.get("POJU_ROOT", os.getcwd())
os.chdir(cwd)
print("POJU_ROOT", os.getcwd())
scripts = [
    "p1_types.py",
    "p2_model.py",
    "p3_interp.py",
    "p3b_splice.py",
    "p4_tests_af.py",
    "p5_splice_gm.py",
]
for name in scripts:
    path = here / name
    print("==>", name)
    runpy.run_path(str(path), run_name="__main__")
print("ALL PATCHES APPLIED")
