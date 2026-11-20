from pathlib import Path
import re
t = Path('scripts/test-m1-production-adaptive-question-loop.ts').read_text(encoding='utf-8')
ids = sorted(set(re.findall(r'dir\(\s*[\'\"]([^\'\"]+)', t)))
print('dir() count', len(ids))
print('\n'.join(ids[:60]))
