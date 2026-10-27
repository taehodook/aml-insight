const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app.js', 'utf8');
const start = source.indexOf('  function saveLog(L){');
const end = source.indexOf('  function purgeOld(){', start);
assert.ok(start > -1 && end > start);
let stored;
const context = {
  PROFILE: {nick: '검증'}, MODE: 'local', LOGS: [],
  LS: {set(key, value) { stored = JSON.parse(JSON.stringify(value)); }},
  drawLogs() {},
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const record = {q:'KIM JONG UN',at:1,n:115,counts:{hi:8,mid:20,lo:87},dataDate:'2026.10.27.',top:Array.from({length:30},(_,i)=>({name:'name '+i,s:90}))};
context.saveLog(record);
assert.equal(stored[0].dataDate, record.dataDate);
assert.deepEqual(stored[0].counts, record.counts);
assert.equal(stored[0].top.length, 10);
assert.equal(stored[0].n, 115);
assert.equal(Object.values(stored[0].counts).reduce((a,b)=>a+b,0), stored[0].n);
console.log('조회 이력의 전체 집계·당시 확인일 보관 검증 통과');
