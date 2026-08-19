const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Utility functions
function calculateHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return null;
  }
}

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanDir(filePath, fileList);
    } else {
      if (filePath.endsWith('.png') || filePath.endsWith('.svg') || filePath.endsWith('.webp')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

// Ensure evidence directory exists
const evidenceDir = path.join(__dirname, '../requirements/active/art-gate-evidence');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// 1. Scan art-source/ for all candidate files
const artSourceDir = path.join(__dirname, '../art-source');
const candidateFiles = scanDir(artSourceDir);

// 2. Read catalog.json
const catalogPath = path.join(__dirname, '../asset-library/catalog.json');
let catalog = { collections: [], assets: [] };
if (fs.existsSync(catalogPath)) {
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
}

// 3. Read ART_APPROVAL_MATRIX.md
const matrixPath = path.join(__dirname, '../requirements/ART_APPROVAL_MATRIX.md');
let matrixContent = '';
if (fs.existsSync(matrixPath)) {
  matrixContent = fs.readFileSync(matrixPath, 'utf8');
}

// 4. Read asset_manifest.json
const manifestPath = path.join(__dirname, '../public/assets/manifests/asset_manifest.json');
let manifest = { assets: [] };
if (fs.existsSync(manifestPath)) {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

// 5. Read the shared Gate's separate development/release status.  This is
// intentionally governance-only: it never promotes or mutates an asset.
const routingPath = path.join(__dirname, '../requirements/MAINLINE_CONTROL_ROUTING.json');
let artGate = null;
if (fs.existsSync(routingPath)) {
  const routing = JSON.parse(fs.readFileSync(routingPath, 'utf8').replace(/^\uFEFF/, ''));
  artGate = routing.sharedGates?.['GATE-ART-GOLDEN-SET'] || null;
}

// Simple Report Generation
const report = {
  timestamp: new Date().toISOString(),
  totalCandidatesScanned: candidateFiles.length,
  catalogCollections: catalog.collections.length,
  catalogAssets: catalog.assets ? catalog.assets.length : 0,
  manifestAssets: manifest.assets.length,
  gate: artGate ? {
    status: artGate.status,
    developmentStatus: artGate.developmentStatus,
    releaseStatus: artGate.releaseStatus
  } : null,
  progressChecklist: [
    { task: "扫描艺术源文件候选 (Scanning art-source candidates)", status: candidateFiles.length > 0 ? "OK" : "PENDING" },
    { task: "读取素材目录 (Reading catalog.json)", status: catalog.collections.length > 0 ? "OK" : "PENDING" },
    { task: "读取审批矩阵 (Reading ART_APPROVAL_MATRIX)", status: matrixContent ? "OK" : "PENDING" },
    { task: "交叉校验资产清单 (Cross-referencing asset_manifest)", status: manifest.assets.length > 0 ? "OK" : "PENDING" },
    {
      task: "所有者原创美术清除与显式发布命令边界 (Owner art clearance / explicit release command)",
      status: artGate?.status === 'OPEN_BY_OWNER_AUTHORIZATION' &&
        artGate?.developmentStatus === 'OPEN' && artGate?.releaseStatus === 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED' ? 'OK' : 'PENDING'
    }
  ]
};

// Write evidence to file
const reportPath = path.join(evidenceDir, 'art-gate-status-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('--- GATE-ART-GOLDEN-SET STATUS REPORT ---');
console.log(`Total candidate image files in art-source/: ${report.totalCandidatesScanned}`);
console.log(`Collections registered in catalog: ${report.catalogCollections}`);
console.log(`Assets in manifest: ${report.manifestAssets}`);
console.log(`Art Gate development status: ${report.gate?.status || 'PENDING'} / ${report.gate?.developmentStatus || 'PENDING'}`);
console.log(`Art Gate release status: ${report.gate?.releaseStatus || 'PENDING'}`);
console.log('\n--- Progress Checklist ---');
report.progressChecklist.forEach(item => {
  console.log(`[${item.status}] ${item.task}`);
});
console.log(`\nDetailed report saved to: ${reportPath}`);
