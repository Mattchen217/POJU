import sys
sys.stdout.reconfigure(encoding="utf-8")
p=r"D:\POJU\pojulife\temp\out_m24r2fu3_m1adaptive.txt"
text=open(p,encoding="utf-8",errors="replace").read()
print("len", len(text))
print(text[-15000:] if len(text)>15000 else text)
