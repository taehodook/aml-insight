/* 정적 자료와 기기별 서버 기록을 연결해요. WLF 이력은 서버에 보내지 않아요. */
(function(){
  window.AML_DEVICE_MODE=true;
  var base=new URL('../',document.currentScript.src).href,stamp=new Date().toISOString().slice(0,13).replace(/\D/g,'');
  var ready=fetch(base+'api/status',{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.ok?r.json():null}).then(function(s){window.AML_SERVER_READY=!!(s&&s.ready);return window.AML_SERVER_READY}).catch(function(){window.AML_SERVER_READY=false;return false});
  var identity=null,watchers=[];
  function api(path,method,data){return fetch(base+'api/'+path,{method:method||'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined}).then(function(r){return r.json().then(function(v){if(!r.ok)throw Object.assign(new Error(v.message||'저장하지 못했어요.'),{code:v.error,status:r.status});return v})})}
  function uid(){if(!identity)identity=api('session','POST',{}).then(function(v){return v.uid});return identity}
  function load(path){return fetch(base+'data/'+path+'.json?v='+stamp,{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}
  function staticPath(path){return /^(lex|wlf)\/[a-z0-9-]+$/.test(path)||path==='daily/latest'}
  function snap(id,value){return{id:id,exists:!!value,data:function(){return value}}}
  function changed(){watchers.forEach(function(refresh){refresh()})}
  function mutation(path,method,data){return uid().then(function(){return api('store?path='+encodeURIComponent(path),method,data)}).then(function(v){changed();return v})}
  function ref(path){var id=path.split('/').pop();return {id:id,path:path,
    get:function(){if(staticPath(path))return load(path).then(function(v){return snap(id,v)});return uid().then(function(){return api('store?path='+encodeURIComponent(path))}).then(function(v){return snap(id,v.data)})},
    set:function(value){return mutation(path,'PUT',value)},update:function(value){return mutation(path,'PATCH',value)},delete:function(){return mutation(path,'DELETE')},collection:function(name){return collection(path+'/'+name)}}}
  function collection(path,filters,sorting,maximum){filters=filters||[];var q={
    doc:function(id){return ref(path+'/'+id)},where:function(key,op,value){return collection(path,filters.concat([[key,op,value]]),sorting,maximum)},orderBy:function(key,direction){return collection(path,filters,[key,direction],maximum)},limit:function(n){return collection(path,filters,sorting,n)},
    get:function(){if(path==='daily')return load('daily/latest').then(function(v){return{docs:v?[snap(v.date.replace(/-/g,''),v)]:[]}});return ready.then(function(ok){if(!ok)return{docs:[]};return uid().then(function(){return api('store?path='+encodeURIComponent(path))}).then(function(v){var docs=(v.docs||[]).map(function(d){return snap(d.id,d.data)});filters.forEach(function(f){docs=docs.filter(function(d){var x=d.data()[f[0]];return f[1]==='<'?x<f[2]:f[1]==='>='?x>=f[2]:x===f[2]})});if(sorting)docs.sort(function(a,b){var x=a.data()[sorting[0]],y=b.data()[sorting[0]];return (x<y?-1:x>y?1:0)*(sorting[1]==='desc'?-1:1)});if(maximum)docs=docs.slice(0,maximum);return{docs:docs,posts:v.posts,aggregate:v.aggregate}})})},
    onSnapshot:function(callback,error){var stopped=false,busy=false;function refresh(){if(stopped||busy||document.hidden)return;busy=true;q.get().then(function(v){if(!stopped)callback(v)}).catch(function(e){if(error&&!stopped)error(e)}).finally(function(){busy=false})}watchers.push(refresh);refresh();var timer=setInterval(refresh,60000);return function(){stopped=true;clearInterval(timer);watchers=watchers.filter(function(x){return x!==refresh})}}
  };return q}
  window.AMLPlatform={api:api,ready:ready,deleteAccount:function(){return api('account','DELETE').then(function(){identity=null;try{Object.keys(localStorage).filter(function(k){return k==='ai_wlf_profile'||k==='ai_wlf_logs'||k==='ai_vote_days'||k.indexOf('ai_vote_')===0}).forEach(function(k){localStorage.removeItem(k)})}catch(e){}location.reload()})}};
  window.claude={use:function(name){if(name==='db')return Promise.resolve({doc:ref,collection:collection});if(name==='user')return ready.then(function(ok){return ok?{id:uid,isOwner:function(){return Promise.resolve(false)}}:null});return Promise.resolve(null)}};
})();
