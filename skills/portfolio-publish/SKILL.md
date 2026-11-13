---
name: portfolio-publish
description: 更新、發布或檢查使用者的作品集（wuu 作品集，黑洞頁）。使用者說「更新作品集」「改作品集」「作品集封面」「把這個項目放進作品集」「更新離線版」「離線作品集」時使用。涵蓋：改哪個檔、本機檢查、推到 GitHub Pages、同步私人 Artifact、重做離線版、在哪裡記錄。任何項目的對話都可以用。
---

# 作品集發布

使用者的作品集只有一個原始檔，發布到三個地方。改完原始檔後，照下面的順序做；每一步做完才做下一步。

## 檔案和位置

| 用途 | 位置 |
|---|---|
| 原始檔（只改這個） | `D:\AI記憶\公開版\index.html` |
| 線上版（GitHub Pages） | 倉庫 `ooooo-420/blackhole-memory-relay` 的 `index.html` → https://ooooo-420.github.io/blackhole-memory-relay/ |
| 私人 Artifact | https://claude.ai/artifact/<你的 Artifact 編號> |
| 離線版 | `D:\AI記憶\作品集離線版\wuu-portfolio.html` 和同資料夾的 `wuu-portfolio.zip`，由 `build-offline.mjs` 產生 |
| 記錄 | `D:\AI記憶\MEMORY.md`（作品集那一節）；如果是從別的項目發起的，那個項目的記憶檔也記一句 |

`D:\AI記憶` 是另一個項目的資料夾。只在使用者明確要求改作品集時才動它，而且只動上表列的檔案。

## 使用者定下的規則（不要違反）

- 首頁（字塊、文字吸積盤、底部作品名）一律英文；語言按鈕只切換面板內容（繁／簡／英）。
- 作品名稱固定：Live Dundun / Memory Relay / Resume Studio / Personal Hub。直播蹲蹲在作品集、GitHub、README 永遠叫「直播蹲蹲 / Live Dundun」，不改成小程序裡的名字「目候」。
- 不加解釋性的小字備註或標語。要提示「可以點」，用動作表達，不用文字。
- 新作品要成為第一眼注意到的那個，但不靠單純放大。
- 動到構圖或視覺的改動，先出草圖或截圖讓使用者選，確認後才上線。使用者已經明確說要改什麼時，直接改。
- 不把任何帳號、金鑰、AppID、環境 ID 寫進這個頁面。倉庫是公開的。

## 步驟

需要一個裝了 Playwright 的 Python。這台電腦上可用的是 `E:\Claude\tiktok直播監控\.venv\Scripts\python.exe`；它不在時，改用任何有 `playwright` 的 Python（瀏覽器用系統的 Edge，不用另外下載）。下面用 `PY` 代表它，`SKILL` 代表本資料夾。

1. **改原始檔。** 檔案裡有一段很長的 base64 字體，讀檔時用 offset／limit 或 Grep 找位置，不要整檔讀。
2. **本機檢查。**
   ```
   PY SKILL\scripts\check_page.py "D:\AI記憶\公開版\index.html" <截圖輸出資料夾>
   ```
   它會截桌面和手機封面、把四個面板各打開一次，印出頁面錯誤。錯誤清單必須是空的。自己看一眼截圖再往下走。
3. **推到 GitHub Pages。**
   ```
   PY SKILL\scripts\push_pages.py "一句英文說明改了什麼"
   ```
   用的是 `gh`（已登入）。推完等一兩分鐘，抓線上頁面確認含有這次改動裡的一個字串。
4. **同步 Artifact。** 把原始檔複製到這次對話的 scratchpad，先用 Artifact 工具 `read` 那個網址（沒讀過就發布會被拒絕），確認線上版沒有別處改過而本機沒有的內容，再帶同一個 `url` 發布。它是私人的，只有使用者自己看得到。
5. **離線版：使用者有說才做。** 沒說就不做，並在最後告訴使用者「離線版沒重做」。要做時：
   ```
   cd "D:\AI記憶\作品集離線版"; node build-offline.mjs
   Compress-Archive -LiteralPath "D:\AI記憶\作品集離線版\wuu-portfolio.html" -DestinationPath "D:\AI記憶\作品集離線版\wuu-portfolio.zip" -Force
   PY SKILL\scripts\check_page.py "D:\AI記憶\作品集離線版\wuu-portfolio.html" <截圖輸出資料夾>
   ```
   直接覆蓋舊檔，使用者不想手動刪。離線版的檢查結果必須是「網路請求 0 個、錯誤 0 個」。
6. **記錄。** 在 `D:\AI記憶\MEMORY.md` 的作品集那一節補一句：改了什麼、推了哪幾處、Artifact 第幾版、離線版有沒有重做。

## 回報時要說清楚

- 三個地方各自更新了沒有。沒做的要明說，尤其是離線版。
- 檢查是用無頭瀏覽器做的，不等於使用者親眼看過；手機上的實際觀感沒驗證時要說。
