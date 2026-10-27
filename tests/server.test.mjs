import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle,merge,sanitize} from '../functions/lib/platform.js';
class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(readFileSync(new URL('../migrations/0001-platform.sql',import.meta.url),'utf8'))}
  prepare(sql){const db=this.db;let params=[];const q={bind(...values){params=values;return q},async first(){return db.prepare(sql).get(...params)||null},async all(){return {results:db.prepare(sql).all(...params)}},async run(){return {meta:db.prepare(sql).run(...params)}}};return q}
  async batch(statements){return Promise.all(statements.map(q=>q.run()))}
}
function client(db){let cookie='';return async(path,{method='GET',data,origin='https://aml.test'}={})=>{const response=await handle(new Request('https://aml.test/api/'+path,{method,headers:{Origin:origin,Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),{AML_DB:db});if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];return {status:response.status,body:await response.json(),headers:response.headers}}}
const day=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10).replaceAll('-','');
test('교차 사이트 요청을 차단하고 세션 쿠키를 보호해요',async()=>{
  const c=client(new D1());assert.equal((await c('session',{method:'POST',data:{},origin:'https://other.test'})).status,403);
  const s=await c('session',{method:'POST',data:{}});assert.equal(s.status,200);assert.match(s.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.equal((await c('session')).body.uid,s.body.uid);
});
test('other users private records cannot be read or overwritten',async()=>{
  const db=new D1(),a=client(db),b=client(db),u=(await a('session',{method:'POST',data:{}})).body.uid;
  await b('session',{method:'POST',data:{}});
  const path='store?path='+encodeURIComponent(`data/users/${u}/sabc`);
  assert.equal((await a(path,{method:'PUT',data:{t:'뉴스',u:'https://example.com'}})).status,200);
  assert.equal((await b(path)).status,403);assert.equal((await b(path,{method:'DELETE'})).status,403);
});
test('aggregate exposes totals without another voter identity or vote history',async()=>{
  const db=new D1(),a=client(db),b=client(db);const ua=(await a('session',{method:'POST',data:{}})).body.uid,ub=(await b('session',{method:'POST',data:{}})).body.uid;
  await a('store?path=talk/'+ua,{method:'PUT',data:{sector:'은행',votes:{[day()]:0}}});
  await b('store?path=talk/'+ub,{method:'PUT',data:{sector:'증권',votes:{[day()]:1}}});
  const result=(await a('store?path=talk')).body;
  assert.equal(result.aggregate.polls[day()].n,2);assert.equal(result.docs.length,1);assert.equal(result.docs[0].id,ua);assert.ok(!JSON.stringify(result).includes(ub));
  assert.equal((await a('store?path=talk/'+ua,{method:'PATCH',data:{votes:{[day()]:2}}})).status,409);
});
test('comments require accepted profile, and deletion removes all private records',async()=>{
  const db=new D1(),a=client(db),u=(await a('session',{method:'POST',data:{}})).body.uid;
  const post={nick:'검증',posts:{test:{t:'검증용 의견',k:'q-'+day(),at:0}}};
  assert.equal((await a('store?path=talk/'+u,{method:'PUT',data:post})).status,403);
  const profile='store?path='+encodeURIComponent(`data/users/${u}/profile`);
  assert.equal((await a(profile,{method:'PUT',data:{nick:'검증',sector:'은행',agreed:{terms:'2026-10-27',privacy:'2026-10-27'}}})).status,200);
  assert.equal((await a('store?path=talk/'+u,{method:'PUT',data:post})).status,200);
  assert.ok((await a('store?path=talk')).body.posts[0].at>0);
  assert.equal((await a('account',{method:'DELETE'})).status,200);assert.equal((await a(profile)).status,401);assert.equal(db.db.prepare('SELECT count(*) AS n FROM documents').get().n,0);
});
test('invalid payload, historical vote changes and prototype keys rejected',()=>{
  assert.throws(()=>merge({},JSON.parse('{"__proto__":{"admin":true}}')));
  assert.throws(()=>sanitize('talk/a',{votes:{'20200101':1}}));
  assert.throws(()=>sanitize('talk/a',{sector:'unknown'}));
  assert.throws(()=>sanitize('data/users/a/profile',{nick:'닉네임',agreed:{}}));
});
test('기존 스크랩 가져오기는 동의한 기기에서만 가능하고 통계에는 합계만 보여요',async()=>{
  const db=new D1(),a=client(db),u=(await a('session',{method:'POST',data:{}})).body.uid;
  const payload={items:[{id:'slegacy',data:{t:'이전 기사',u:'https://example.com/legacy',s:'비공개 스크랩 메모'}}]};
  assert.equal((await a('import-scraps',{method:'POST',data:payload})).status,403);
  await a('store?path=data/users/'+u+'/profile',{method:'PUT',data:{nick:'검증',agreed:{terms:'2026-10-27',privacy:'2026-10-27'}}});
  assert.equal((await a('import-scraps',{method:'POST',data:payload})).status,200);
  assert.equal((await a('import-scraps',{method:'POST',data:payload})).status,200);
  const result=(await a('store?path=talk')).body;
  assert.equal(result.aggregate.scraps.slegacy.n,1);
  assert.ok(!JSON.stringify(result).includes('비공개 스크랩 메모'));
});
test('의견을 삭제하고 다시 올려도 하루 등록 제한을 우회할 수 없어요',()=>{
  const now=Date.now(),posts=Object.fromEntries(Array.from({length:5},(_,i)=>['p'+i,{t:'검증 의견',k:'q-'+day(),at:now}]));
  const removed=sanitize('talk/device',{posts:{}},{posts},now);
  assert.ok(removed.posts.p0.del);
  assert.throws(()=>sanitize('talk/device',{posts:{newpost:{t:'추가 의견'}}},removed,now));
});

