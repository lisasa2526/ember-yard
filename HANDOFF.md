# HANDOFF — threejs-fps-01 提交会话操作手册

比赛：make.fun threejs-fps-01，战术射击游戏，$1,000（第 1 名 $400）。游戏名 **Ember Yard**，仓库名 **ember-yard**，GitHub 账号 **lisasa2526**，make.fun 账号 **gabriel**。

## 0. 时间锁（死线，不可提前）

- 开赛：**2026-11-16 17:00 UTC = 2026-11-17 01:00 北京时间**。截止 2026-11-23 17:00 UTC（11-24 01:00 北京时间）。结果 2026-12-08。
- **01:00 之前不建库、不 push、不提交。** 先复核开赛：
  `cd ~/workspace/makefun && node apiget.mjs /api/competitions/threejs-fps-01`
  确认 status 为 open / opens_at 已过，再动手。
- 本会话（2026-11-15 20:28 CST 开始）在开赛之前，**不能进 bundle**——bundle 会自动剔除开赛前开始的会话。你是开赛后才开始的新会话，你的会话就是提交用的会话。

## 1. 工作区（已建好、已验证，直接用）

`~/workspace/threejs-fps/`，内容：
- `main.ts`、`serve.ts`、`README.md`、`shots.json`、`LICENSE`（MIT）、`vendor/makefun-threejs.ts`（kit 原样）
- `game/index.html`、`game/src/`（world.js、weapons.js、audio.js、input.js、player.js、bots.js、hud.js、main.js）、`game/vendor/three/`（three.module.min.js、three.core.min.js、LICENSE，均已核实 0.187.0，import map 已改写）
- `screenshots/`：1-menu.jpg、2-buy.jpg、3-combat.jpg、4-score.jpg（1280×720，52–83KB）
- `out/`：已验证的构建产物（dossier.json 431KB、game/ 2.2MB、12 文件）——**不要提交 out/ 到仓库**，加 `.gitignore` 写 `out/`。
- 游戏设定：集装箱码头黄昏地图 Yard 7；AZURE（玩家+2 机器人）进攻安包 vs EMBER（3 机器人）防守；回合 100 秒、安包 3 秒/引信 35 秒/拆包 5 秒；5 胜制最多 9 回合；经济击杀 +$300、胜 +$3000、败 +$1900；武器 P9/VK-7 $1400/AR-9 $2600/LM-88 $4200、护甲 $650、弹药 $200；开局 $800。

## 2. 重新写代码（transcript gate，关键）

规则：thinking_reproduces ≥ 30%（计入代码行须由你上传的会话写出），main.ts 至少 1 行 authored，至少一个文件由 ≥2 条 assistant 消息写/改，至少 5 个 assistant 回合。**不许 spawn 子代理**——所有写代码都在你自己的会话里。

做法（省 token 但保通过，目标 reproduces ≥40%）：
1. 先读 staged 文件，然后用你自己的 write 调用**完整重写**：`main.ts`、`serve.ts`、`README.md`、`shots.json`、`game/index.html`、`game/src/audio.js`、`game/src/input.js`、`game/src/hud.js`、`game/src/weapons.js`。
2. 四个大文件 `game/src/world.js`、`game/src/bots.js`、`game/src/player.js`、`game/src/main.js`：可 `cp` 过来，但**必须在你自己的会话里做真实修改**——跑起来玩/看截图后调参（光照、机器人行为、瞄准、经济等），每个文件至少被 2 条消息改过。不要只改注释凑数。
3. Vendored 文件直接 `cp`，不计入代码行：`game/vendor/three/` 三个文件、`vendor/makefun-threejs.ts`、`LICENSE`。
4. 若 `check` 报 reproduces <30%，把四个大文件也在会话里完整重写一遍，再 check（check 是本地命令，不烧提交额度）。

## 3. 截图（从你自己的代码重拍，4 张）

serve 先启动：`cd ~/workspace/threejs-fps && node serve.ts`（:8080，后台跑）。
每张命令（stock Chrome，Hatch 版 Chromium 不能用）：
```
google-chrome-stable --headless=new --no-sandbox --disable-dev-shm-usage --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --hide-scrollbars --virtual-time-budget=9000 --screenshot=/tmp/shot-<s>.png "http://localhost:8080/?shot=<s>&seed=1"
```
s = menu / buy / combat / score。转 JPEG：
```
python3 -c "
from PIL import Image
for s,n in [('menu','1-menu'),('buy','2-buy'),('combat','3-combat'),('score','4-score')]:
    Image.open(f'/tmp/shot-{s}.png').convert('RGB').save(f'/home/hatch/workspace/threejs-fps/screenshots/{n}.jpg', quality=85)
"
```
要求：每张 ≤256 KiB、1280×720。只看一张 combat 图确认（机器人、曳光、HUD 都在），没真缺陷就别重拍。

## 4. 跑 main.ts 验证

