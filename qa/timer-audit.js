'use strict';

const fs=require('fs'),path=require('path');
const files=['public/src/games/tank.js','public/src/games/tetris.js','public/src/games/xiangqi.js','server/index.js'];
const failures=[];
function check(name,value,detail){console.log((value?'PASS':'FAIL')+'  '+name+(value||!detail?'':' :: '+detail));if(!value)failures.push(name);}
for(const file of files){const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8'),intervals=(source.match(/setInterval\s*\(/g)||[]).length,clears=(source.match(/clearInterval\s*\(/g)||[]).length,timeouts=(source.match(/setTimeout\s*\(/g)||[]).length;check('Timer Audit：'+file+' 的 interval 有对应清理路径',intervals===0||clears>0,'intervals='+intervals+' clears='+clears);check('Timer Audit：'+file+' 未出现超量定时器创建',timeouts<80,'setTimeout='+timeouts);}
check('Timer Audit：Tank/Tetris destroy 明确清理主循环',/destroy\(\)[\s\S]{0,900}clearInterval\(simulationTimer\)/.test(fs.readFileSync(path.join(__dirname,'..','public/src/games/tank.js'),'utf8'))&&/destroy\(\)[\s\S]{0,900}clearInterval\(gameTimer\)/.test(fs.readFileSync(path.join(__dirname,'..','public/src/games/tetris.js'),'utf8')));
if(failures.length){console.error('TIMER_AUDIT_FAILED:',failures.join('、'));process.exitCode=1;}else console.log('TIMER_AUDIT_ALL_PASS');
