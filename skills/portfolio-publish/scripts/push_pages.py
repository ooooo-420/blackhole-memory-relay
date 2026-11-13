"""把作品集原始檔推到 GitHub Pages 的倉庫。需要已登入的 gh。
用法：python push_pages.py "commit message" [原始檔路徑]"""
import base64, json, subprocess, sys, tempfile
from pathlib import Path

REPO, PATH = "ooooo-420/blackhole-memory-relay", "index.html"
SRC = Path(sys.argv[2] if len(sys.argv) > 2 else r"D:\AI記憶\公開版\index.html")


def gh(*args):
    r = subprocess.run(["gh", "api", *args], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        sys.exit("gh 失敗：" + r.stderr[:500])
    return json.loads(r.stdout)


if len(sys.argv) < 2:
    sys.exit(__doc__)
data = SRC.read_bytes()
cur = gh(f"repos/{REPO}/contents/{PATH}")
if base64.b64decode(cur["content"]) == data:
    print("線上已經是這一版，沒有推。")
    sys.exit(0)
with tempfile.TemporaryDirectory() as d:
    body = Path(d) / "body.json"
    body.write_text(json.dumps({"message": sys.argv[1], "content": base64.b64encode(data).decode(), "sha": cur["sha"]}), encoding="utf-8")
    out = gh("-X", "PUT", f"repos/{REPO}/contents/{PATH}", "--input", str(body))
print("已推上去：commit", out["commit"]["sha"][:7], f"（{len(data)} bytes）")
print("線上網址：https://ooooo-420.github.io/blackhole-memory-relay/ （一兩分鐘後生效）")
