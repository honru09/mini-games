'use strict';

const fs = require('fs');
const path = require('path');

const wizard = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'supabase-production-wizard.ps1'),
  'utf8'
);

const failures = [];
function check(name, value) {
  console.log(`${value ? 'PASS' : 'FAIL'}  ${name}`);
  if (!value) failures.push(name);
}

check(
  '可见字段提示不插入本地保存值',
  !wizard.includes('（直接 Enter 使用：$fallback）') &&
    wizard.includes('（直接 Enter 使用已保存值）')
);
check(
  '畸形单行 env 在读取前 fail-closed',
  /function Assert-IsolatedEnvValue/.test(wizard) &&
    /本地 Supabase 配置格式异常/.test(wizard) &&
    /Assert-IsolatedEnvValue \$Key \$value/.test(wizard)
);
check(
  '安全探针覆盖粘连 secret 且不回显内容',
  /malformedEnv/.test(wizard) &&
    /malformed_env_was_accepted/.test(wizard) &&
    /malformed_env_error_leaked_secret/.test(wizard)
);
check(
  '连续写入 env 保持一项一行',
  /roundTripEnv/.test(wizard) &&
    /env_round_trip_line_count_failed/.test(wizard) &&
    /@\(\$lines\) \+ @\("\$Key=\$Value"\)/.test(wizard)
);

if (failures.length) {
  console.error(`SUPABASE_WIZARD_SECRET_REDACTION_FAILED: ${failures.join('、')}`);
  process.exitCode = 1;
} else {
  console.log('SUPABASE_WIZARD_SECRET_REDACTION_ALL_PASS');
}
