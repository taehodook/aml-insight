const DAY=86400000;
const SECTORS=['은행','증권','보험','저축은행','상호금융','카드','전자금융·PG','가상자산','소액해외송금','카지노','대부업','기타'];
const VERSION='2026-10-27';
const failure=(status,message)=>Object.assign(new Error(message),{status});
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function merge(a,b){let result={...a};for(const [k,v] of Object.entries(b)){if(['__proto__','constructor','prototype'].includes(k))throw failure(400,'올바르지 않은 항목이에요.');result[k]=object(v)&&object(a[k])?merge(a[k],v):v}return result}
export function allowed(path,uid){return path===`data/users/${uid}/profile`||new RegExp(`^data/users/${uid}/s[a-z0-9]{1,30}$`).test(path)||path===`talk/${uid}`||path===`lb/${uid}`}
function sector(value){if(value&&!SECTORS.includes(value))throw failure(400,'업권을 확인해 주세요.');return value||''}
export function sanitize(path,data,old={},now=Date.now()){
  if(!object(data)||JSON.stringify(data).length>100000)throw failure(400,'저장할 내용이 너무 길어요.');
  if(path.endsWith('/profile')){
    const nick=clean(data.nick,20);if(!nick||data.agreed?.terms!==VERSION||data.agreed?.privacy!==VERSION)throw failure(400,'현재 이용약관과 개인정보 안내를 확인해 주세요.');
    return {nick,sector:sector(data.sector),joinedAt:old.joinedAt||now,agreed:{terms:VERSION,privacy:VERSION,at:now}};
  }
  if(path.startsWith('talk/')){
    const day=new Date(now+9*3600000).toISOString().slice(0,10).replaceAll('-','');
    const out={nick:clean(data.nick,20),sector:sector(data.sector),votes:{},posts:{},likes:{},rep:{},jd:{},sc:{}};
    for(const [k,v] of Object.entries(old.votes||{}))if(/^\d{8}$/.test(k)&&+k>=+day-10000)out.votes[k]=v;
    for(const [k,v] of Object.entries(data.votes||{})){
      if(!/^\d{8}$/.test(k)||!Number.isInteger(v)||v<0||v>3)throw failure(400,'투표 값을 확인해 주세요.');
      if(k!==day&&old.votes?.[k]!==v)throw failure(400,'오늘 투표만 저장할 수 있어요.');
      if(old.votes?.[k]!=null&&old.votes[k]!==v)throw failure(409,'오늘 투표는 이미 저장됐어요.');out.votes[k]=v;
    }
    const previous=Object.entries(old.posts||{}),newPosts=Object.entries(data.posts||{}).filter(([k])=>!old.posts?.[k]);
    if(previous.filter(([,p])=>p.at>now-DAY).length+newPosts.length>5)throw failure(429,'의견은 하루 다섯 개까지 남길 수 있어요.');
    for(const [id,p] of previous)if(p.at>now-30*DAY)out.posts[id]=Object.hasOwn(data.posts||{},id)?p:{...p,del:true};
    for(const [id,p] of Object.entries(data.posts||{})){
      if(!/^[a-z0-9]{1,40}$/.test(id)||!object(p))throw failure(400,'의견 형식이 올바르지 않아요.');
      const t=clean(p.t,300);if(t.length<3)throw failure(400,'의견은 세 글자 이상 써 주세요.');
      const prev=old.posts?.[id];out.posts[id]=prev||{k:'q-'+day,t,at:now};
    }
    for(const name of ['likes','rep'])for(const [k,v] of Object.entries(data[name]||{}).slice(-300)){
      if(/^[a-z0-9-]{1,50}~[a-z0-9]{1,40}$/.test(k)&&(v===0||v===1))out[name][k]=v;
    }
    for(const [k,v] of Object.entries(data.jd||{}).slice(-300))if(k.length<90&&['y','n',''].includes(v))out.jd[k]=v;
    for(const [k,v] of Object.entries(data.sc||{}).slice(-300))if(/^s[a-z0-9]{1,30}$/.test(k)&&object(v))out.sc[k]={t:clean(v.t,300),at:now,on:v.on===1?1:0};
    return out;
  }
  if(path.startsWith('lb/')){
    const out={nick:clean(data.nick,20)};
    for(const name of ['rec','ms','ac'])if(object(data[name]))out[name]=Object.fromEntries(Object.entries(data[name]).slice(-100).filter(([k,v])=>k.length<80&&object(v)&&JSON.stringify(v).length<1000));
    return out;
  }
  if(!/^https?:\/\//.test(data.u||''))throw failure(400,'기사 주소를 확인해 주세요.');
  return {t:clean(data.t,300),u:clean(data.u,2000),k:clean(data.k,150),s:clean(data.s,8000),d:clean(data.d,10),at:old.at||now,c:Array.isArray(data.c)?data.c.slice(0,10).map(x=>({id:clean(x.id,40),lv:clean(x.lv,30),t:clean(x.t,500),v:['y','n'].includes(x.v)?x.v:''})):[]};
}
export function community(rows,uid){
  const polls={},judgments={},scraps={},likes={},reports={},posts=[];let totalVotes=0;
  for(const row of rows){const d=JSON.parse(row.data);for(const [day,v] of Object.entries(d.votes||{})){const p=polls[day]??={c:[0,0,0,0],n:0,bySec:{}};p.c[v]++;p.n++;totalVotes++;(p.bySec[d.sector||'기타']??=[0,0,0,0])[v]++}
    for(const [k,v] of Object.entries(d.jd||{})){const c=judgments[k]??={y:0,n:0};if(v==='y'||v==='n')c[v]++}
    for(const [k,v] of Object.entries(d.sc||{}))if(v.on){const a=scraps[k]??={t:v.t,n:0,at:0};a.n++;a.at=Math.max(a.at,v.at)}
    for(const k of Object.keys(d.likes||{}))if(d.likes[k])likes[k]=(likes[k]||0)+1;
    for(const k of Object.keys(d.rep||{}))if(d.rep[k])reports[k]=(reports[k]||0)+1;
  }
  for(const row of rows){const d=JSON.parse(row.data),owner=row.owner;for(const [pid,p] of Object.entries(d.posts||{})){const gid=owner+'~'+pid,hid=(reports[gid]||0)>=3;if(!p.del&&(!hid||owner===uid))posts.push({gid,pid,uid:owner,nick:d.nick||'익명',sector:d.sector||'',k:p.k,d:p.k.slice(2),t:p.t,at:p.at,hid,likes:likes[gid]||0,reps:reports[gid]||0})}}
  const mine=rows.find(r=>r.owner===uid);return {docs:mine?[{id:uid,data:JSON.parse(mine.data)}]:[],posts:posts.sort((a,b)=>b.at-a.at).slice(0,300),aggregate:{polls,judgments,scraps,totalVotes,participants:rows.length}};
}
async function limit(db,key,max,now){
  const r=await db.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+2*DAY).first();
  if(r.count>max)throw failure(429,'요청이 많아요. 잠시 뒤 다시 이용해 주세요.');
}
async function session(request,db){const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-aml_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;return db.prepare('SELECT uid FROM sessions WHERE token=? AND expires>?').bind(await digest(token),Date.now()).first()}
async function readBody(request){
  if(+(request.headers.get('Content-Length')||0)>300000)throw failure(413,'저장할 내용이 너무 길어요.');
  const reader=request.body?.getReader();if(!reader)throw failure(400,'저장할 내용이 없어요.');let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>300000){await reader.cancel();throw failure(413,'저장할 내용이 너무 길어요.')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw failure(400,'내용 형식을 확인해 주세요.')}
}
export async function handle(request,env){
  try{
    const db=env.AML_DB,url=new URL(request.url),route=url.pathname.slice(5),now=Date.now();
    if(!db)return json({ready:false,message:'저장 기능을 준비하고 있어요.'},503);
    if(route==='status')return json({ready:true,identity:'device',privacyVersion:VERSION});
    if(!['GET','POST','PUT','PATCH','DELETE'].includes(request.method))throw failure(405,'지원하지 않는 요청이에요.');
    if(request.method!=='GET'&&(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))throw failure(403,'사이트 안에서 다시 이용해 주세요.');
    let user=await session(request,db);
    if(route==='session'&&request.method==='POST'){
      if(user){
        const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-aml_session=([a-f0-9]{64})(?:;|$)/)[1];
        await db.prepare('UPDATE sessions SET expires=? WHERE token=?').bind(now+180*DAY,await digest(token)).run();
        return json({uid:user.uid},200,{'Set-Cookie':`__Host-aml_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`});
      }
      const ip=request.headers.get('CF-Connecting-IP')||'local',bucket=await digest(ip+'|'+Math.floor(now/DAY));await limit(db,'session:'+bucket,100,now);
      const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join(''),uid=crypto.randomUUID();
      await db.prepare('INSERT INTO sessions(token,uid,expires) VALUES(?,?,?)').bind(await digest(token),uid,now+180*DAY).run();
      await db.batch([db.prepare('DELETE FROM sessions WHERE expires<?').bind(now),db.prepare('DELETE FROM rate_limits WHERE expires<?').bind(now),db.prepare('DELETE FROM documents WHERE updated<?').bind(now-180*DAY)]);
      return json({uid},200,{'Set-Cookie':`__Host-aml_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`});
    }
    if(route==='session'&&request.method==='GET')return json({uid:user?.uid||null});
    if(!user)throw failure(401,'기기 연결을 다시 시작해 주세요.');const uid=user.uid;
    if(route==='account'&&request.method==='DELETE'){
      await db.batch([db.prepare('DELETE FROM documents WHERE owner=?').bind(uid),db.prepare('DELETE FROM sessions WHERE uid=?').bind(uid)]);
      return json({ok:true},200,{'Set-Cookie':'__Host-aml_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
    }
    if(route==='import-scraps'&&request.method==='POST'){
      await limit(db,'write:'+uid+':'+Math.floor(now/60000),40,now);
      const profile=await db.prepare('SELECT path FROM documents WHERE path=?').bind(`data/users/${uid}/profile`).first();if(!profile)throw failure(403,'기기 프로필을 먼저 등록해 주세요.');
      const data=await readBody(request);if(!Array.isArray(data.items)||data.items.length>20)throw failure(400,'스크랩은 스무 개씩 가져올 수 있어요.');
      const queries=data.items.map(item=>{if(!/^s[a-z0-9]{1,30}$/.test(item.id))throw failure(400,'스크랩 이름을 확인해 주세요.');const path=`data/users/${uid}/${item.id}`,value=sanitize(path,item.data,{},now);return db.prepare('INSERT OR IGNORE INTO documents(path,owner,data,updated) VALUES(?,?,?,?)').bind(path,uid,JSON.stringify(value),now)});
      if(queries.length)await db.batch(queries);return json({ok:true,count:queries.length});
    }
    const path=url.searchParams.get('path')||'';
    if(route!=='store')throw failure(404,'찾을 수 없는 기능이에요.');
    if(request.method==='GET'){
      if(path==='talk'){
        const r=await db.prepare("SELECT owner,data FROM documents WHERE path LIKE 'talk/%' ORDER BY updated DESC LIMIT 10000").all();
        const result=community(r.results,uid),scraps=await db.prepare("SELECT substr(path,length(owner)+13) AS id,json_extract(data,'$.t') AS t,MAX(updated) AS at,COUNT(*) AS n FROM documents WHERE path LIKE 'data/users/%/s%' GROUP BY id ORDER BY n DESC LIMIT 1000").all();
        result.aggregate.scraps=Object.fromEntries(scraps.results.map(x=>[x.id,{t:x.t,n:x.n,at:x.at}]));return json(result)
      }
      if(path==='lb'){const r=await db.prepare("SELECT owner AS id,data FROM documents WHERE path LIKE 'lb/%' ORDER BY updated DESC LIMIT 1000").all();return json({docs:r.results.map(x=>({id:x.id,data:JSON.parse(x.data)}))})}
      if(path===`data/users/${uid}`){const r=await db.prepare('SELECT path,data FROM documents WHERE owner=? AND path LIKE ?').bind(uid,path+'/s%').all();return json({docs:r.results.map(x=>({id:x.path.split('/').pop(),data:JSON.parse(x.data)}))})}
      if(!allowed(path,uid))throw failure(403,'내 기록만 열 수 있어요.');const r=await db.prepare('SELECT data FROM documents WHERE path=? AND owner=?').bind(path,uid).first();return json({exists:!!r,data:r?JSON.parse(r.data):null});
    }
    if(!allowed(path,uid))throw failure(403,'내 기록만 바꿀 수 있어요.');
    await limit(db,'write:'+uid+':'+Math.floor(now/60000),40,now);
    if(request.method==='DELETE'){
      if(path.endsWith('/profile'))throw failure(400,'계정 삭제 기능을 이용해 주세요.');await db.prepare('DELETE FROM documents WHERE path=? AND owner=?').bind(path,uid).run();return json({ok:true});
    }
    const body=await readBody(request);
    for(let attempt=0;attempt<3;attempt++){
      const previous=await db.prepare('SELECT data,version FROM documents WHERE path=? AND owner=?').bind(path,uid).first(),old=previous?JSON.parse(previous.data):{};
      const value=sanitize(path,request.method==='PATCH'?merge(old,body):body,old,now);
      if(path.startsWith('talk/')&&Object.keys(value.posts).length){const profile=await db.prepare('SELECT path FROM documents WHERE path=?').bind(`data/users/${uid}/profile`).first();if(!profile)throw failure(403,'기기 프로필을 먼저 등록해 주세요.')}
      const result=previous?await db.prepare('UPDATE documents SET data=?,version=version+1,updated=? WHERE path=? AND owner=? AND version=?').bind(JSON.stringify(value),now,path,uid,previous.version).run():await db.prepare('INSERT OR IGNORE INTO documents(path,owner,data,updated) VALUES(?,?,?,?)').bind(path,uid,JSON.stringify(value),now).run();
      if(result.meta.changes)return json({ok:true});
    }
    throw failure(409,'다른 저장과 겹쳤어요. 다시 시도해 주세요.');
  }catch(error){return json({error:error.status?'request_error':'server_error',message:error.status?error.message:'저장소에 연결하지 못했어요. 잠시 뒤 다시 이용해 주세요.'},error.status||503)}
}
