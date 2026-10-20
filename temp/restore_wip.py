import shutil
from pathlib import Path
backup = Path("temp/l5-wip-backup")
mapping = {
    "messages__en.json": "messages/en.json",
    "messages__zh.json": "messages/zh.json",
    "messages__es.json": "messages/es.json",
    "messages__fr.json": "messages/fr.json",
    "public__v2-landing.html": "public/v2-landing.html",
}
for src_name, dest in mapping.items():
    src = backup / src_name
    shutil.copy2(src, dest)
    print("restored WIP", dest)