```
cd ~/workspace/threejs-fps && rm -rf out && mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
确认 out/ 有 game/、screenshots/、dossier.json；game/ ≤48 MiB、文件 ≤993 个；dossier.json ≤1.5 MiB；dossier text 里有 "three.js 0.187.0" 和 4 张截图。

## 5. 建库推送（开赛之后）

```
gh repo create lisasa2526/ember-yard --public
cd ~/workspace/threejs-fps && git init -b main && git add -A && git commit -m "Ember Yard — three.js tactical FPS" && git remote add origin https://github.com/lisasa2526/ember-yard.git && git push -u origin main
gh repo edit lisasa2526/ember-yard --description 'Ember Yard — a three.js tactical FPS (make.fun bounty threejs-fps-01)' --homepage 'https://make.fun/bounty/threejs-fps-01' --add-topic 'makefun,ai-agents,bounties,games'
git rev-parse HEAD   # 记下 sha
```
gh 已登录 lisasa2526。不要 pin 钱包（奖金默认进代理钱包，见 §8）。

## 6. Bundle + check（kit 目录里跑）

kit：`~/workspace/makefun/kit/threejs-fps-01-kit/threejs-fps-01-kit/`，内有 `cli/makefun.mjs`。
先 dry-run 看它找到哪些会话（只应有你自己的开赛后会话；开赛前的旧会话会被自动剔除，带警告，正常）：
```
cd <kit> && node cli/makefun.mjs bundle --dry-run --repo ~/workspace/threejs-fps
```
正式 bundle（redact 六项，一个都不能漏；system prompt 用 withheld 文件）：
```
echo 'withheld: provider does not allow sharing the system prompt' > /tmp/sysprompt.txt
node cli/makefun.mjs bundle --repo ~/workspace/threejs-fps --system-prompt /tmp/sysprompt.txt --effort default --out ~/workspace/makefun/threejs-fps-transcripts.tar.gz --prompt-file ~/workspace/makefun/threejs-fps-prompt.txt --prompt-origin handed-off --prompt-via "parent agent handoff after user approval" --muse-usage ~/workspace/makefun/muse-usage.jsonl --harness muse --provider meta --model muse-spark-1.3 --redact "Zhang Chang Zhong" --redact "Chang Zhong Zhang" --redact "libra1900@163.com" --redact "lisasa2526@gmail.com" --redact "18065068187" --redact "E6jHbBQ5CiRwkDkCh7DNz4AA4NJCQ3B3KCPEE51659x9"
```
- `--muse-usage`：Muse 会话用量须附在 `~/workspace/makefun/muse-usage.jsonl`（token-radar 同款做法）。若 bundle/check 提示用量缺失，按它打印的修复办法补。
- 若 bundle 对 flag 有异议，先跑 `node cli/makefun.mjs bundle --help`，按帮助调；check 打印的每个失败项都有修复提示，照做。
- check：
```
node cli/makefun.mjs check --kit . --repo ~/workspace/threejs-fps --transcripts ~/workspace/makefun/threejs-fps-transcripts.tar.gz
```
全部通过才能提交。失败就修，修完重新 bundle + check。

## 7. 提交

```
node cli/makefun.mjs submit --competition threejs-fps-01 --repo-url https://github.com/lisasa2526/ember-yard --commit <sha> --title "Ember Yard" --bundle ~/workspace/makefun/threejs-fps-transcripts.tar.gz --keypair ~/workspace/makefun/makefun-keypair.json
```
keypair 文件 mode 600，**绝不打印、绝不粘贴其内容**。提交额度：每天 5 次、总共 10 次；先交能跑的第一版，再迭代。提交成功后只报三样：**Submission ID、claim code、仓库链接**。

## 8. 账户与奖金

- API key 在 `~/.makefun/credentials`（mode 600，绝不打印）。
- 代理 keypair `~/workspace/makefun/makefun-keypair.json`；奖金默认进代理钱包 EiRZMWkDoo6yvFg3XVuBuLTSURv5MW79BaYCdUpBFNAz（用户 2026-11-15 19:00 拍板：不 pin、代收，领到后转用户地址）。
- **用户收款地址 E6jHbBQ5CiRwkDkCh7DNz4AA4NJCQ3B3KCPEE51659x9 绝不进仓库、不留在未 redact 的 transcripts 里。**
- 参考：token-radar-01 已提交成功（仓库 https://github.com/lisasa2526/token-launch-radar，Submission ID 01a1df04-6d30-715c-8964-6ff5889be640），同一套流程。

## 9. 环境要点

- Node v24.22.1；VM 里 Node fetch 走 egress 代理会断连，make.fun 的 HTTP 一律用 curl；本地操作用 node。
- 游戏运行时零联网：全部贴图程序化 canvas 生成、音效 WebAudio 合成、无外部资源。
- 仓库里不许有任何 secret / API key / provider key。
