// Ghost Game 用户名/密码纯模块回归：不启动服务、不联网、不读写账号库。
'use strict';

const {
  PASSWORD_HASH_VERSION,
  normalizeUsername,
  validateUsername,
  isValidUsername,
  validatePassword,
  isValidPassword,
  isPasswordHash,
  hashPassword,
  verifyPassword,
} = require('../server/auth-credentials');

const failures = [];
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

async function run(){
  check('哈希版本固定为 s3', PASSWORD_HASH_VERSION === 's3');
  check('用户名规范化只转换 ASCII 大小写', normalizeUsername('Ghost2026') === 'ghost2026');
  check('用户名必须为 4-20 位 ASCII 字母数字且两类都存在',
    isValidUsername('Honru09') && isValidUsername('A1b2') && isValidUsername('abcdefghijklmnopqrs1') &&
    !isValidUsername('abc') && !isValidUsername('abcdefghijklmnopqrst1') &&
    !isValidUsername('letters') && !isValidUsername('12345678') &&
    !isValidUsername('a_123') && !isValidUsername('鬼精灵1'));

  const usernameResult = validateUsername('HoNrU09');
  check('用户名校验返回可公开的 normalized 与稳定 reason',
    usernameResult.valid && usernameResult.normalized === 'honru09' && usernameResult.reason === '' &&
    validateUsername('bad').reason === 'username_invalid' && !('username' in usernameResult));
  check('用户名不 trim，前后空格会被拒绝', !isValidUsername(' A1b2 ') && normalizeUsername(' A1b2 ') === ' a1b2 ');

  check('密码接受 8-64 位可打印 ASCII 且不要求字符类别组合',
    isValidPassword('abcdefgh') && isValidPassword('12345678') && isValidPassword('!!!!!!!!') &&
    isValidPassword('        ') && isValidPassword('A'.repeat(64)));
  check('密码拒绝长度越界、控制字符和非 ASCII 字符',
    !isValidPassword('short7') && !isValidPassword('A'.repeat(65)) &&
    !isValidPassword('line\nbreak') && !isValidPassword('tab\there!') &&
    !isValidPassword('pass鬼精灵1'));
  const passwordResult = validatePassword(' Keep Me! ');
  check('密码校验结果不回显密码、转换值或长度',
    passwordResult.valid && Object.keys(passwordResult).sort().join(',') === 'reason,valid');

  const exactPassword = ' PaSs1! ';
  const firstHash = await hashPassword(exactPassword);
  const secondHash = await hashPassword(exactPassword);
  check('s3 哈希包含固定参数、随机盐和固定长度摘要',
    /^s3\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(firstHash) &&
    isPasswordHash(firstHash));
  check('相同密码每次使用随机盐产生不同哈希', firstHash !== secondHash);
  check('原始密码可以验证', await verifyPassword(exactPassword, firstHash));
  check('密码不 trim', !(await verifyPassword('PaSs1!', firstHash)));
  check('密码不 lowercase', !(await verifyPassword(' pass1! ', firstHash)));
  check('错误密码被拒绝', !(await verifyPassword(' WrOnG1! ', firstHash)));

  check('未知用户仍安全返回 false', !(await verifyPassword(exactPassword, null)));
  check('畸形/未知版本哈希安全返回 false',
    !(await verifyPassword(exactPassword, 's2$legacy')) &&
    !(await verifyPassword(exactPassword, firstHash.replace('$16384$', '$32768$'))));

  let invalidRejected = false;
  try {
    await hashPassword('bad\npassword');
  } catch (error) {
    invalidRejected = error instanceof TypeError && error.code === 'password_invalid' &&
      !String(error.message).includes('bad');
  }
  check('hashPassword 对无效格式抛出稳定且不泄密的错误', invalidRejected);

  if (failures.length){
    console.log('GHOST_AUTH_CREDENTIALS_HAS_FAILURES (' + failures.length + ')');
    process.exitCode = 1;
  } else {
    console.log('GHOST_AUTH_CREDENTIALS_ALL_PASS');
  }
}

run().catch(error => {
  console.error('GHOST_AUTH_CREDENTIALS_CRASH', error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
