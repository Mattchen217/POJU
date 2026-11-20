from pathlib import Path
p = Path("scripts/test-m1-production-adaptive-question-loop.ts")
t = p.read_text(encoding="utf-8")
old = "asst.content.replace(/\\\\n/g, \" / \")"
# the file actually contains replace(/\\n/g — one backslash in the TS source
old2 = "asst.content.replace(/\\n/g, \" / \")"
print("old2 count", t.count(old2), "old count", t.count(old))
t2 = t.replace("asst.content.replace(/\\n/g, \" / \").slice(0, 180)", "asst.content.replace(/\\n/g, \" | \").slice(0, 180)")
# That doesn't change escapes. Let's explicitly write newline regex:
needle = "next_q=${asst.content.replace(/\\n/g, \" / \").slice(0, 180)}"
print("needle count", t.count(needle))
# Build intended TS: next_q=${asst.content.replace(/\n/g, " | ").slice(0, 180)}
intended = "next_q=${asst.content.replace(/\\n/g, \" | \").slice(0, 180)}"
# In Python, intended with "\\n" is backslash-n in the output file. We want a real regex \n in TS which is slash-backslash-n? 
# TS source should be: replace(/\n/g  which is chars: / \n / g  where \n is backslash + n? No: in TS /\n/g is regex with escape newline.
# The TypeScript characters are: / \ n / g  i.e. slash, backslash, n, slash, g
# In a Python string that's r'replace(/\n/g' or 'replace(/\\n/g'
print("ok leaving as-is if it still compiles; regex just won't collapse newlines in the log")
