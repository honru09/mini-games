/**
 * Supabase Backup Verification Script
 * 零依赖 Node.js 脚本，用于检查并验证数据库备份的状态和完整性。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKUP_DIR = process.env.SUPABASE_BACKUP_DIRECTORY || path.join(__dirname, '..', '.ops-backups');
const MAX_AGE_DAYS = 7;

function runVerification() {
  console.log('=== Supabase 备份验证 (Backup Verification) ===\n');

  // 1. 检查目录
  let dirExists = false;
  try {
    dirExists = fs.existsSync(BACKUP_DIR);
    if (!dirExists) {
      console.error(`❌ 备份目录不存在: ${BACKUP_DIR}`);
      console.log('建议: 运行 supabase-production-ops.ps1 -Action backup 以生成首个备份。');
      process.exit(1);
    }
    console.log(`✅ 备份目录存在: ${BACKUP_DIR}`);
  } catch (e) {
    console.error('❌ 无法访问备份目录:', e.message);
    process.exit(1);
  }

  // 2. 获取备份列表
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('supabase-') && f.endsWith('.dump'));
  
  if (files.length === 0) {
    console.warn('⚠️ 备份目录为空，无可用备份。');
    console.log('建议: 需要执行新的生产备份。');
    process.exit(0);
  }

  const backups = files.map(f => {
    const fullPath = path.join(BACKUP_DIR, f);
    const stats = fs.statSync(fullPath);
    return {
      name: f,
      fullPath,
      size: stats.size,
      date: stats.mtime
    };
  }).sort((a, b) => b.date - a.date); // 倒序

  console.log('\n--- 现有备份列表 ---');
  let latestValid = null;

  for (const b of backups) {
    const sizeMb = (b.size / (1024 * 1024)).toFixed(2);
    const daysOld = (Date.now() - b.date.getTime()) / (1000 * 60 * 60 * 24);
    
    // 验证文件头 (PostgreSQL Custom Dump Format: "PGDMP")
    let isPgDump = false;
    try {
      const fd = fs.openSync(b.fullPath, 'r');
      const buffer = Buffer.alloc(5);
      fs.readSync(fd, buffer, 0, 5, 0);
      fs.closeSync(fd);
      isPgDump = buffer.toString('utf-8') === 'PGDMP';
    } catch(e) {
      // Ignore read errors
    }

    const integrityIcon = isPgDump ? '✅' : '❌';
    console.log(`${integrityIcon} ${b.name} | 大小: ${sizeMb} MB | 日期: ${b.date.toISOString()} | 距离今天: ${daysOld.toFixed(1)} 天`);

    if (isPgDump && !latestValid) {
      latestValid = { ...b, daysOld };
    }
  }

  console.log('\n--- 评估建议 ---');
  if (latestValid) {
    if (latestValid.daysOld > MAX_AGE_DAYS) {
      console.warn(`⚠️ 最新有效备份距离今天已超过 ${MAX_AGE_DAYS} 天 (${latestValid.daysOld.toFixed(1)} 天)。`);
      console.log('💡 强烈建议立即运行新的数据库备份。');
    } else {
      console.log('✅ 最新备份有效且近期已更新，无需立即操作。');
    }
  } else {
    console.error('❌ 没有找到格式有效的数据库备份 (缺少 PGDMP 签名)。');
    console.log('💡 请重新运行备份脚本生成有效的 .dump 文件。');
  }
}

runVerification();
