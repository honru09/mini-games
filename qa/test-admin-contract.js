'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  TEST_ADMIN_CAPABILITIES,
  TEST_ADMIN_LEVEL,
  TEST_ADMIN_COINS,
  isValidTestAdminUid,
  createTestAdminPolicy,
} = require('../server/test-admin');

const failures = [];
function check(name, predicate, detail){
  try {
    assert.ok(predicate, detail || name);
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push(name);
    console.log('FAIL  ' + name + ' :: ' + (error && error.message || detail || 'assertion failed'));
  }
}

function env(overrides = {}){
  return {
    TEST_ADMIN_ENABLED: '1',
    TEST_ADMIN_UID: 'u_testadmin01',
    TEST_ADMIN_USERNAME: 'TestAdmin01',
    TEST_ADMIN_PASSWORD: 'QaOnlyPass9!',
    ...overrides,
  };
}

async function main(){
  const renderEnvSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'render-env.js'), 'utf8');
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8');
  const disabled = createTestAdminPolicy({});
  check('默认关闭且不导出测试身份', disabled.enabled === false && !disabled.isTestAdminUid('u_testadmin01'));

  const incomplete = createTestAdminPolicy(env({ TEST_ADMIN_PASSWORD: '' }));
  check('启用但缺密码 fail-closed', incomplete.enabled === false && incomplete.fatal === true && incomplete.reason === 'test_admin_config_invalid');
  check('失效配置序列化不泄漏密码', !JSON.stringify(incomplete).includes('QaOnlyPass9!'));

  const invalidUsername = createTestAdminPolicy(env({ TEST_ADMIN_USERNAME: 'abc' }));
  check('非法用户名 fail-closed', invalidUsername.enabled === false && invalidUsername.fatal === true);

  const policy = createTestAdminPolicy(env());
  check('部署与运行时共享同一 UID 规则', isValidTestAdminUid('u_123456789abc') && isValidTestAdminUid('u_testadmin01') && !isValidTestAdminUid('u_bad value'));
  check('Render 工具复用服务端 UID 校验且禁用时不写秘密', renderEnvSource.includes("require('../server/test-admin')") && renderEnvSource.includes('isValidTestAdminUid(testAdminUid)') && renderEnvSource.includes("testAdminEnabled !== '1' && (testAdminUid || testAdminUsername || testAdminPassword)"));
  check('Supabase 启用时管理员远端引导失败会阻止监听', serverSource.includes('if (useSupabase && remotePersisted !== true) throw new Error(TestAdmin.TEST_ADMIN_REASON)'));
  check('完整环境可启用', policy.enabled === true && policy.uid === 'u_testadmin01' && policy.usernameKey === 'testadmin01');
  check('策略序列化不泄漏密码', !JSON.stringify(policy).includes('QaOnlyPass9!'));
  check('仅精确 UID 获得身份', policy.isTestAdminUid('u_testadmin01') && !policy.isTestAdminUid('U_TESTADMIN01') && !policy.isTestAdminUid('testadmin01'));
  check('能力为固定白名单', TEST_ADMIN_CAPABILITIES.length === 6 && policy.hasCapability('u_testadmin01', 'test_admin_unlimited_currency') && !policy.hasCapability('u_testadmin01', '*') && !policy.hasCapability('u_testadmin01', 'all') && !policy.hasCapability('u_otheradmin1', 'tournament_recover'));

  const users = {};
  let created = 0;
  let persisted = 0;
  const bootstrap = await policy.bootstrap({
    users,
    createStarterUser(uid, username){
      created++;
      return { uid, username, usernameKey: username.toLowerCase(), authTokens: [], owned: { avatars:[0], frames:[0], effects:[0], backgrounds:[0], game_cosmetics:[] } };
    },
    persist(){ persisted++; },
  });
  check('启动引导创建正常凭证用户', bootstrap.ok === true && bootstrap.created === true && created === 1 && persisted === 1 && users.u_testadmin01 && typeof users.u_testadmin01.passwordHash === 'string' && users.u_testadmin01.passwordHash.startsWith('s3$'));
  check('启动引导不在用户记录中写明文密码', !JSON.stringify(users.u_testadmin01).includes('QaOnlyPass9!'));

  const second = await policy.bootstrap({
    users,
    createStarterUser(){ throw new Error('idempotent bootstrap must not create'); },
    persist(){ persisted++; },
  });
  check('同一配置重启幂等', second.ok === true && second.created === false && second.passwordUpdated === false && persisted === 1);

  const conflictUsers = {
    u_testadmin01: { uid:'u_testadmin01', username:'OtherUser9', usernameKey:'otheruser9', passwordHash:null },
  };
  const conflict = await policy.bootstrap({ users:conflictUsers, createStarterUser(){ throw new Error('must not create'); } });
  check('UID 已属于不同用户名时拒绝接管', conflict.ok === false && conflict.reason === 'identity_conflict' && conflictUsers.u_testadmin01.username === 'OtherUser9');

  const originalProfile = {
    uid:'u_testadmin01', coins:3, xp:1, level:1,
    owned:{avatars:[0],frames:[0],effects:[0],backgrounds:[0],game_cosmetics:[]},
  };
  const prices = { avatars:{30:10,31:12}, frames:{1:10}, effects:{1:10}, backgrounds:{7:18}, game_cosmetics:{2001:8}, future:{999:25} };
  const virtual = policy.virtualProfile(originalProfile, {
    shopPrices:prices,
    xpForLevel:level => level * 100,
    levelProgress:xp => ({ level:Math.floor(xp / 100), current:0, required:100, total:xp }),
  });
  check('虚拟档案具有无限货币与最高测试等级', virtual.coins === TEST_ADMIN_COINS && virtual.level === TEST_ADMIN_LEVEL && virtual.xp === TEST_ADMIN_LEVEL * 100 && virtual.xpProgress.level === TEST_ADMIN_LEVEL);
  check('虚拟档案覆盖当前和未来价格目录但不修改原档案', virtual.owned.avatars.includes(30) && virtual.owned.game_cosmetics.includes(2001) && virtual.owned.future.includes(999) && !originalProfile.owned.avatars.includes(30) && !Object.prototype.hasOwnProperty.call(originalProfile.owned, 'future'));
  check('虚拟档案是 owner-only 能力投影', virtual.testAdmin && virtual.testAdmin.sandbox === true && virtual.testAdmin.capabilities.includes('tournament_recover'));

  const normalRoom = policy.roomAccess({ actorUid:'u_regular01', participantUids:['u_regular02'] });
  const testCreate = policy.roomAccess({ actorUid:'u_testadmin01', participantUids:[] });
  const normalIntoTest = policy.roomAccess({ actorUid:'u_regular01', participantUids:['u_testadmin01'], roomTestOnly:true });
  const testIntoNormal = policy.roomAccess({ actorUid:'u_testadmin01', participantUids:['u_regular01'] });
  const testSpectate = policy.roomAccess({ actorUid:'u_testadmin01', participantUids:[], roomTestOnly:true, spectator:true });
  check('普通房维持原可用性', normalRoom.ok === true && normalRoom.testOnly === false);
  check('测试管理员建房自动为沙盒', testCreate.ok === true && testCreate.testOnly === true);
  check('测试管理员与普通账号互相隔离', normalIntoTest.ok === false && testIntoNormal.ok === false && normalIntoTest.reason === 'test_admin_isolated');
  check('测试沙盒禁止观战入口', testSpectate.ok === false && testSpectate.reason === 'test_admin_isolated');

  check('社交与公共投影隔离', policy.socialAccess('u_testadmin01','u_regular01').ok === false && policy.socialAccess('u_regular01','u_regular02').ok === true && policy.shouldHidePublicUid('u_testadmin01') === true);
  check('赛事外部控制面不让测试账号成为参赛者', policy.tournamentCreateAccess('u_testadmin01',['u_regular01','u_regular02','u_regular03']).ok === true && policy.tournamentCreateAccess('u_testadmin01',['u_testadmin01','u_regular02','u_regular03']).ok === false);
  const sandboxReward = policy.sandboxReward({ gameId:'gomoku', mode:'ai', result:'win', xp:TEST_ADMIN_LEVEL * 100, level:TEST_ADMIN_LEVEL });
  check('沙盒结算稳定零持久奖励', sandboxReward.eligible === false && sandboxReward.blockedReason === 'test_admin_sandbox' && sandboxReward.currency === 0 && sandboxReward.xp === 0 && sandboxReward.levelAfter === TEST_ADMIN_LEVEL);
}

main().catch(error => {
  failures.push('测试脚本异常');
  console.error(error && error.stack || error);
}).finally(() => {
  if (failures.length){
    console.error('TEST_ADMIN_CONTRACT_FAILED: ' + failures.join('、'));
    process.exitCode = 1;
  } else {
    console.log('TEST_ADMIN_CONTRACT_ALL_PASS');
  }
});
