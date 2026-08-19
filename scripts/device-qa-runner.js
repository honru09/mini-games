const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const INDEX_HTML_PATH = path.join(__dirname, '../public/index.html');
const EVIDENCE_DIR = path.join(__dirname, '../requirements/active/device-qa-evidence');

// 确保目录存在 / Ensure directory exists
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// 自动计算构建哈希和大小 / Auto-compute build sha256 and bytes
let buildSha256 = '';
let buildBytes = 0;

if (fs.existsSync(INDEX_HTML_PATH)) {
  const fileBuffer = fs.readFileSync(INDEX_HTML_PATH);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  buildSha256 = hashSum.digest('hex').toUpperCase();
  buildBytes = fileBuffer.length;
  console.log(`[Info] 自动检测到 public/index.html`);
  console.log(`[Info] buildSha256: ${buildSha256}`);
  console.log(`[Info] buildBytes: ${buildBytes}\n`);
} else {
  console.warn(`[Warn] 未找到 public/index.html, 将使用空值记录。\n`);
}

const SCENARIOS = [
  { id: 'tank', name: 'Tank', desc: '横屏；移动与射击并发；50/100/200ms 网络与抖动；3 分钟完整局；多次重生；页面不滚动' },
  { id: 'tetris', name: 'Tetris', desc: 'Touch、Hard Drop、Hold、Incoming、Target、多人 Mini Board；5 分钟完整局' },
  { id: 'board_games', name: 'Board Games', desc: '五子棋/飞行棋/大富翁/象棋：360px 宽度；44px 触控目标；棋盘不溢出；Modal/HUD 不遮挡；观战不可输入' },
  { id: 'reconnect', name: 'Reconnect', desc: '玩家和观众分别断网、切后台、锁屏，再在窗口内恢复' },
  { id: 'reduced_motion', name: 'Reduced Motion', desc: '六款游戏状态保持正确，动画可跳过，恢复不依赖重播' },
  { id: 'audio', name: 'Audio', desc: '静音设置、切后台后不重复播放、动作音画同步' }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function run() {
  console.log('================================================');
  console.log('   Mini Games QA Device Runner (Interactive)    ');
  console.log('================================================\n');

  const device = await ask('请输入设备名称 (e.g. iPhone 13 Pro, Pixel 6, Desktop): ');
  if (!device) {
    console.log('设备名称不可为空，退出。');
    process.exit(1);
  }

  const os = await ask('请输入操作系统 (e.g. iOS 16.5, Android 14, Windows 11): ');
  const browser = await ask('请输入浏览器及版本 (e.g. Safari 16.5, Chrome 115): ');

  // Generate safe filename prefix
  const safeName = `${device}-${os}-${browser}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  console.log('\n--- 设备全局配置 ---');
  const networkConfig = await ask('网络配置 (e.g. 50ms, 100ms+1%drop, Wifi): ') || 'Wifi';
  const pwaModeStr = await ask('是否为 PWA 模式? (y/N): ');
  const pwaMode = pwaModeStr.toLowerCase() === 'y';

  for (const scenario of SCENARIOS) {
    const filename = `${safeName}-${scenario.id}.json`;
    const filepath = path.join(EVIDENCE_DIR, filename);

    if (fs.existsSync(filepath)) {
      console.log(`\n[Skip] 发现已存记录: ${scenario.name}，跳过此场景。`);
      continue;
    }

    console.log(`\n================================================`);
    console.log(`场景: ${scenario.name}`);
    console.log(`要求: ${scenario.desc}`);
    console.log(`================================================`);
    
    let result = '';
    while (!['PASS', 'FAIL', 'SKIP'].includes(result)) {
      result = (await ask('结果 (PASS / FAIL / SKIP): ')).toUpperCase();
    }

    if (result === 'SKIP') {
      console.log(`跳过 ${scenario.name}`);
      continue;
    }

    const orientation = await ask('屏幕方向 (Portrait/Landscape/Both): ') || 'Portrait';
    const avgFPS = parseInt(await ask('平均 FPS (e.g. 60): '), 10) || 0;
    const longFrames = parseInt(await ask('长帧数 (>16ms) (e.g. 0): '), 10) || 0;
    const heating = await ask('发热情况 (Low/Medium/High): ') || 'Low';
    const audioState = await ask('音频状态 (On/Off): ') || 'On';
    const backgroundRecovery = await ask('后台/锁屏恢复情况 (e.g. Normal): ') || 'Normal';
    const screenshotPath = await ask('截图/录像路径 (可选): ');
    const issuesStr = await ask('发现的问题 (逗号分隔，可选): ');
    const issues = issuesStr ? issuesStr.split(',').map(i => i.trim()) : [];

    const evidence = {
      device,
      os,
      browser,
      orientation,
      buildSha256,
      buildBytes,
      scenario: scenario.name,
      avgFPS,
      longFrames,
      heating,
      result,
      screenshotPath,
      networkConfig,
      pwaMode,
      audioState,
      backgroundRecovery,
      issues
    };

    fs.writeFileSync(filepath, JSON.stringify(evidence, null, 2), 'utf-8');
    console.log(`\n[Saved] ${filepath}`);
  }

  console.log('\n================================================');
  console.log('所有场景执行完毕！生成报告摘要：');
  
  const files = fs.readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.json') && f.includes(safeName));
  let passCount = 0;
  let failCount = 0;
  
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, f), 'utf-8'));
    console.log(`- [${data.result}] ${data.scenario}`);
    if (data.result === 'PASS') passCount++;
    if (data.result === 'FAIL') failCount++;
  }
  
  console.log(`\n总结: ${passCount} PASS, ${failCount} FAIL`);
  console.log(`证据保存在: ${EVIDENCE_DIR}`);
  
  rl.close();
}

run().catch(err => {
  console.error('执行出错:', err);
  rl.close();
  process.exit(1);
});
