import pathlib
p = pathlib.Path("lib/poju/decision-intake/types.ts")
b = p.read_bytes()
print("crlf", b.count(b"\r\n"), "lf-only", b.count(b"\n") - b.count(b"\r\n"), "bom", b.startswith(b"\xef\xbb\xbf"))
