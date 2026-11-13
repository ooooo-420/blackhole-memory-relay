---
name: wuu-project-onboard
description: 把一個新資料夾接進 wuu 的記憶系統：記憶中轉站的 Hook（Claude Code 和 Codex 共用進度）、AGENTS.md／CLAUDE.md／MEMORY.md、branches/ 分支清單、黑洞的項目清單，並實測兩邊都讀得到。使用者說「接進記憶系統」「新項目」「開一個新項目」「這個資料夾也要有記憶」「接入黑洞」「讓 Codex 也接得上」時使用。也用來檢查一個已接入的項目是否還正常。
---

# 新項目接入記憶系統

記憶系統的本體在 `D:\AI記憶`（記憶中轉站）。每個項目各有一份 bridge.js 和自己的記錄，記憶互不混用。這個 skill 把一個資料夾接進來，並驗證接好了。

## 先問清楚

- **哪個資料夾、黑洞上叫什麼名字。** 名字會出現在黑洞右鍵「記憶狀態」裡，短一點。
- 資料夾不存在時，先問使用者要放在哪。工具和專案依使用者規定放在 E 槽或 D 槽，不要自己決定放 C 槽。
- 這是「改了別的項目」的動作：會動到 `D:\AI記憶\黑洞桌寵.ps1` 的項目清單（加一行）。使用者說要接入，就等於同意這一步；只想試試、不想動黑洞時加 `--no-pet`。

## 步驟

腳本在本 skill 的 `scripts/`，用 node 跑（Hook 本來就靠 node，不用另外裝）。下面 `SKILL` 指本資料夾。

1. **試跑，看會做什麼。**
   ```
   node SKILL\scripts\onboard.mjs "<項目資料夾>" "<名字>" --dry-run
   ```
   已經存在的 AGENTS.md、MEMORY.md、分支清單不會被覆蓋；`.claude/settings.json`、`.codex/hooks.json` 是合併，原有的權限等設定會留著。看到「注意」要先處理。
2. **真的接入。** 同一行拿掉 `--dry-run`。
3. **檢查。**
   ```
   node SKILL\scripts\test.mjs "<項目資料夾>"
   ```
   它在暫存資料夾裡模擬「Claude 回答 → 全新 Codex 對話收到 → Codex 回答 → 進行中的 Claude 對話收到新的那一輪」，也檢查中文沒有亂碼、沒有寫進真正的對話記錄。必須全部通過。
4. **請使用者信任 Codex 的 Hook。** Codex 沒信任就不會跑 Hook，而且不會報錯。這一步要使用者自己按，不要模擬鍵盤：
   - 找 codex.exe（資料夾名稱會隨更新改變）：`Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin\*\codex.exe"`
   - 請使用者執行 `& "<codex.exe 完整路徑>" --cd "<項目資料夾>" --no-daemon`，出現 Hooks need review 時選信任。
   - 信任綁定 Hook 內容的雜湊；以後改了 `.codex/hooks.json` 要再信任一次。
5. **用全新對話實測（真的）。**
   - Claude Code：在項目資料夾開全新對話問一個只有項目記憶才答得出的問題（例如 MEMORY.md 裡的接入日期），確認答對、記錄寫進這個項目的 `.memory-bridge/log`。
   - Codex：使用者信任後，`codex exec` 一次。資料夾不是 git 倉庫時要加 `--skip-git-repo-check`（這個參數不會略過 Hook 信任）。
   - 測完刪掉測試記錄，但 Codex 的狀態檔（`.memory-bridge/state`）留著，否則黑洞的斷線警告會誤報。
6. **黑洞重開後生效。** 改了項目清單，請使用者把黑洞休眠再喚醒（或重開），右鍵「記憶狀態」應該多一行。
7. **回報並記錄。**
   - 在新項目的 MEMORY.md「目前狀態」記接入日期和實測結果，沒實測的寫未驗證。
   - 在 `D:\AI記憶\MEMORY.md` 的記憶橋接那一節補一句「接入第 N 個項目」。
   - 其他項目的 AGENTS.md 裡「各自維護」那句只列了當時的項目。要不要補上新項目，問使用者，不要自己改。

## 已經踩過的坑（腳本已處理，出問題時先查這些）

- 項目根目錄的 `package.json` 設了 `"type": "module"` 時 bridge.js 會靜默失效，對話照常但什麼都沒存。`.memory-bridge/package.json`（commonjs）就是為了擋這個；所以接完一定要跑 test.mjs，不能只看對話正常。
- 黑洞是 Windows PowerShell 5.1 跑的：腳本檔沒有 BOM 時中文會變亂碼。onboard.mjs 寫回時固定帶 BOM、保留原本的換行格式。
- bridge.js 四份要一致。記憶中轉站更新了 bridge.js 之後，對每個項目跑 `onboard.mjs ... --update-bridge` 換新版，再各跑一次 test.mjs。
- `claude -p --resume` 會換新的 session，被當成新對話；測「進行中的對話」用 test.mjs 的模擬，不用 resume。
- 讀中文檔要先 `chcp 65001`，`Get-Content` 要加 `-Encoding UTF8`。

## 不要做

- 不要把帳號、密碼、金鑰、連線網址寫進任何記憶檔。對話會以明文存在 `.memory-bridge/log`，所以 `.gitignore` 一定要排除它（腳本會加）。
- 不要手動改 `.memory-bridge/log` 和 `state` 裡的記錄。
- 不要用模擬滑鼠或鍵盤去按 Codex 的信任，也不要在使用者桌面跳置頂視窗測試。
