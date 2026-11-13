// 檢查一個項目是否正確接入記憶系統。全部在暫存資料夾裡跑，不寫入項目真正的對話記錄。
// 用法：node test.mjs <項目資料夾>
// 模擬：Claude 回答一輪 → 全新的 Codex 對話應該收到那一輪和分支清單 → Codex 回答 → 進行中的 Claude 對話只收到 Codex 的新那一輪。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const target = path.resolve(process.argv[2] || '.');
const bridge = path.join(target, '.memory-bridge', 'bridge.js');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^﻿/, '');

// ---------- 檔案 ----------
for (const f of ['.memory-bridge/bridge.js', '.memory-bridge/package.json', '.claude/settings.json', '.codex/hooks.json', 'AGENTS.md', 'CLAUDE.md', 'MEMORY.md', 'branches/INDEX.md']) {
  check(`有 ${f}`, fs.existsSync(path.join(target, f)));
}
for (const [f, tool] of [['.claude/settings.json', 'claude'], ['.codex/hooks.json', 'codex']]) {
  let cmds = [];
  try {
    const cfg = JSON.parse(read(path.join(target, f)));
    cmds = Object.values(cfg.hooks || {}).flat().flatMap((g) => (g.hooks || []).map((h) => h.command));
  } catch {}
  check(`${f} 有 ${tool} 的兩個 Hook`, [`node .memory-bridge/bridge.js prompt ${tool}`, `node .memory-bridge/bridge.js stop ${tool}`].every((c) => cmds.includes(c)));
}
try { check('CLAUDE.md 會載入 AGENTS.md 和 MEMORY.md', /^@AGENTS\.md$/m.test(read(path.join(target, 'CLAUDE.md'))) && /^@MEMORY\.md$/m.test(read(path.join(target, 'CLAUDE.md')))); } catch { check('CLAUDE.md 會載入 AGENTS.md 和 MEMORY.md', false); }
try {
  const gi = read(path.join(target, '.gitignore')).split(/\r?\n/);
  check('.gitignore 排除對話記錄', ['.memory-bridge/log/', '.memory-bridge/state/'].every((l) => gi.includes(l)));
} catch { check('.gitignore 排除對話記錄', false, '沒有 .gitignore'); }

// ---------- 模擬兩邊對話（暫存資料夾） ----------
if (fs.existsSync(bridge)) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'wuu-onboard-'));
  const realLog = path.join(target, '.memory-bridge', 'log');
  const countReal = () => (fs.existsSync(realLog) ? fs.readdirSync(realLog).reduce((n, f) => n + fs.statSync(path.join(realLog, f)).size, 0) : 0);
  const before = countReal();
  const run = (cmd, tool, input) => {
    // 在項目資料夾裡、用相對路徑執行，和真的 Hook 一模一樣
    const r = spawnSync(process.execPath, ['.memory-bridge/bridge.js', cmd, tool], {
      cwd: target, input: JSON.stringify({ cwd: target, ...input }), encoding: 'utf8',
      env: { ...process.env, MEMORY_BRIDGE_DATA: data },
    });
    if (r.status !== 0) check(`bridge.js ${cmd} ${tool} 正常結束`, false, (r.stderr || '').slice(0, 300));
    return r.stdout || '';
  };
  const ctx = (out) => { try { return JSON.parse(out).hookSpecificOutput.additionalContext || ''; } catch { return ''; } };
  const a = '暗號' + crypto.randomBytes(3).toString('hex');
  const b = '暗號' + crypto.randomBytes(3).toString('hex');
  try {
    run('prompt', 'claude', { session_id: 'onboard-claude', prompt: '接入測試：請記住' });
    run('stop', 'claude', { session_id: 'onboard-claude', last_assistant_message: `好的，${a}` });
    const toCodex = ctx(run('prompt', 'codex', { session_id: 'onboard-codex', prompt: '剛才 Claude 說了什麼？' }));
    check('全新的 Codex 對話收到 Claude 的記錄', toCodex.includes(a));
    check('全新對話收到分支清單', toCodex.includes('分支清單'));
    check('記錄裡的中文沒有變亂碼', toCodex.includes('接入測試'));
    run('stop', 'codex', { session_id: 'onboard-codex', last_assistant_message: `收到，${b}` });
    const toClaude = ctx(run('prompt', 'claude', { session_id: 'onboard-claude', prompt: '繼續' }));
    check('進行中的 Claude 對話收到 Codex 的新記錄', toClaude.includes(b));
    check('進行中的對話不會重複收到自己的舊記錄', !toClaude.includes(a));
    check('測試沒有寫進項目真正的對話記錄', countReal() === before);
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
  const st = spawnSync(process.execPath, ['.memory-bridge/bridge.js', 'status'], { cwd: target, encoding: 'utf8' });
  check('bridge.js status 跑得起來', st.status === 0, (st.stderr || '').slice(0, 200));
}

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? '通過' : '失敗'}  ${r.name}${r.detail ? '：' + r.detail : ''}`);
}
console.log(`\n${results.length - bad}/${results.length} 通過` + (bad ? '' : '。還要做：讓使用者在這個資料夾信任 Codex 的 Hook，再用全新對話各實測一次（見 SKILL.md）。'));
process.exit(bad ? 1 : 0);
