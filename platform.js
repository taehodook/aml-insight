/* AML 인사이트 웹 배포용 데이터 연결.
   Claude 아티팩트 안에서는 window.claude가 이미 있어 이 파일은 아무것도 하지 않아요.
   일반 웹사이트에서는 data/ 폴더의 JSON을 읽기 전용 저장소처럼 보여 줘요. */
(function(){
  if(window.claude&&window.claude.use)return;
  var base=(document.currentScript&&document.currentScript.src||location.href).replace(/[^\/]*$/,"");
  var stamp=new Date().toISOString().slice(0,13).replace(/\D/g,"");
  function url(path){return base+"data/"+path+".json?v="+stamp}
  function load(path){return fetch(url(path),{cache:"no-cache"}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}
  function snapDoc(id,v){return{id:id,exists:!!v,data:function(){return v}}}
  function ro(){return Promise.reject({code:"read_only"})}
  var COLL={daily:"daily/latest"};
  function docRef(path){var id=path.split("/").pop();
    return{id:id,path:path,get:function(){return load(path).then(function(v){return snapDoc(id,v)})},
      set:ro,update:ro,delete:ro,collection:function(n){return colRef(path+"/"+n)}}}
  function colRef(path){var q={doc:function(id){return docRef(path+"/"+id)},where:function(){return q},orderBy:function(){return q},limit:function(){return q},
      get:function(){var f=COLL[path];if(!f)return Promise.resolve({docs:[]});return load(f).then(function(v){return{docs:v?[snapDoc(v.date?String(v.date).replace(/-/g,""):"latest",v)]:[]}})},
      onSnapshot:function(cb,err){q.get().then(cb,err||function(){});return function(){}}};return q}
  var db={doc:docRef,collection:colRef};
  window.claude={use:function(n){return Promise.resolve(n==="db"?db:null)}};
})();
