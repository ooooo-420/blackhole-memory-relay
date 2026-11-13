"""把一個 HTML 草圖截成 PNG（整頁）。用系統的 Edge，不用另外下載瀏覽器。
用法：python render.py <草圖.html> <輸出.png> [寬度，預設 1500] [清晰度倍數，預設 1.5]
需要裝了 playwright 的 Python。草圖裡用到網路字體時要連得上網；頁面出錯會印出來。"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

if len(sys.argv) < 3:
    sys.exit(__doc__)
src, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
width = int(sys.argv[3]) if len(sys.argv) > 3 else 1500
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5
out.parent.mkdir(parents=True, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": width, "height": 900}, device_scale_factor=scale)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("requestfailed", lambda r: errs.append("載入失敗 " + r.url))
    pg.goto(src.as_uri(), wait_until="networkidle")
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(out), full_page=True)
    b.close()
print("已存：", out)
print("問題：", errs if errs else "沒有")
