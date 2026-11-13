"""檢查作品集頁面：截桌面和手機封面，把四個面板各打開一次，印出頁面錯誤和對外網路請求數。
線上原始檔會載入網路字體，所以有網路請求是正常的；離線版必須是 0 個。
用法：python check_page.py <html 路徑或網址> <截圖輸出資料夾>"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

if len(sys.argv) < 3:
    sys.exit(__doc__)
src = sys.argv[1]
url = src if src.startswith("http") else Path(src).as_uri()
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]  # 無頭模式也能跑 WebGL
errs, reqs = [], []


def watch(pg):
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("request", lambda r: reqs.append(r.url) if not r.url.startswith(("file:", "data:", "blob:", "about:")) else None)


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True, args=GL)
    pg = b.new_page(viewport={"width": 1440, "height": 900}); watch(pg)
    pg.goto(url); pg.wait_for_timeout(3500)
    pg.screenshot(path=str(out / "cover_desktop.png"))
    opened = []
    for i in range(4):
        pg.evaluate(f"document.querySelector('[data-open=\"{i}\"]').click()")
        try:
            pg.wait_for_function(f"document.getElementById('p{i}').classList.contains('on')", timeout=8000)
            pg.wait_for_timeout(1500)
            pg.screenshot(path=str(out / f"panel_{i}.png"))
            opened.append(i)
        except Exception:
            errs.append(f"面板 p{i} 沒打開")
        pg.keyboard.press("Escape")
        try:
            pg.wait_for_function("window.__S && window.__S.mode==='free'", timeout=8000)
        except Exception:
            errs.append(f"面板 p{i} 關不掉")
        pg.wait_for_timeout(300)
    pg.close()
    pg = b.new_page(viewport={"width": 390, "height": 844}); watch(pg)
    pg.goto(url); pg.wait_for_timeout(3000)
    pg.screenshot(path=str(out / "cover_phone.png"))
    b.close()

print("打開的面板：", opened)
print("錯誤：", len(errs), errs[:5])
print("對外網路請求：", len(reqs), sorted({u.split('/')[2] for u in reqs}))
print("截圖在：", out)
sys.exit(1 if errs else 0)
