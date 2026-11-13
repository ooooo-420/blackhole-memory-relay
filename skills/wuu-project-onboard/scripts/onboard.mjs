// 把一個資料夾接進 wuu 的記憶系統（記憶中轉站 Hook ＋ 項目記憶檔 ＋ 黑洞的項目清單）。
// 用法：node onboard.mjs <項目資料夾> <黑洞上顯示的名字> [--dry-run] [--no-pet] [--update-bridge]
//   --dry-run        只列出會做什麼，不寫任何檔案
//   --no-pet         不改黑洞的項目清單
//   --update-bridge  項目裡已經有舊版 bridge.js 時，換成記憶中轉站裡的新版
// 已經存在的 AGENTS.md、MEMORY.md、分支清單不會被覆蓋；Hook 設定檔是「合併」，不會洗掉原有的其他設定。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, '..', 'templates');
const HOME = process.env.WUU_MEMORY_HOME || 'D:\\AI記憶';           // 記憶中轉站本體
const PET = path.join(HOME, '黑洞桌寵.ps1');                          // 黑洞，內有項目清單
const BRIDGE_SRC = path.join(HOME, '.memory-bridge', 'bridge.js');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [targetArg, label] = args.filter((a) => !a.startsWith('--'));
if (!targetArg || !label) {
  console.error('用法：node onboard.mjs <項目資料夾> <黑洞上顯示的名字> [--dry-run] [--no-pet] [--update-bridge]');
  process.exit(2);
}
const DRY = flags.has('--dry-run');
const target = path.resolve(targetArg);
const report = [];
const note = (what, result) => report.push(`${result.padEnd(6, '　')} ${what}`);

if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) fail(`找不到資料夾：${target}`);
if (!fs.existsSync(BRIDGE_SRC)) fail(`找不到記憶中轉站的 bridge.js：${BRIDGE_SRC}（可用環境變數 WUU_MEMORY_HOME 指定）`);
if (path.resolve(target).toLowerCase() === path.resolve(HOME).toLowerCase()) fail('這就是記憶中轉站本身，不用接入。');

