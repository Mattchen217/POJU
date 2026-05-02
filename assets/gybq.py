import requests
from bs4 import BeautifulSoup
import time
import os
import json
import re

# --- 配置参数 ---
BASE_URL = "https://www.zgjmorg.com/chouqian/guanyin/{}.html"
SAVE_FILE = "guanyin_final_data.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def load_db():
    if os.path.exists(SAVE_FILE):
        try:
            with open(SAVE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"last_id": 0, "items": []}
    return {"last_id": 0, "items": []}

def save_db(db):
    with open(SAVE_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=4)

def start_crawl():
    db = load_db()
    start_id = db["last_id"] + 1
    
    if start_id > 100:
        print("🎉 任务已完成，JSON 文件已备好！")
        return

    print(f"🚀 准备攻克：从第 {start_id} 签开始...")

    for i in range(start_id, 101):
        url = BASE_URL.format(i)
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.encoding = 'utf-8'
            
            if resp.status_code != 200:
                print(f"❌ 第 {i} 签请求失败 (HTTP {resp.status_code})")
                continue

            soup = BeautifulSoup(resp.text, 'html.parser')
            # 拿到所有文本，转为列表
            lines = [l.strip() for l in soup.get_text(separator="\n").split('\n') if l.strip()]

            # --- 核心改进：模糊寻找标题行 ---
            start_index = -1
            # 我们找包含 "观音灵签解签" 且包含数字 i 的那一行
            for idx, line in enumerate(lines):
                # 逻辑：这一行里有“解签”且有数字 i，且长度不太长（避开长段落）
                if "观音灵签解签" in line and str(i) in line and len(line) < 60:
                    start_index = idx
                    break
            
            if start_index != -1:
                # 截取从标题开始到“上一篇”或“相关文章”为止
                content_lines = []
                for line in lines[start_index:]:
                    if "上一篇" in line or "相关文章" in line or "网友评论" in line:
                        break
                    content_lines.append(line)
                
                if content_lines:
                    # 组合 JSON 条目
                    new_item = {
                        "id": i,
                        "title": content_lines[0], # 这一行就是我们要的：1 观音灵签解签1: XXX
                        "content": "\n".join(content_lines[1:]),
                        "crawled_at": time.strftime("%Y-%m-%d %H:%M:%S")
                    }
                    db["items"].append(new_item)
                    db["last_id"] = i
                    save_db(db)
                    print(f"✅ 第 {i} 签抓取成功：{content_lines[0]}")
                else:
                    print(f"⚠️ 第 {i} 签截取失败（内容列表为空）")
            else:
                # 如果还是找不到，为了防止死循环，记录进度但提示失败
                db["last_id"] = i
                save_db(db)
                print(f"❌ 第 {i} 签在页面文字中彻底定位不到包含 '观音灵签解签' 和 '{i}' 的行")

            time.sleep(1) # 稍微歇口气

        except Exception as e:
            print(f"🚨 第 {i} 签发生异常: {e}")
            break

    print(f"\n🎉 运行结束！结果就在当前目录的: {SAVE_FILE}")

if __name__ == "__main__":
    start_crawl()