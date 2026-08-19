/*
 * Ghost Game P0-01 deterministic art derivation.
 *
 * This generator intentionally uses only project-owned SVG geometry and the
 * already owner-cleared Honru Alpha masters. It never reads external art.
 * The resulting files are source/runtime candidates and remain behind the
 * P0-01 feature flags until the admission record and browser QA are complete.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'art-source', 'platform', 'auth', 'ghost-wake-v1');
const runtimeRoot = path.join(root, 'public', 'assets', 'ui', 'auth', 'ghost-wake-v1');
const loadingSourceRoot = path.join(root, 'art-source', 'platform', 'loading', 'ghost-boot-v1');
const loadingRuntimeRoot = path.join(root, 'public', 'assets', 'ui', 'loading', 'ghost-boot-v1');
const pwaSourceRoot = path.join(root, 'art-source', 'platform', 'pwa', 'ghost-wake-v1');
const pwaRuntimeRoot = path.join(root, 'public', 'assets', 'brand', 'pwa', 'ghost-wake-v1');
const statusSourceRoot = path.join(root, 'art-source', 'platform', 'auth', 'status-v1');
const statusRuntimeRoot = path.join(root, 'public', 'assets', 'ui', 'auth', 'status-v1');
const honruRoot = path.join(root, 'public', 'assets', 'brand', 'honru', 'states-v1');
const legacyMark = path.join(root, 'public', 'assets', 'brand', 'ghost-game-mark.svg');

const C = {
  ink: '#211923', paper: '#FFF9F2', cream: '#F3E5C4',
  teal: '#39B9B2', green: '#4BCB83', blue: '#508BF0',
  purple: '#8656CF', pink: '#E45CA4', coral: '#EF665F', gold: '#F1B640',
  sky: '#EAF4F6', night: '#070A15', night2: '#11152A'
};

function mkdirs(...dirs) { dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true })); }
function write(file, data) { mkdirs(path.dirname(file)); fs.writeFileSync(file, data); }
function esc(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function svgDoc(width, height, body, background = 'none', extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${extra}>` +
    (background !== 'none' ? `<rect width="${width}" height="${height}" fill="${background}"/>` : '') + body + '</svg>';
}

function stroke(style = C.ink, width = 8) {
  return `stroke="${style}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
}

function signalArc(cx, cy, r, color, opacity = 1, width = 10) {
  return `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" ${stroke(color, width)} opacity="${opacity}"/>`;
}

function cloud(x, y, scale, fill, line = C.paper) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 70c0-36 28-62 64-62 21 0 40 9 51 25 9-6 20-9 32-9 31 0 56 23 59 53 30 0 54 22 54 50 0 29-25 52-55 52H60c-35 0-60-25-60-55 0-24 14-44 35-54A59 59 0 0 1 0 70Z" fill="${fill}" ${stroke(line, 7)}/></g>`;
}

function token(x, y, scale, fill, kind = 'circle') {
  const shape = kind === 'square'
    ? `<rect x="-34" y="-34" width="68" height="68" rx="16" fill="${fill}" ${stroke(C.ink, 7)}/>`
    : kind === 'plane'
      ? `<path d="M-42 12 30-32c9-5 17 4 12 13L3 54c-4 8-15 8-18 0l-8-28-18-8c-9-4-8-14-1-18Z" fill="${fill}" ${stroke(C.ink, 7)}/>`
      : `<circle r="34" fill="${fill}" ${stroke(C.ink, 7)}/>`;
  return `<g transform="translate(${x} ${y}) scale(${scale})">${shape}<circle cx="-10" cy="-12" r="7" fill="${C.paper}" opacity=".8"/></g>`;
}

function desktopLight() {
  const body = `
    <path d="M0 820c240-90 410-70 620 10 210 80 410 62 600-20 205-88 450-96 700 8v262H0Z" fill="${C.cream}" opacity=".92"/>
    <path d="M0 872c260-84 420-58 620 16 220 82 420 58 608-23 220-96 450-98 692-2" fill="none" ${stroke(C.teal, 11)} opacity=".32"/>
    ${cloud(55, 105, 1.2, C.paper)}${cloud(1390, 112, .9, '#D7EEF0')}${cloud(830, 20, .68, '#E0F0F1')}
    <circle cx="1510" cy="690" r="180" fill="${C.paper}" opacity=".55" ${stroke(C.gold, 6)}/>
    <circle cx="1510" cy="690" r="125" fill="${C.cream}" opacity=".55" ${stroke(C.gold, 5)}/>
    ${signalArc(1050, 650, 240, C.teal, .45, 10)}${signalArc(1050, 650, 175, C.blue, .35, 8)}
    <path d="M760 720c70-92 180-92 250 0m-202 28c48-58 105-58 153 0" fill="none" ${stroke(C.purple, 8)} opacity=".3"/>
    ${token(1120, 675, .8, C.teal, 'circle')}${token(1260, 735, .62, C.gold, 'square')}${token(1370, 640, .5, C.pink, 'plane')}
    <g opacity=".65"><circle cx="185" cy="720" r="11" fill="${C.green}"/><circle cx="220" cy="750" r="7" fill="${C.purple}"/><circle cx="1715" cy="780" r="9" fill="${C.coral}"/></g>`;
  return svgDoc(1920, 1080, body, C.sky, 'role="img" aria-label="Ghost Wake light authentication background"');
}

function desktopDark() {
  let stars = '';
  [[100,120,4,C.paper],[230,250,3,C.teal],[420,150,5,C.gold],[610,310,3,C.purple],[805,120,4,C.blue],[1010,270,3,C.pink],[1230,140,5,C.paper],[1430,280,3,C.gold],[1720,160,4,C.teal],[1810,430,3,C.purple],[300,650,3,C.blue],[520,820,4,C.pink],[1490,760,4,C.gold],[1730,850,3,C.teal]].forEach(([x,y,r,c])=>{stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".8"/>`;});
  const body = `
    <path d="M0 830c240-70 430-74 620 4 215 87 422 65 615-18 222-95 452-82 685 16v248H0Z" fill="${C.night2}" ${stroke('#27243D', 7)}/>
    <path d="M0 875c270-68 430-58 620 8 222 78 420 53 611-26 221-91 458-83 689-8" fill="none" ${stroke(C.purple, 10)} opacity=".28"/>
    <ellipse cx="1170" cy="710" rx="410" ry="150" fill="none" ${stroke(C.teal, 9)} opacity=".27" transform="rotate(-8 1170 710)"/>
    <ellipse cx="1170" cy="710" rx="300" ry="100" fill="none" ${stroke(C.blue, 7)} opacity=".22" transform="rotate(-8 1170 710)"/>
    ${stars}
    ${signalArc(960, 630, 240, C.teal, .42, 9)}${signalArc(960, 630, 175, C.pink, .28, 7)}
    ${token(1120, 700, .72, C.teal, 'circle')}${token(1290, 735, .6, C.gold, 'square')}${token(1395, 625, .5, C.blue, 'plane')}
    <circle cx="1530" cy="600" r="92" fill="${C.night2}" ${stroke(C.gold, 5)} opacity=".85"/>`;
  return svgDoc(1920, 1080, body, C.night, 'role="img" aria-label="Ghost Wake dark authentication background"');
}

function mobileLight() {
  const body = `
    <path d="M0 900c130-80 270-82 430-12 148 65 302 60 470-6v318H0Z" fill="${C.cream}" opacity=".95"/>
    ${cloud(15, 105, .82, C.paper)}${cloud(585, 165, .65, '#D7EEF0')}
    <circle cx="450" cy="760" r="175" fill="${C.paper}" opacity=".55" ${stroke(C.gold, 6)}/>
    ${signalArc(450, 760, 220, C.teal, .38, 9)}${signalArc(450, 760, 150, C.blue, .3, 7)}
    ${token(170, 835, .62, C.teal, 'circle')}${token(710, 870, .55, C.pink, 'plane')}
    <path d="M100 470c95-44 185-44 280 0m-230 35c54-24 105-24 158 0" fill="none" ${stroke(C.purple, 8)} opacity=".25"/>`;
  return svgDoc(900, 1200, body, C.sky, 'role="img" aria-label="Ghost Wake light mobile authentication background"');
}

function mobileDark() {
  let stars = '';
  [[100,100,4,C.paper],[245,210,3,C.teal],[720,120,4,C.gold],[820,330,3,C.purple],[130,540,3,C.blue],[770,610,4,C.pink],[245,760,3,C.gold],[650,890,4,C.teal]].forEach(([x,y,r,c])=>{stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".82"/>`;});
  const body = `
    <path d="M0 900c140-74 275-80 430-15 160 68 300 57 470-10v325H0Z" fill="${C.night2}" ${stroke('#27243D', 7)}/>
    ${stars}
    <ellipse cx="450" cy="770" rx="320" ry="120" fill="none" ${stroke(C.teal, 9)} opacity=".28" transform="rotate(-8 450 770)"/>
    ${signalArc(450, 760, 210, C.purple, .35, 9)}${signalArc(450, 760, 145, C.pink, .26, 7)}
    ${token(150, 860, .56, C.teal, 'circle')}${token(750, 900, .5, C.gold, 'square')}
    <circle cx="450" cy="760" r="95" fill="${C.night2}" ${stroke(C.gold, 5)} opacity=".9"/>`;
  return svgDoc(900, 1200, body, C.night, 'role="img" aria-label="Ghost Wake dark mobile authentication background"');
}

const backgrounds = {
  'auth-ghost-wake-light-desktop-v1': desktopLight(),
  'auth-ghost-wake-dark-desktop-v1': desktopDark(),
  'auth-ghost-wake-light-mobile-v1': mobileLight(),
  'auth-ghost-wake-dark-mobile-v1': mobileDark()
};

const statusIcons = {
  'username-available': `<circle cx="32" cy="32" r="23" fill="${C.paper}" ${stroke(C.ink, 4)}/><circle cx="26" cy="27" r="6" fill="${C.teal}" ${stroke(C.ink, 3)}/><path d="M16 45c2-8 18-8 20 0" fill="none" ${stroke(C.ink, 3)}/><path d="m36 33 6 6 11-13" fill="none" ${stroke(C.green, 5)}/><circle cx="48" cy="20" r="7" fill="${C.green}" ${stroke(C.ink, 3)}/><path d="m44.5 20 2.5 2.5 4.5-5" fill="none" ${stroke(C.paper, 2.6)}/>` ,
  'username-occupied': `<circle cx="32" cy="32" r="23" fill="${C.paper}" ${stroke(C.ink, 4)}/><circle cx="26" cy="27" r="6" fill="${C.blue}" ${stroke(C.ink, 3)}/><path d="M16 45c2-8 18-8 20 0" fill="none" ${stroke(C.ink, 3)}/><rect x="37" y="31" width="17" height="14" rx="4" fill="${C.coral}" ${stroke(C.ink, 3)}/><path d="M41 31v-3c0-6 9-6 9 0v3" fill="none" ${stroke(C.ink, 3)}/><path d="M43 38h5" ${stroke(C.paper, 3)}/>` ,
  'password-error': `<path d="M14 30c0-9 7-16 16-16s16 7 16 16v5H14Z" fill="${C.gold}" ${stroke(C.ink, 4)}/><path d="M42 35h12v10H42Z" fill="${C.paper}" ${stroke(C.ink, 4)}/><circle cx="23" cy="29" r="5" fill="${C.paper}" ${stroke(C.ink, 3)}/><path d="M29 29h14m-7 0v7" fill="none" ${stroke(C.ink, 3)}/><circle cx="48" cy="45" r="11" fill="${C.coral}" ${stroke(C.ink, 3)}/><path d="m44 41 8 8m0-8-8 8" fill="none" ${stroke(C.paper, 3)}/>` ,
  'migration-success': `<path d="M12 34h18" fill="none" ${stroke(C.purple, 6)}/><path d="m24 25 10 9-10 9" fill="none" ${stroke(C.purple, 5)}/><path d="M37 34h15" fill="none" ${stroke(C.green, 6)}/><circle cx="19" cy="25" r="10" fill="${C.cream}" ${stroke(C.ink, 3)}/><circle cx="47" cy="25" r="10" fill="${C.teal}" ${stroke(C.ink, 3)}/><circle cx="47" cy="43" r="10" fill="${C.green}" ${stroke(C.ink, 3)}/><path d="m42 43 4 4 7-8" fill="none" ${stroke(C.paper, 3)}/>` ,
  'connected': `<circle cx="32" cy="32" r="24" fill="${C.teal}" ${stroke(C.ink, 4)}/><path d="M18 31c5-8 11-8 16-3l4 4c5 5 11 5 16-3" fill="none" ${stroke(C.paper, 4)}/><path d="m22 39 5 5 10-11" fill="none" ${stroke(C.green, 5)}/>` ,
  'offline-retry': `<circle cx="32" cy="32" r="24" fill="${C.cream}" ${stroke(C.ink, 4)}/><path d="M18 25c5-8 12-8 17-3l3 3c5 5 10 5 15-2" fill="none" ${stroke(C.coral, 4)}/><path d="M25 39c-5 5-10 4-14-1" fill="none" ${stroke(C.ink, 4)}/><path d="m14 38 0 8 8-2" fill="none" ${stroke(C.coral, 4)}/><path d="M45 39h7m-3-4 4 4-4 4" fill="none" ${stroke(C.blue, 4)}/>`
};

const sceneOverlays = {
  'login-welcome': {state:'waiting-invite', behind:`<path d="M88 125c60-55 140-55 200 0" fill="none" ${stroke(C.teal, 8)} opacity=".7"/><circle cx="88" cy="125" r="10" fill="${C.teal}" ${stroke(C.ink, 4)}/><circle cx="288" cy="125" r="10" fill="${C.teal}" ${stroke(C.ink, 4)}/>`, front:`<path d="M353 345c42-25 68-25 91 0" fill="none" ${stroke(C.gold, 7)} opacity=".8"/><circle cx="399" cy="345" r="11" fill="${C.gold}" ${stroke(C.ink, 4)}/>`},
  'register-create': {state:'check-in', behind:`<rect x="54" y="315" width="112" height="86" rx="18" fill="${C.paper}" ${stroke(C.ink, 6)}/><path d="M82 350h56M82 374h38" ${stroke(C.purple, 6)}/><circle cx="140" cy="334" r="12" fill="${C.green}" ${stroke(C.ink, 4)}/><path d="m134 334 5 5 9-11" fill="none" ${stroke(C.paper, 3)}/>`, front:`<path d="M373 145c18-22 36-22 54 0" fill="none" ${stroke(C.green, 7)}/><path d="M400 145v32" ${stroke(C.green, 7)}/><path d="M384 177c11-15 25-15 36 0" fill="none" ${stroke(C.green, 7)}/>`},
  'legacy-migrate': {state:'recover', behind:`<g transform="translate(55 320)"><rect width="100" height="64" rx="14" fill="${C.cream}" ${stroke(C.ink, 6)}/><circle cx="28" cy="32" r="13" fill="${C.gold}" ${stroke(C.ink, 4)}/><path d="M40 32h45m-14 0v13" ${stroke(C.ink, 4)}/></g><path d="M160 352h95" fill="none" ${stroke(C.purple, 8)}/><path d="m235 330 25 22-25 22" fill="none" ${stroke(C.purple, 7)}/>`, front:`<g transform="translate(365 325)"><rect width="92" height="60" rx="14" fill="${C.teal}" ${stroke(C.ink, 6)}/><circle cx="24" cy="30" r="11" fill="${C.paper}" ${stroke(C.ink, 4)}/><path d="M35 30h42m-14 0v12" ${stroke(C.ink, 4)}/><circle cx="76" cy="8" r="15" fill="${C.green}" ${stroke(C.ink, 4)}/><path d="m68 8 6 6 10-13" fill="none" ${stroke(C.paper, 3)}/></g>`},
  'guest-safe-entry': {state:'idle', behind:`<path d="M58 330h104v80H58Z" fill="${C.paper}" ${stroke(C.ink, 6)}/><path d="M76 354h68M76 378h44" ${stroke(C.blue, 6)}/><circle cx="142" cy="344" r="10" fill="${C.blue}" ${stroke(C.ink, 4)}/>`, front:`<path d="M395 292 455 322v60l-60 30-60-30v-60Z" fill="${C.teal}" ${stroke(C.ink, 7)}/><path d="m380 351 12 12 25-29" fill="none" ${stroke(C.paper, 6)}/>`},
  'connecting': {state:'thinking', behind:`${signalArc(256,220,155,C.blue,.75,9)}${signalArc(256,220,105,C.teal,.7,8)}<circle cx="101" cy="220" r="11" fill="${C.blue}" ${stroke(C.ink,4)}/><circle cx="411" cy="220" r="11" fill="${C.teal}" ${stroke(C.ink,4)}/>`, front:`<path d="M356 370c42-18 74-18 105 0" fill="none" ${stroke(C.purple, 8)} stroke-dasharray="8 14"/>`},
  'credential-error': {state:'surprised', behind:`<path d="M70 330c20-44 64-53 105-20" fill="none" ${stroke(C.coral, 9)}/><circle cx="72" cy="330" r="13" fill="${C.coral}" ${stroke(C.ink, 4)}/><path d="M90 365h92" ${stroke(C.coral, 7)}/><path d="M112 388h46" ${stroke(C.coral, 6)}/>`, front:`<circle cx="416" cy="330" r="50" fill="${C.coral}" ${stroke(C.ink, 6)}/><path d="m391 305 50 50m0-50-50 50" fill="none" ${stroke(C.paper, 7)}/>`},
  'recovered': {state:'recover', behind:`<path d="M84 355c35-55 100-55 135 0" fill="none" ${stroke(C.green, 8)}/><path d="m77 350 8 25 25-7" fill="none" ${stroke(C.green, 7)}/>`, front:`<circle cx="423" cy="325" r="55" fill="${C.green}" ${stroke(C.ink, 6)}/><path d="m397 325 18 18 33-41" fill="none" ${stroke(C.paper, 8)}/><path d="M378 245l8-16m36 9 5-18m34 31 14-11" ${stroke(C.gold, 5)}/>`},
  'first-start': {state:'playful', behind:`<path d="M52 394c104-105 207-112 310-22" fill="none" ${stroke(C.purple, 8)} stroke-dasharray="11 15"/><circle cx="52" cy="394" r="13" fill="${C.teal}" ${stroke(C.ink, 4)}/><circle cx="362" cy="372" r="13" fill="${C.gold}" ${stroke(C.ink, 4)}/>`, front:`${token(409,135,.55,C.pink,'circle')}${token(96,135,.48,C.blue,'square')}<path d="M390 185l14-16m-5 23 18-5" ${stroke(C.gold, 6)}/>`}
};

function iconDoc(name, body) {
  return svgDoc(64, 64, `<title>${esc(name)}</title><desc>Ghost Game authentication status icon</desc>${body}`, 'none', 'role="img"');
}

async function renderSvg(svg, out, width, height, format = 'png') {
  let pipeline = sharp(Buffer.from(svg)).resize(width, height, { fit: 'fill' });
  if (format === 'webp') pipeline = pipeline.webp({ quality: 88, effort: 6 });
  else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9, effort: 10 });
  await pipeline.toFile(out);
}

async function compositeHonru(name, cfg, outSource, outRuntime) {
  const basePath = path.join(honruRoot, `honru-${cfg.state}-v1.webp`);
  const base = await sharp(basePath).resize(430, 430, { fit: 'contain' }).png().toBuffer();
  const canvas = sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const behind = Buffer.from(svgDoc(512, 512, cfg.behind || ''));
  const front = Buffer.from(svgDoc(512, 512, cfg.front || ''));
  await canvas.composite([
    { input: behind },
    { input: base, left: 41, top: 41 },
    { input: front }
  ]).png({ compressionLevel: 9, effort: 10 }).toFile(outSource);
  await sharp(outSource).resize(320, 320, { fit: 'contain' }).webp({ quality: 90, effort: 6 }).toFile(path.join(outRuntime, `${name}-320-v1.webp`));
  await sharp(outSource).resize(240, 240, { fit: 'contain' }).webp({ quality: 88, effort: 6 }).toFile(path.join(outRuntime, `${name}-240-v1.webp`));
  await sharp(outSource).resize(160, 160, { fit: 'contain' }).webp({ quality: 86, effort: 6 }).toFile(path.join(outRuntime, `${name}-160-v1.webp`));
}

async function contactSheet(items, out, columns, cellWidth, cellHeight) {
  const rows = Math.ceil(items.length / columns);
  const canvas = sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 4, background: C.paper } });
  const composites = [];
  for (let i = 0; i < items.length; i++) {
    const col = i % columns, row = Math.floor(i / columns);
    const thumb = await sharp(items[i].file).resize(cellWidth - 30, cellHeight - 58, { fit: 'contain', background: { r: 255, g: 249, b: 242, alpha: 0 } }).png().toBuffer();
    composites.push({ input: thumb, left: col * cellWidth + 15, top: row * cellHeight + 12 });
    const label = svgDoc(cellWidth, 42, `<rect width="${cellWidth}" height="42" rx="12" fill="${C.cream}"/><text x="${cellWidth / 2}" y="27" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${C.ink}">${esc(items[i].label)}</text>`);
    composites.push({ input: Buffer.from(label), left: col * cellWidth, top: row * cellHeight + cellHeight - 44 });
  }
  await canvas.composite(composites).png({ compressionLevel: 9, effort: 10 }).toFile(out);
}

async function main() {
  mkdirs(sourceRoot, path.join(sourceRoot, 'source'), path.join(sourceRoot, 'alpha'), path.join(sourceRoot, 'derived'), path.join(sourceRoot, 'posters'), path.join(sourceRoot, 'fallback'), path.join(sourceRoot, 'review'), runtimeRoot, path.join(runtimeRoot, 'backgrounds'), path.join(runtimeRoot, 'honru'), path.join(runtimeRoot, 'fallback'), loadingSourceRoot, path.join(loadingSourceRoot, 'source'), path.join(loadingSourceRoot, 'alpha'), path.join(loadingSourceRoot, 'derived'), path.join(loadingSourceRoot, 'review'), loadingRuntimeRoot, path.join(loadingRuntimeRoot, 'fallback'), pwaSourceRoot, path.join(pwaSourceRoot, 'source'), path.join(pwaSourceRoot, 'derived'), path.join(pwaSourceRoot, 'review'), pwaRuntimeRoot, statusSourceRoot, path.join(statusSourceRoot, 'review'), statusRuntimeRoot);

  for (const [name, svg] of Object.entries(backgrounds)) {
    write(path.join(sourceRoot, 'source', `${name}.svg`), svg + '\n');
    const isMobile = name.includes('mobile');
    const width = isMobile ? 900 : 1920;
    const height = isMobile ? 1200 : 1080;
    await renderSvg(svg, path.join(sourceRoot, 'alpha', `${name}.png`), width, height, 'png');
    await renderSvg(svg, path.join(runtimeRoot, 'backgrounds', `${name}.webp`), width, height, 'webp');
    await renderSvg(svg, path.join(runtimeRoot, 'backgrounds', `${name}-static.webp`), width, height, 'webp');
  }

  for (const [name, body] of Object.entries(statusIcons)) {
    const svg = iconDoc(name, body);
    write(path.join(statusSourceRoot, `${name}-v1.svg`), svg + '\n');
    write(path.join(statusRuntimeRoot, `${name}-v1.svg`), svg + '\n');
  }
  await contactSheet(Object.keys(statusIcons).map(name => ({ label: name, file: path.join(statusSourceRoot, `${name}-v1.svg`) })), path.join(statusSourceRoot, 'review', 'auth-status-icons-contact-sheet-v1.png'), 3, 190, 220);

  for (const [name, cfg] of Object.entries(sceneOverlays)) {
    await compositeHonru(name, cfg, path.join(sourceRoot, 'alpha', `honru-auth-${name}-v1.png`), path.join(runtimeRoot, 'honru'));
  }
  await contactSheet(Object.keys(sceneOverlays).map(name => ({ label: name, file: path.join(sourceRoot, 'alpha', `honru-auth-${name}-v1.png`) })), path.join(sourceRoot, 'review', 'auth-honru-scenes-contact-sheet-v1.png'), 4, 280, 310);

  const bootConfigs = {
    'honru-boot-controller-hug': { state: 'idle', behind: `<path d="M100 170c-38 25-44 65-15 92m327-92c38 25 44 65 15 92" fill="none" ${stroke(C.gold, 8)}/>`, front: `<rect x="145" y="315" width="222" height="108" rx="34" fill="${C.teal}" ${stroke(C.ink, 8)}/><circle cx="208" cy="369" r="23" fill="${C.paper}" ${stroke(C.ink, 5)}/><path d="M196 369h24m-12-12v24" fill="none" ${stroke(C.ink, 5)}/><circle cx="302" cy="355" r="12" fill="${C.paper}" ${stroke(C.ink, 4)}/><circle cx="332" cy="379" r="12" fill="${C.paper}" ${stroke(C.ink, 4)}/><circle cx="146" cy="359" r="23" fill="${C.paper}" ${stroke(C.ink, 6)}/><circle cx="366" cy="359" r="23" fill="${C.paper}" ${stroke(C.ink, 6)}/>` },
    'honru-boot-retry-signal': { state: 'recover', behind: `${signalArc(256,205,170,C.blue,.65,9)}${signalArc(256,205,112,C.coral,.65,8)}<path d="M96 205 155 205m202 0 59 0" ${stroke(C.ink, 7)}/><circle cx="96" cy="205" r="12" fill="${C.coral}" ${stroke(C.ink, 4)}/><circle cx="416" cy="205" r="12" fill="${C.blue}" ${stroke(C.ink, 4)}/>`, front: `<path d="M369 370c50-33 86-25 105 8" fill="none" ${stroke(C.green, 8)} stroke-dasharray="9 12"/><path d="m454 362 20 15-22 13" fill="none" ${stroke(C.green, 7)}/>` }
  };
  for (const [name, cfg] of Object.entries(bootConfigs)) {
    await compositeHonru(name, cfg, path.join(loadingSourceRoot, 'alpha', `${name}-v1.png`), loadingRuntimeRoot);
  }
  await contactSheet(Object.keys(bootConfigs).map(name => ({ label: name, file: path.join(loadingSourceRoot, 'alpha', `${name}-v1.png`) })), path.join(loadingSourceRoot, 'review', 'boot-honru-scenes-contact-sheet-v1.png'), 2, 320, 350);

  const splashLight = svgDoc(2048, 2732, `<path d="M0 2040c330-150 680-110 1024 8 330 114 676 104 1024-24v708H0Z" fill="${C.cream}"/><path d="M0 2100c340-126 690-92 1024 18 328 108 684 88 1024-22" fill="none" ${stroke(C.teal, 15)} opacity=".38"/>${cloud(120,320,1.5,C.paper)}${cloud(1360,370,1.15,'#D7EEF0')}${signalArc(1024,1700,410,C.teal,.35,16)}${signalArc(1024,1700,300,C.blue,.28,12)}<circle cx="1024" cy="1720" r="184" fill="${C.paper}" ${stroke(C.gold, 10)}/><path d="M1024 1590c30 34 12 58-17 70 54-9 94 25 102 73 20-21 43-29 67-24-22 23-28 47-18 73 25-8 46-3 63 15-24 10-36 30-35 58H862c1-28-10-48-35-58 18-18 39-23 64-15 9-26 3-50-19-73 25-5 47 3 67 24 8-48 49-82 103-73-29-12-47-36-18-70Z" fill="${C.paper}" ${stroke(C.ink, 12)}/><circle cx="984" cy="1715" r="25" fill="${C.ink}"/><circle cx="1064" cy="1715" r="25" fill="${C.ink}"/><path d="M1004 1780c13 14 27 14 40 0" fill="none" ${stroke(C.ink, 8)}/>`, C.sky, 'role="img" aria-label="Ghost Wake light splash"');
  const splashDark = svgDoc(2048, 2732, `<path d="M0 2040c330-150 680-110 1024 8 330 114 676 104 1024-24v708H0Z" fill="${C.night2}" ${stroke('#27243D', 10)}/><path d="M0 2100c340-126 690-92 1024 18 328 108 684 88 1024-22" fill="none" ${stroke(C.purple, 15)} opacity=".36"/>${signalArc(1024,1700,410,C.teal,.35,16)}${signalArc(1024,1700,300,C.pink,.25,12)}<circle cx="1024" cy="1720" r="184" fill="${C.cream}" ${stroke(C.ink, 10)}/><path d="M1024 1590c30 34 12 58-17 70 54-9 94 25 102 73 20-21 43-29 67-24-22 23-28 47-18 73 25-8 46-3 63 15-24 10-36 30-35 58H862c1-28-10-48-35-58 18-18 39-23 64-15 9-26 3-50-19-73 25-5 47 3 67 24 8-48 49-82 103-73-29-12-47-36-18-70Z" fill="${C.paper}" ${stroke(C.ink, 12)}/><circle cx="984" cy="1715" r="25" fill="${C.ink}"/><circle cx="1064" cy="1715" r="25" fill="${C.ink}"/><path d="M1004 1780c13 14 27 14 40 0" fill="none" ${stroke(C.ink, 8)}/><circle cx="450" cy="1400" r="7" fill="${C.gold}"/><circle cx="1580" cy="1380" r="6" fill="${C.teal}"/>`, C.night, 'role="img" aria-label="Ghost Wake dark splash"');
  write(path.join(pwaSourceRoot, 'source', 'ghost-wake-splash-light-v1.svg'), splashLight + '\n');
  write(path.join(pwaSourceRoot, 'source', 'ghost-wake-splash-dark-v1.svg'), splashDark + '\n');
  await renderSvg(splashLight, path.join(pwaSourceRoot, 'derived', 'ghost-wake-splash-light-2048x2732-v1.png'), 2048, 2732, 'png');
  await renderSvg(splashDark, path.join(pwaSourceRoot, 'derived', 'ghost-wake-splash-dark-2048x2732-v1.png'), 2048, 2732, 'png');
  await renderSvg(splashLight, path.join(pwaRuntimeRoot, 'ghost-wake-splash-light-v1.webp'), 1080, 1920, 'webp');
  await renderSvg(splashDark, path.join(pwaRuntimeRoot, 'ghost-wake-splash-dark-v1.webp'), 1080, 1920, 'webp');

  const maskable = svgDoc(512, 512, `<circle cx="256" cy="256" r="256" fill="${C.ink}"/><circle cx="256" cy="256" r="194" fill="${C.cream}" ${stroke(C.paper, 8)}/><path d="M256 112c25 30 11 50-14 61 44-7 77 20 84 59 16-17 34-23 54-19-18 19-22 38-14 59 20-7 37-2 51 12-19 8-29 24-28 47H123c1-23-9-39-28-47 14-14 31-19 51-12 8-21 4-40-14-59 20-4 38 2 54 19 7-39 40-66 84-59-25-11-39-31-14-61Z" fill="${C.paper}" ${stroke(C.ink, 9)}/><circle cx="224" cy="234" r="16" fill="${C.ink}"/><circle cx="288" cy="234" r="16" fill="${C.ink}"/><path d="M240 284c10 11 22 11 32 0" fill="none" ${stroke(C.ink, 6)}/>`, C.ink, 'role="img" aria-label="Ghost Game maskable icon"');
  write(path.join(pwaSourceRoot, 'source', 'ghost-game-maskable-v1.svg'), maskable + '\n');
  await renderSvg(maskable, path.join(pwaRuntimeRoot, 'ghost-game-maskable-512-v1.png'), 512, 512, 'png');
  await renderSvg(maskable, path.join(pwaRuntimeRoot, 'ghost-game-maskable-192-v1.png'), 192, 192, 'png');

  if (fs.existsSync(legacyMark)) {
    fs.copyFileSync(legacyMark, path.join(sourceRoot, 'fallback', 'ghost-game-mark-fallback.svg'));
    fs.copyFileSync(legacyMark, path.join(runtimeRoot, 'fallback', 'ghost-game-mark-fallback.svg'));
    fs.copyFileSync(legacyMark, path.join(loadingRuntimeRoot, 'fallback', 'ghost-game-mark-fallback.svg'));
  }
  console.log('P0-01 deterministic art generated', { backgrounds: Object.keys(backgrounds).length, authScenes: Object.keys(sceneOverlays).length, statusIcons: Object.keys(statusIcons).length, bootScenes: Object.keys(bootConfigs).length });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