function fail(msg) { console.error('停下：' + msg); process.exit(1); }
const rel = (p) => path.relative(target, p) || '.';
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
function write(p, text, bom = false) {
  if (DRY) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, (bom ? '\uFEFF' : '') + text, 'utf8');
}
function fill(name, vars) {
  return read(path.join(TEMPLATES, name)).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// ---------- 黑洞的項目清單 ----------
const LIST_RE = /^\$memoryProjects=@\((.*)\)[ \t]*(?=\r?$)/m;  // 不吃掉行尾的 \r，保持原檔的換行格式
let petText = null;
let projects = [];
if (fs.existsSync(PET)) {
  petText = read(PET);
  const m = petText.match(LIST_RE);
  if (m) projects = [...m[1].matchAll(/@\('([^']*)','([^']*)'\)/g)].map((x) => ({ name: x[1], path: x[2] }));
}
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const others = projects.filter((p) => !same(p.path, target));
if (!projects.length) note('黑洞清單：找不到 $memoryProjects 這一行，AGENTS.md 的「其他項目」只列記憶中轉站', '注意');

// ---------- 1. bridge.js 和 package.json ----------
const bridgeDst = path.join(target, '.memory-bridge', 'bridge.js');
const src = fs.readFileSync(BRIDGE_SRC);
if (!fs.existsSync(bridgeDst)) { if (!DRY) { fs.mkdirSync(path.dirname(bridgeDst), { recursive: true }); fs.writeFileSync(bridgeDst, src); } note(rel(bridgeDst), '建立'); }
else if (Buffer.compare(fs.readFileSync(bridgeDst), src) === 0) note(rel(bridgeDst) + '（已是最新版）', '略過');
else if (flags.has('--update-bridge')) { if (!DRY) fs.writeFileSync(bridgeDst, src); note(rel(bridgeDst) + '（換成新版）', '更新'); }
else note(rel(bridgeDst) + '：和記憶中轉站的版本不同，沒動。要換新版加 --update-bridge', '注意');

// 項目根目錄若設了 "type": "module"，bridge.js 會靜默失效；這一份 package.json 讓它固定用 commonjs
const pkg = path.join(target, '.memory-bridge', 'package.json');
if (!fs.existsSync(pkg)) { write(pkg, '{\n  "type": "commonjs"\n}\n'); note(rel(pkg), '建立'); }
else if (!/"type"\s*:\s*"commonjs"/.test(read(pkg))) note(rel(pkg) + '：不是 commonjs，bridge.js 可能跑不起來', '注意');
else note(rel(pkg), '略過');

// ---------- 2. Hook 設定（合併，不覆蓋原有設定） ----------
function mergeHooks(file, tool, extra) {
  let cfg = {};
  const existed = fs.existsSync(file);
  if (existed) {
    try { cfg = JSON.parse(read(file)); } catch { note(rel(file) + '：不是合法的 JSON，沒動。請先修好再跑一次', '注意'); return; }
  }
  cfg.hooks = cfg.hooks || {};
  let added = 0;
  for (const [event, cmd] of [['UserPromptSubmit', `node .memory-bridge/bridge.js prompt ${tool}`], ['Stop', `node .memory-bridge/bridge.js stop ${tool}`]]) {
    const groups = (cfg.hooks[event] = cfg.hooks[event] || []);
    if (groups.some((g) => (g.hooks || []).some((h) => h.command === cmd))) continue;
    const hook = { type: 'command', command: cmd, timeout: 10, ...(event === 'UserPromptSubmit' ? extra : {}) };
    groups.push({ hooks: [hook] });
    added++;
  }
  if (tool === 'codex' && !cfg.description) cfg.description = `${target} shared memory bridge: saves each turn and surfaces the other tool's new records.`;
  if (!added && existed) { note(rel(file), '略過'); return; }
  write(file, JSON.stringify(cfg, null, 2) + '\n');
  note(rel(file) + (existed ? `（加了 ${added} 個 Hook，原有設定保留）` : ''), existed ? '合併' : '建立');
}
mergeHooks(path.join(target, '.claude', 'settings.json'), 'claude', {});
mergeHooks(path.join(target, '.codex', 'hooks.json'), 'codex', { additionalContextLimit: 6000 });

// ---------- 3. .gitignore：對話明文記錄不能進版本控制 ----------
const gi = path.join(target, '.gitignore');
const need = ['.memory-bridge/log/', '.memory-bridge/state/', '.memory-bridge/paused'];
const giText = fs.existsSync(gi) ? read(gi) : '';
const missing = need.filter((l) => !giText.split(/\r?\n/).includes(l));
if (missing.length) {
  write(gi, giText + (giText && !giText.endsWith('\n') ? '\n' : '') + (giText ? '\n' : '') + '# 記憶中轉站：對話記錄是明文，不進版本控制\n' + missing.join('\n') + '\n');
  note(rel(gi) + `（加了 ${missing.length} 行）`, giText ? '合併' : '建立');
} else note(rel(gi), '略過');

// ---------- 4. 項目記憶檔 ----------
const today = new Date().toISOString().slice(0, 10);
const otherPaths = [HOME, ...others.map((p) => p.path)].filter((p, i, a) => a.findIndex((q) => same(p, q)) === i && !same(p, target));
const vars = { PATH: target, NAME: label, DATE: today, OTHERS: otherPaths.map((p) => `\`${p}\``).join('、') };
for (const [file, tpl] of [['AGENTS.md', 'AGENTS.md'], ['MEMORY.md', 'MEMORY.md'], [path.join('branches', 'INDEX.md'), 'INDEX.md']]) {
  const p = path.join(target, file);
  if (fs.existsSync(p)) note(`${file}（已經有了，沒覆蓋；請自己確認內容）`, '保留');
  else { write(p, fill(tpl, vars)); note(file, '建立'); }
}
const claudeMd = path.join(target, 'CLAUDE.md');
if (!fs.existsSync(claudeMd)) { write(claudeMd, '@AGENTS.md\n@MEMORY.md\n'); note('CLAUDE.md', '建立'); }
else {
  const t = read(claudeMd);
  const add = ['@AGENTS.md', '@MEMORY.md'].filter((l) => !t.split(/\r?\n/).some((x) => x.trim() === l));
  if (add.length) { write(claudeMd, add.join('\n') + '\n\n' + t); note(`CLAUDE.md（最上面加了 ${add.join('、')}）`, '合併'); }
  else note('CLAUDE.md', '略過');
}

// ---------- 5. 黑洞的項目清單 ----------
if (flags.has('--no-pet')) note('黑洞清單（--no-pet）', '略過');
else if (!petText || !LIST_RE.test(petText)) note(`黑洞清單：${PET} 裡找不到 $memoryProjects，請手動加`, '注意');
else if (projects.some((p) => same(p.path, target))) note('黑洞清單（已經有這個項目）', '略過');
else {
  if (/'/.test(label) || /'/.test(target)) fail('名字或路徑裡有單引號，請換一個名字');
  const next = petText.replace(LIST_RE, (line, inner) => `$memoryProjects=@(${inner},@('${label}','${target}'))`);
  // 黑洞是 Windows PowerShell 5.1 跑的：沒有 BOM 的 UTF-8 會把中文讀成亂碼，所以一定帶 BOM 寫回
  write(PET, next, true);
  note(`黑洞清單：加了 ${label}（重開黑洞後生效）`, '更新');
}

// ---------- 其他提醒 ----------
const rootPkg = path.join(target, 'package.json');
if (fs.existsSync(rootPkg) && /"type"\s*:\s*"module"/.test(read(rootPkg))) note('項目根目錄的 package.json 是 module：已靠 .memory-bridge/package.json 隔開，記得實測', '注意');

console.log((DRY ? '【試跑，沒有寫入任何檔案】\n' : '') + `項目：${target}（${label}）\n` + report.join('\n'));
console.log('\n下一步：node "' + path.join(HERE, 'test.mjs') + '" "' + target + '"');
