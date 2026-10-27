(function(){
  var $=function(id){return document.getElementById(id)};
  var DAY=864e5, now=new Date(); now.setHours(0,0,0,0);
  var RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var LS={get:function(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  function d(s){return new Date(s+"T00:00:00")}
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function fmtN(n){return Number(n).toLocaleString("ko-KR")}
  function stamp(ts){var x=new Date(ts);return x.getFullYear()+"."+String(x.getMonth()+1).padStart(2,"0")+"."+String(x.getDate()).padStart(2,"0")+". "+String(x.getHours()).padStart(2,"0")+":"+String(x.getMinutes()).padStart(2,"0")}
  function chips(el,list,cur,on){list.forEach(function(t){var b=document.createElement("button");b.type="button";b.className="chip";b.textContent=t;b.setAttribute("aria-pressed",t===cur);b.onclick=function(){[].forEach.call(el.children,function(x){x.setAttribute("aria-pressed",x===b)});on(t)};el.appendChild(b)})}

  /* ---------- 모핑 숫자 ---------- */
  function Morph(id,words,caps,hold){
    hold=hold||3300;var dur=850,st=$(id),a=st.children[0],b=st.children[1],cap=$(id+"cap"),bar=$(id+"bar"),num=$(id+"n"),i=0,shown=-1,raf=null,run=false,phase,last;
    bar.innerHTML=new Array(words.length+1).join("<i></i>");bar.style.setProperty("--hold",(hold/1000)+"s");
    function label(k){if(shown===k)return;shown=k;cap.textContent=caps[k];if(num)num.textContent=(k+1)+" / "+words.length;[].forEach.call(bar.children,function(x,j){x.classList.remove("on");if(j===k){void x.offsetWidth;x.classList.add("on")}})}
    function show(k){a.textContent=words[k];b.textContent=words[(k+1)%words.length];a.style.filter="";a.style.opacity=1;b.style.filter="";b.style.opacity=0;label(k)}
    function tick(ts){if(!run){raf=null;return}var dt=ts-last;
      if(phase==="hold"){if(dt>hold){phase="m";last=ts}}
      else{var f=Math.max(Math.min(dt/dur,1),.0001),g=1-f;b.style.filter="blur("+Math.min(8/f-8,100)+"px)";b.style.opacity=Math.pow(f,.4);a.style.filter="blur("+Math.min(8/g-8,100)+"px)";a.style.opacity=Math.pow(g,.4);if(f>=.5)label((i+1)%words.length);if(f>=1){i=(i+1)%words.length;show(i);phase="hold";last=ts}}
      raf=requestAnimationFrame(tick)}
    show(0);
    return{start:function(){if(RM||raf)return;run=true;phase="hold";last=performance.now();shown=-1;label(i);raf=requestAnimationFrame(tick)},stop:function(){run=false}};
  }
  var M={
    score:Morph("m2",["800","500","200"],["800점부터 전문 단계","500점부터 실무 단계","200점부터 기초 단계"]),
    board:null
  };

  /* ---------- 탭 ---------- */
  var KEYS=["today","puzzle","lounge","wlf","law","score","board","partner","admin"];
  function go(k,push){
    if(KEYS.indexOf(k)<0||(k==="admin"&&!(ADM&&ADM.owner)))k="today";
    KEYS.forEach(function(x){$("p-"+x).hidden=x!==k;var m=M[x];if(m)(x===k?m.start():m.stop())});
    [].forEach.call(document.querySelectorAll(".seg a"),function(t){t.setAttribute("aria-selected",t.getAttribute("data-go")===k)});
    if(k==="wlf")loadList();
    if(k==="law"&&typeof lxOpen==="function")lxOpen();
    if(k==="admin")loadAdmin();
    if(k==="today"&&DAILY){document.querySelector('.seg a[data-go="today"]').classList.remove("new");LS.set("ai_seen_day",DAILY.date)}
    if(typeof visitTab==="function")visitTab(k);
    if(typeof pzPause==="function"){if(k==="puzzle")pzResume();else{pzPause();stressFrame(false)}}
    if(push){try{history.replaceState(null,"","#"+k)}catch(e){}window.scrollTo(0,0)}
  }
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("[data-go]");if(a){e.preventDefault();var gm=a.getAttribute("data-game");if(gm&&typeof pickGame==="function")pickGame(gm);go(a.getAttribute("data-go"),true);return}
    var s=e.target.closest&&e.target.closest("[data-scroll]");if(s){e.preventDefault();$(s.getAttribute("data-scroll")).scrollIntoView({behavior:"smooth",block:"center"});return}
    var c=e.target.closest&&e.target.closest('a[href="#h-cert"]');if(c){e.preventDefault();$("cert").scrollIntoView({behavior:"smooth",block:"center"})}
  });
  window.addEventListener("hashchange",function(){var k=location.hash.slice(1);if(KEYS.indexOf(k)>-1)go(k,false)});

  /* ---------- 오늘: 인사이트 체크 ---------- */
  var ck="ai_judge_2026-10-04",J=LS.get(ck)||{},rows=[];
  function tally(){var y=0,n=0;rows.forEach(function(r){var v=J[r.getAttribute("data-c")];if(v==="y")y++;if(v==="n")n++});
    $("tally").textContent=(y+n)+" / "+rows.length;
    $("tallyTxt").textContent=(y+n)===0?"아직 판단하지 않았어요":"우리 회사 해당 "+y+"건 · 해당 없음 "+n+"건"}
  function bindToday(){rows=[].slice.call(document.querySelectorAll("#p-today .checks li"));
    rows.forEach(function(r){var id=r.getAttribute("data-c"),bs=[].slice.call(r.querySelectorAll(".yn button"));
      function paint(){bs.forEach(function(b){b.setAttribute("aria-pressed",J[id]===b.getAttribute("data-v"))});r.classList.toggle("on",!!J[id])}
      bs.forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-v");J[id]=J[id]===v?null:v;LS.set(ck,J);paint();tally();if(typeof onJudge==="function")onJudge(id,J[id])}});paint()});
    tally();
    [].forEach.call(document.querySelectorAll("#p-today .art"),function(art){
      [].forEach.call(art.querySelectorAll(".sum mark"),function(m){
        var li=art.querySelectorAll(".checks li")[+m.getAttribute("data-n")-1];if(!li)return;
        function on(x){m.classList.toggle("on",x);li.style.background=x?"var(--sunk)":""}
        m.addEventListener("mouseenter",function(){on(true)});m.addEventListener("mouseleave",function(){on(false)});
        m.addEventListener("click",function(){li.scrollIntoView({behavior:"smooth",block:"center"});on(true);setTimeout(function(){on(false)},1400)});
        li.addEventListener("mouseenter",function(){on(true)});li.addEventListener("mouseleave",function(){on(false)});
      });
    });
  }
  bindToday();

  /* ---------- WLF 명단 ---------- */
  var LIST=null,loading=null,ALL_HITS=[],shownHits=30;
  function norm(s){return String(s).toUpperCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").normalize("NFC").replace(/[^A-Z0-9가-힣]+/g," ").trim()}
  function rowEntry(r){var n=norm(r[2]);return{src:r[0],id:r[1],name:r[2],c:r[3],t:r[4],n:n,tok:n.split(" ")}}
  function kofiuDb(){if(!window.claude||!window.claude.use)return;window.claude.use("db").then(function(db){if(!db)return;return db.doc("wlf/kofiu-meta").get().then(function(m){if(!m.exists)return;var M=m.data(),n=M.parts||0,ps=[];for(var i=1;i<=n;i++)ps.push(db.doc("wlf/kofiu-"+i).get());
      return Promise.all(ps).then(function(ss){var rows=[];for(var i=0;i<ss.length;i++){if(!ss[i].exists)return;rows=rows.concat(ss[i].data().rows||[])}if(!rows.length||!LIST)return;
        LIST=LIST.filter(function(e){return e.src!=="KoFIU"}).concat(rows.map(rowEntry));$("cKF").textContent=fmtN(rows.length);$("wlfTotal").textContent=fmtN(LIST.length);
        var d=String(M.issued||"");$("kfNote").textContent="고시 제"+M.notice+"호, "+d.slice(0,4)+"."+(+d.slice(4,6))+"."+(+d.slice(6,8))+". 발령 기준 "+fmtN(M.entries||0)+"명"})})}).catch(function(){})}
  function srcName(s){return s==="KoFIU"?"금융위 제한대상자(KoFIU)":s}
  function loadList(){
    if(LIST||loading)return loading;
    $("wlfState").textContent="불러오는 중";
    loading=fetch("sanctions.json?v="+new Date().toISOString().slice(0,13),{cache:"no-cache"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
      LIST=j.rows.map(rowEntry);
      $("cOFAC").textContent=fmtN(j.counts.OFAC);$("cUN").textContent=fmtN(j.counts.UN);$("cEU").textContent=fmtN(j.counts.EU);if(j.counts.KoFIU)$("cKF").textContent=fmtN(j.counts.KoFIU);
      $("wlfTotal").textContent=fmtN(LIST.length);
      var dt=j.date.split("-");$("wlfDate").textContent=dt[0]+"."+dt[1]+"."+dt[2]+".";
      var age=Math.floor((Date.now()-Date.parse(j.date+"T00:00:00+09:00"))/864e5);if(j.sources){var note=document.createElement("p");note.className="fine";note.id="wlfSources";note.textContent="원천 발행일 · "+Object.keys(j.sources).map(function(k){return k+" "+(j.sources[k].publishedAt||"미제공")}).join(" · ")+" / 이름·별칭 항목 수이며 사람 수와 달라요.";if(!$("wlfSources"))$("wlfState").parentNode.after(note)}$("wlfState").textContent=age>7?"기준일로부터 "+age+"일 경과 · 원천 명단 확인 필요":"준비됨";kofiuDb();
    }).catch(function(){$("wlfState").textContent="불러오지 못함";loading=null;$("resSum").textContent="명단을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."});
    return loading;
  }
  function jw(s1,s2){
    if(s1===s2)return 1;var l1=s1.length,l2=s2.length;if(!l1||!l2)return 0;
    var md=Math.max(0,Math.floor(Math.max(l1,l2)/2)-1),m1=new Array(l1),m2=new Array(l2),m=0,i,j;
    for(i=0;i<l1;i++){var lo=Math.max(0,i-md),hi=Math.min(i+md+1,l2);for(j=lo;j<hi;j++){if(m2[j]||s1[i]!==s2[j])continue;m1[i]=m2[j]=true;m++;break}}
    if(!m)return 0;var t=0,k=0;for(i=0;i<l1;i++){if(!m1[i])continue;while(!m2[k])k++;if(s1[i]!==s2[k])t++;k++}
    var sim=(m/l1+m/l2+(m-t/2)/m)/3,p=0;while(p<4&&s1[p]===s2[p])p++;return sim+p*.1*(1-sim);
  }
  function score(q,qt,e){
    if(e.n===q)return 100;
    var all=qt.every(function(t){return e.tok.indexOf(t)>-1});if(all)return 96;
    var s=0;qt.forEach(function(t){var b=0;for(var i=0;i<e.tok.length;i++){var v=jw(t,e.tok[i]);if(v>b)b=v}s+=b});
    var tokAvg=s/qt.length, full=jw(q,e.n);
    return Math.round(Math.max(tokAvg*.98,full)*100);
  }
  function why(s){return s===100?"철자 그대로 일치":s===96?"입력한 단어가 모두 들어 있음":"철자가 비슷함"}
  function band(s){return s>=95?{k:"hi",t:"높음",a:"바로 확인"}:s>=90?{k:"mid",t:"검토",a:"추가 정보로 대조"}:{k:"lo",t:"낮음",a:"참고"}}
  var LAST=null;
  function search(raw){
    var q=norm(raw);if(!q)return;
    var ko=/[가-힣]/.test(q);
    var qt=q.split(" ").filter(function(t){return t.length>1||q.length<3}); if(!qt.length)qt=[q];
    var hits=[];
    for(var i=0;i<LIST.length;i++){var e=LIST[i];if(ko&&!/[가-힣]/.test(e.n))continue;if(Math.abs(e.n.length-q.length)>40&&qt.length===1&&e.tok.length>8)continue;var s=score(q,qt,e);if(s>=85)hits.push({e:e,s:s})}
    hits.sort(function(a,b){return b.s-a.s||a.e.name.length-b.e.name.length});
    if(ko&&!hits.length){ALL_HITS=[];shownHits=30;$("wlfMore").hidden=true;LAST=null;$("rlist").innerHTML='<li class="empty" style="display:block"><b>한글 표기 명단에는 없어요</b>한글 이름이 실린 건 금융위 제한대상자 일부예요. OFAC·UN·EU는 영문 표기라 로마자로도 한 번 더 조회해 보세요.</li>';$("resSum").textContent=raw.trim()+" · 한글 표기 일치 없음";$("capBtn").disabled=true;return}
    ALL_HITS=hits;shownHits=30;var at=Date.now();
    LAST={q:raw.trim(),at:at,n:hits.length,counts:hits.reduce(function(c,h){c[band(h.s).k]++;return c},{hi:0,mid:0,lo:0}),dataDate:$("wlfDate").textContent,top:hits.slice(0,30).map(function(h){return{s:h.s,w:h.e.n===q?"철자 그대로 일치":qt.every(function(t){return h.e.tok.indexOf(t)>-1})?"입력한 단어가 모두 들어 있음":"철자가 비슷함",name:h.e.name,src:h.e.src,id:h.e.id,c:h.e.c,t:h.e.t}})};
    render(LAST);
    saveLog(LAST);
  }
  function render(L){
    var c=L.counts||{hi:0,mid:0,lo:0};if(!L.counts)L.top.forEach(function(h){c[band(h.s).k]++});
    $("resSum").innerHTML='<b>'+esc(L.q)+'</b> · '+L.n+'건 · '+(L.n>L.top.length?'상위 '+L.top.length+'건 표시 · ':'')+(L.counts?'전체 이름 유사도 ':'표시 항목 이름 유사도 ')+'<span class="bd hi">높음 '+c.hi+'</span> <span class="bd mid">검토 '+c.mid+'</span> <span class="bd lo">낮음 '+c.lo+'</span> · <span class="mono" style="color:var(--muted)">'+stamp(L.at)+'</span>';
    $("rlist").innerHTML=L.top.length?L.top.map(function(h){var b=band(h.s);return '<li><div><div class="nm">'+esc(h.name)+'</div><div class="meta">'+esc(srcName(h.src))+' · '+esc(h.id)+' · '+esc(h.t)+' · '+esc(h.c||"-")+'</div><div class="wy">'+esc(h.w||why(h.s))+'</div></div><div class="sim '+b.k+'" title="이름 일치율"><span class="lab">이름 일치율</span><b>'+h.s+'%</b><i><em style="width:'+h.s+'%"></em></i><span class="bd '+b.k+'">'+b.t+' · '+b.a+'</span></div></li>'}).join("")
      :'<li class="empty" style="display:block"><b>비슷한 이름이 없어요</b>이름 일치율 85% 이상인 명단 항목이 없어요. 철자를 한 번 더 확인해 주세요.</li>';
    $("capBtn").disabled=false;$("wlfMore").hidden=!(L===LAST&&ALL_HITS.length>L.top.length);
  }
  var more=document.createElement("button");more.id="wlfMore";more.type="button";more.className="btn sm line";more.textContent="결과 30건 더 보기";more.hidden=true;$("rlist").after(more);
  more.onclick=function(){if(!LAST)return;shownHits+=30;LAST.top=ALL_HITS.slice(0,shownHits).map(function(h){return{s:h.s,w:h.e.n===norm(LAST.q)?"철자 그대로 일치":norm(LAST.q).split(" ").filter(function(t){return t.length>1||norm(LAST.q).length<3}).every(function(t){return h.e.tok.indexOf(t)>-1})?"입력한 단어가 모두 들어 있음":"철자가 비슷함",name:h.e.name,src:h.e.src,id:h.e.id,c:h.e.c,t:h.e.t}});render(LAST)};
  $("sForm").addEventListener("submit",function(e){e.preventDefault();var v=$("sq").value;if(!v.trim())return;$("sBtn").disabled=true;$("resSum").textContent="조회 중이에요.";Promise.resolve(loadList()).then(function(){if(LIST)search(v);$("sBtn").disabled=false})});
  [].forEach.call(document.querySelectorAll("[data-ex]"),function(b){b.onclick=function(){$("sq").value=b.getAttribute("data-ex");$("sForm").requestSubmit()}});

  /* ---------- 회원·이력 (24시간) ---------- */
  var db=null,uid=null,PROFILE=null,LOGS=[],MODE="local",logsRef=null,profRef=null;
  var SECT=["은행","증권","보험","저축은행","상호금융","카드","전자금융·PG","가상자산","소액해외송금","카지노","대부업","기타"];
  function drawAcct(){
    var a=$("acct");$("acctMode").textContent=MODE==="cloud"?"계정 저장":"이 기기 저장";
    if(!PROFILE){
      a.innerHTML='<p>무료로 가입하면 조회할 때마다 이력이 남고, 결과를 이미지로 캡처해 증빙으로 쓸 수 있어요.</p><ul><li>오늘 뉴스 인사이트 스크랩, 어느 기기에서나 다시 보기</li><li>최근 24시간 조회 이력 자동 보관</li><li>조회 결과 캡처(PNG) 저장</li><li>이력에서 다시 조회·다시 캡처</li></ul><button class="btn" type="button" data-join>무료 회원가입</button>';
      $("logCard").hidden=true;$("whoIni").textContent="?";$("whoTxt").textContent="회원가입";if(typeof scrapRefresh==="function")scrapRefresh();if(typeof memberSync==="function")memberSync();
    }else{
      a.innerHTML='<div class="me"><b>'+esc(PROFILE.nick.slice(0,1))+'</b><div><strong>'+esc(PROFILE.nick)+'</strong><span>'+esc(PROFILE.sector)+' · '+stamp(PROFILE.joinedAt).slice(0,11)+' 가입</span></div></div><p>조회하면 오른쪽 아래 이력에 쌓이고, 24시간 뒤 자동으로 지워져요.</p><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn sm line" type="button" id="clearLogs">이력 모두 지우기</button><button class="btn sm line" type="button" id="leave">탈퇴</button></div>';
      $("clearLogs").onclick=clearLogs;$("leave").onclick=leave;
      $("logCard").hidden=false;$("whoIni").textContent=PROFILE.nick.slice(0,1);$("whoTxt").textContent=PROFILE.nick;
      drawLogs();if(typeof scrapRefresh==="function")scrapRefresh();if(typeof memberSync==="function")memberSync();
    }
  }
  function drawLogs(){
    var cut=Date.now()-DAY, list=LOGS.filter(function(l){return l.at>=cut}).sort(function(a,b){return b.at-a.at});
    $("logN").textContent=list.length+"건";
    $("logs").innerHTML=list.length?list.map(function(l,i){var left=Math.max(0,Math.ceil((l.at+DAY-Date.now())/36e5));return '<li><span class="q">'+esc(l.q)+'</span><span class="w">'+stamp(l.at)+' · '+l.n+'건 · '+left+'시간 뒤 삭제</span><span class="acts"><button class="ic" type="button" data-re="'+i+'" title="다시 조회" aria-label="다시 조회"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button><button class="ic" type="button" data-cap="'+i+'" title="캡처" aria-label="캡처"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4" width="13" height="9.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8.7" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 4l1-1.8h3L10.5 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></span></li>'}).join("")
      :'<li class="empty" style="display:block;border:0">아직 이력이 없어요.</li>';
    [].forEach.call($("logs").querySelectorAll("[data-re]"),function(b){b.onclick=function(){var l=list[+b.getAttribute("data-re")];$("sq").value=l.q;$("sForm").requestSubmit();window.scrollTo({top:0,behavior:"smooth"})}});
    [].forEach.call($("logs").querySelectorAll("[data-cap]"),function(b){b.onclick=function(){capture(list[+b.getAttribute("data-cap")])}});
  }
  function localLogs(){var cut=Date.now()-DAY;LOGS=(LS.get("ai_wlf_logs")||[]).filter(function(l){return l.at>=cut});LS.set("ai_wlf_logs",LOGS)}
  function join(nick,sector,extra){
    if(!nick)return;var p=Object.assign({nick:nick,sector:sector,joinedAt:Date.now()},extra||{});
    if(MODE==="cloud"){profRef.set(p).then(function(){PROFILE=p;drawAcct()}).catch(function(){MODE="local";LS.set("ai_wlf_profile",p);PROFILE=p;localLogs();drawAcct()})}
    else{LS.set("ai_wlf_profile",p);PROFILE=p;localLogs();drawAcct()}
  }
  function leave(){
    if(MODE==="cloud"){clearLogs().then(function(){return profRef.delete()}).then(function(){PROFILE=null;LOGS=[];drawAcct()})}
    else{try{localStorage.removeItem("ai_wlf_profile");localStorage.removeItem("ai_wlf_logs")}catch(e){}PROFILE=null;LOGS=[];drawAcct()}
  }
  function clearLogs(){
    if(MODE==="cloud"){var ids=LOGS.map(function(l){return l._id});return ids.reduce(function(p,id){return p.then(function(){return logsRef.doc(id).delete()})},Promise.resolve()).then(function(){LOGS=[];drawLogs()})}
    LOGS=[];LS.set("ai_wlf_logs",[]);drawLogs();return Promise.resolve();
  }
  function saveLog(L){
    if(!PROFILE)return;var rec={q:L.q,at:L.at,n:L.n,counts:L.counts,dataDate:L.dataDate,top:L.top.slice(0,10)};
    if(MODE==="cloud"){var id="l"+L.at;logsRef.doc(id).set(rec).then(function(){rec._id=id;LOGS.push(rec);drawLogs()}).catch(function(){})}
    else{LOGS.push(rec);LS.set("ai_wlf_logs",LOGS);drawLogs()}
  }
  function purgeOld(){
    var cut=Date.now()-DAY;
    return logsRef.where("at","<",cut).get().then(function(s){return s.docs.reduce(function(p,dc){return p.then(function(){return logsRef.doc(dc.id).delete()})},Promise.resolve())}).catch(function(){});
  }
  function initAccount(){
    PROFILE=LS.get("ai_wlf_profile");localLogs();drawAcct();
    if(!window.claude||!window.claude.use)return;
    Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){
      db=r[0];var u=r[1];if(!db||!u)return null;return u.id().then(function(id){uid=id;return id});
    }).then(function(id){
      if(!id)return;
      profRef=db.doc("data/users/"+id+"/profile");logsRef=profRef.collection("wlf_logs");
      return profRef.get().then(function(s){
        MODE="cloud";
        if(s.exists){PROFILE=s.data();return purgeOld().then(function(){return logsRef.where("at",">=",Date.now()-DAY).orderBy("at","desc").limit(200).get()}).then(function(q){LOGS=q.docs.map(function(dc){var o=Object.assign({},dc.data());o._id=dc.id;return o})})}
        else{PROFILE=null;LOGS=[]}
      });
    }).then(function(){drawAcct()}).catch(function(){drawAcct()});
  }
  initAccount();
  setInterval(function(){if(PROFILE)drawLogs()},60000);

  /* ---------- 캡처 ---------- */
  var capBlob=null,capName="";
  function capture(L){
    if(!L)return;
    if(!PROFILE){go("wlf",false);$("acctCard").scrollIntoView({behavior:"smooth",block:"center"});$("acct").animate&&$("acct").animate([{background:"var(--sunk)"},{background:"transparent"}],{duration:1200});return}
    var rows=L.top.slice(0,10),W=1200,H=480+Math.max(rows.length,1)*72,c=document.createElement("canvas"),x=c.getContext("2d"),sc=2;
    c.width=W*sc;c.height=H*sc;x.scale(sc,sc);
    var F='"Paperlogy","Apple SD Gothic Neo","Malgun Gothic",sans-serif',MF='"JetBrains Mono",ui-monospace,monospace';
    x.fillStyle="#FFFFFF";x.fillRect(0,0,W,H);
    x.fillStyle="#0F1012";x.fillRect(0,0,W,96);
    x.fillStyle="#FFE14A";x.fillRect(56,58,30,8);
    x.fillStyle="#FFFFFF";x.font="800 26px "+F;x.fillText("AML 인사이트",100,62);
    x.font="500 15px "+MF;x.fillStyle="#9A9CA2";x.textAlign="right";x.fillText("WLF 이름 비교 참고 기록",W-56,60);x.textAlign="left";
    var y=150;x.fillStyle="#8A8C92";x.font="500 14px "+F;
    [["조회한 이름",L.q],["조회 일시",stamp(L.at)],["조회자",PROFILE.nick+" · "+PROFILE.sector],["대상 명단","OFAC · UN · EU · 금융위 · 기준일 "+(L.dataDate||"이전 기록: 기준일 미기록")],["결과","이름 일치율 85% 이상 "+L.n+"건 · "+(L.counts?"전체":"저장 항목")+" 높음(95% 이상) "+(L.counts?L.counts.hi:L.top.filter(function(h){return h.s>=95}).length)+"건 · 상위 "+rows.length+"건 수록"]].forEach(function(r,i){
      x.fillStyle="#8A8C92";x.font="500 14px "+F;x.fillText(r[0],56,y+i*34);x.fillStyle="#0F1012";x.font=(i===0?"800 20px ":"600 16px ")+F;x.fillText(r[1],210,y+i*34);
    });
    y=150+5*34+20;x.fillStyle="#0F1012";x.fillRect(56,y,W-112,2);y+=34;
    x.fillStyle="#8A8C92";x.font="600 13px "+F;x.fillText("명단 항목",56,y);x.fillText("출처 · ID",640,y);x.textAlign="right";x.fillText("이름 일치율 · 대조 안내",W-56,y);x.textAlign="left";y+=18;
    if(!rows.length){y+=40;x.fillStyle="#43454B";x.font="600 17px "+F;x.fillText("유사도 85% 이상인 명단 항목이 없어요.",56,y)}
    rows.forEach(function(h){
      x.strokeStyle="#E7E7E3";x.beginPath();x.moveTo(56,y+0.5);x.lineTo(W-56,y+0.5);x.stroke();y+=38;
      x.fillStyle="#0F1012";x.font="600 17px "+F;var nm=h.name;while(x.measureText(nm).width>560&&nm.length>4)nm=nm.slice(0,-2);if(nm!==h.name)nm+="…";x.fillText(nm,56,y);
      x.fillStyle="#8A8C92";x.font="500 13px "+MF;x.fillText(srcName(h.src)+" · "+h.id+" · "+h.t,640,y);
      var bb=band(h.s);x.textAlign="right";x.fillStyle=h.s>=95?"#C9381E":"#0F1012";x.font="700 17px "+MF;x.fillText(h.s+"%",W-56,y);x.font="600 12.5px "+F;x.fillStyle=h.s>=95?"#C9381E":"#8A8C92";x.fillText(bb.t+" · "+bb.a,W-56,y+18);x.textAlign="left";x.fillStyle="#8A8C92";x.font="500 12.5px "+F;x.fillText(h.w||why(h.s),56,y+18);y+=34;
    });
    x.fillStyle="#8A8C92";x.font="500 12.5px "+F;
    x.fillText("이름 일치율은 이름 철자만 비교한 값이에요. 동일인 여부는 생년월일·국적·여권번호를 원천 명단과 대조하고 내부 절차로 최종 확인하세요.",56,H-40);
    c.toBlob(function(bl){capBlob=bl;capName="WLF조회_"+L.q.replace(/[^\w가-힣]+/g,"_").slice(0,30)+"_"+stamp(L.at).replace(/[^\d]/g,"").slice(0,12)+".png";$("capImg").src=URL.createObjectURL(bl);$("capMsg").textContent="이미지를 저장해 증빙으로 남겨 두세요.";$("modal").hidden=false},"image/png");
  }
  $("capBtn").onclick=function(){capture(LAST)};
  $("capClose").onclick=function(){$("modal").hidden=true};
  $("modal").addEventListener("click",function(e){if(e.target===$("modal"))$("modal").hidden=true});
  $("capSave").onclick=function(){
    var use=window.claude&&window.claude.use?window.claude.use("downloads"):Promise.resolve(null);
    use.then(function(dl){
      if(!dl){$("capMsg").textContent="이 화면에서는 바로 저장할 수 없어요. 이미지를 길게 누르거나 오른쪽 클릭해서 저장해 주세요.";return}
      return dl.save({filename:capName,data:capBlob}).then(function(){$("capMsg").textContent="저장했어요."}).catch(function(e){$("capMsg").textContent=e&&e.code==="declined"?"저장을 취소했어요.":"저장하지 못했어요. 이미지를 길게 누르거나 오른쪽 클릭해서 저장해 주세요."});
    });
  };

  /* ---------- 실무 점수 ---------- */
  var Q=[
    {q:"같은 사람이 하루에 현금으로 주고받은 돈이 얼마 이상이면 고액현금거래보고(CTR) 대상일까요?",o:["500만 원","1천만 원","2천만 원","3천만 원"],a:1},
    {q:"카지노에서 일회성 금융거래로 고객확인을 해야 하는 기준금액은 얼마일까요?",o:["100만 원 이상","300만 원 이상","1천만 원 이상","1만 달러 이상"],a:1},
    {q:"가상자산을 다른 사업자에게 보낼 때 송신인·수신인 정보를 같이 넘겨야 하는(트래블룰) 기준은?",o:["50만 원 이상","100만 원 이상","300만 원 이상","1천만 원 이상"],a:1},
    {q:"고객확인 기록은 언제부터 몇 년 동안 남겨 둬야 할까요?",o:["확인한 날부터 3년","거래 관계가 끝난 때부터 5년","확인한 날부터 5년","거래 관계가 끝난 때부터 10년"],a:1},
    {q:"의심거래보고(STR)는 언제까지 해야 할까요?",o:["의심한 날부터 3영업일 안","다음 달 10일까지","지체 없이","30일 안"],a:2},
    {q:"계좌 없이 하는 일회성 전신송금은 얼마 이상일 때 고객확인 대상일까요?",o:["10만 원 이상","50만 원 이상","100만 원 이상","300만 원 이상"],a:2},
    {q:"고객이 고객확인에 필요한 정보 제공을 거부하면 어떻게 해야 할까요?",o:["거래는 하고 기록만 남긴다","신규 거래를 거절하고 기존 거래는 종료한다","보고책임자 승인으로 거래한다","다음 거래 때 다시 요청한다"],a:1},
    {q:"고위험 고객에게 하는 강화된 고객확인(EDD)에서 추가로 확인하는 것은?",o:["직장 전화번호","거래 목적과 자금의 원천","최근 3년 납세 내역","가족 관계"],a:1}
  ];
  var st={i:0,ans:[]};
  function drawQuiz(){
    var el=$("quiz");
    if(st.i>=Q.length){
      var c=st.ans.filter(function(a,i){return a===Q[i].a}).length,s=200+c*100,b=s>=800?2:s>=500?1:0,pct=((s-200)/800*100)+"%";
      $("sPt").hidden=false;$("sPt").style.left="0%";$("sFill").style.width="0";requestAnimationFrame(function(){requestAnimationFrame(function(){$("sPt").style.left=pct;$("sFill").style.width=pct})});
      $("qState").textContent="결과";
      var msg=["기준금액부터 다시 짚어 보면 점수가 금방 올라요.","실무 기준은 잘 잡혀 있어요. 자격 검정 2급에 도전해 볼 만해요.","기준과 절차를 정확히 알고 있어요. 1급 실기에 도전해 보세요."][b];
      el.innerHTML='<div class="res"><p class="n">'+s.toLocaleString()+'<small>/ 1,000</small></p><p class="lv">'+["기초","실무","전문"][b]+' 단계 · 8문항 중 '+c+'개 정답</p><p>'+msg+'</p><div class="acts"><a class="btn sm" href="#h-cert">자격 검정 보기</a><button class="btn sm line" type="button" id="again">다시 풀기</button></div><ol>'+
        Q.map(function(q,i){var ok=st.ans[i]===q.a;return '<li><i class="'+(ok?"":"x")+'">'+(ok?"O":"X")+'</i><span>'+q.q+' <b>'+q.o[q.a]+'</b></span></li>'}).join("")+'</ol></div>';
      $("again").onclick=function(){st={i:0,ans:[]};$("sPt").hidden=true;$("sFill").style.width="0";drawQuiz()};return;
    }
    var q=Q[st.i];$("qState").textContent=(st.i+1)+" / "+Q.length;
    el.innerHTML='<div class="qz-meta"><span>Q'+(st.i+1)+'</span><span>남은 문항 '+(Q.length-st.i-1)+'</span></div><p class="qz-q">'+q.q+'</p><div class="qz-o">'+q.o.map(function(o,j){return '<button type="button" data-j="'+j+'"><i>'+"ABCD"[j]+'</i><span>'+o+'</span></button>'}).join("")+'</div>';
    [].forEach.call(el.querySelectorAll("button"),function(b){b.onclick=function(){st.ans[st.i]=+b.getAttribute("data-j");st.i++;drawQuiz()}});
  }
  drawQuiz();

  /* ---------- 캘린더 ---------- */
  var EV=[
    {s:"2026-10-26",e:"2026-10-28",t:"서울핀테크위크 2026",p:"여의도 · 서울시 주최. 금융 AI 에이전트 기조연설, 글로벌 핀테크 토론회, 핀테크 채용관. 참가 신청 10월 21일까지, 무료",k:"핀테크",u:"https://www.newspim.com/news/view/20260912000050"},
    {s:"2026-10-26",e:"2026-10-30",t:"FATF 총회·실무그룹 회의",p:"파리. 고위험·관찰대상 국가 명단이 바뀌는 회의라 끝나면 국가위험 기준을 다시 확인해요",k:"AML",u:"https://www.fatf-gafi.org/en/calendars/events.html"},
    {s:"2026-11-25",e:"2026-11-27",t:"코리아 핀테크 위크 2026",p:"양재 aT센터 · 금융위원회. 에이전틱 AI, 디지털자산, 사이버보안 세미나와 채용설명회",k:"핀테크",u:"https://www.fsc.go.kr/no010101/87437"},
    {s:"2027-01-01",t:"가상자산 소득 과세 시행 예정",p:"현행 세법 기준. CARF(가상자산 정보 자동교환)와 맞물려 거래소의 거래정보 관리 부담이 커져요",k:"규제"},
    {s:"2027-02-22",e:"2027-02-26",t:"FATF 총회·실무그룹 회의",p:"2월 총회. 국가 명단 변경 여부를 확인해요",k:"AML",u:"https://www.fatf-gafi.org/en/calendars/events.html"}
  ];
  var calCur="전체";
  function md(s){var x=d(s);return String(x.getMonth()+1).padStart(2,"0")+"."+String(x.getDate()).padStart(2,"0")}
  function ddn(s){return Math.round((d(s)-now)/DAY)}
  function drawCal(){
    var l=EV.filter(function(e){return d(e.e||e.s)>=now&&(calCur==="전체"||e.k===calCur)});
    $("calList").innerHTML=l.map(function(e){var n=ddn(e.s),live=n<=0;
      return '<li><span class="w">'+md(e.s)+(e.e?'<small>~ '+md(e.e)+'</small>':'<small>'+d(e.s).getFullYear()+'</small>')+'</span><div class="what"><b>'+(e.u?'<a href="'+e.u+'" target="_blank" rel="noopener">'+e.t+'</a>':e.t)+'</b><p>'+e.k+' · '+e.p+'</p></div><span class="dd'+(live||n<=30?" hot":"")+'">'+(live?"진행 중":"D-"+n)+'</span></li>'}).join("")||'<li><div class="what"><p>이 구분에 다가오는 일정이 없어요.</p></div></li>';
  }
  chips($("calChips"),["전체","AML","핀테크","규제"],calCur,function(t){calCur=t;drawCal()});drawCal();

  /* ---------- 채용 ---------- */
  var JB=[
    {r:"2026-10-02",dl:"2026-11-01",co:"나이스신용정보 (네이버파이낸셜)",t:"AML 고객확인(KYC) 서류검증 사원",x:"경력무관",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50098731"},
    {r:"2026-09-30",dl:"2026-10-11",co:"파라다이스세가사미",t:"Paradise City 자금세탁방지(AML) 담당자",x:"신입",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50076820"},
    {r:"2026-09-29",dl:null,co:"다날핀테크",t:"AML 자금세탁방지 담당자",x:"경력 3년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50071427"},
    {r:"2026-09-28",dl:"2026-10-11",co:"다날",t:"KYC 담당자 (계약직)",x:"경력무관",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50058789"},
    {r:"2026-09-27",dl:"2026-10-25",co:"코인원",t:"AML Manager (내부통제 기획·운영)",x:"경력 3년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/49861894"},
    {r:"2026-09-23",dl:"2026-10-23",co:"그레이브릿지 (비블록)",t:"규제대응본부 AML·컴플라이언스",x:"경력 5년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50049349"},
    {r:"2026-09-23",dl:"2026-10-23",co:"굿씽크",t:"AML 업무 경험 Java·Spring 개발자",x:"경력 9년+",k:"개발",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50049480"},
    {r:"2026-09-22",dl:"2026-10-22",co:"트래블월렛",t:"자금세탁방지·컴플라이언스 담당",x:"경력 5년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50040492"},
    {r:"2026-09-21",dl:"2026-10-21",co:"비바리퍼블리카 (토스)",t:"AML Operations Manager (Global)",x:"경력 1년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/50034002"},
    {r:"2026-09-14",dl:"2026-10-14",co:"한패스",t:"핀테크·금융 자금세탁방지 올라운더",x:"경력 3년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/49982259"},
    {r:"2026-09-13",dl:"2026-10-13",co:"이오스페이먼츠",t:"리스크 관리(RM)·자금세탁방지(AML) 경력직",x:"경력 5년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/49979824"},
    {r:"2026-09-11",dl:"2026-10-25",co:"코인원",t:"AML Manager (STR 기획·운영)",x:"경력 2년+",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/49861780"},
    {r:"2026-09-09",dl:"2026-11-08",co:"헥토월렛원",t:"백엔드 개발자 (AML 전담)",x:"경력 1년+",k:"개발",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/49959916"},
    {r:"2026-09-07",dl:"2026-10-07",co:"이나인페이 (E9pay)",t:"자금세탁방지팀 운영(OPS) 담당자",x:"신입·경력",k:"실무",u:"https://www.jobkorea.co.kr/Recruit/GI_Read/49943262"}
  ];
  var jobCur="전체",JOBS=JB.filter(function(j){return d(j.r)>=new Date(now.getTime()-30*DAY)&&(!j.dl||d(j.dl)>=now)});
  function drawJobs(){
    var l=JOBS.filter(function(j){return jobCur==="전체"||j.k===jobCur});
    $("jobN").textContent=JOBS.length+"건";
    $("jobList").innerHTML=l.map(function(j){var n=j.dl?ddn(j.dl):null;return '<li><a href="'+j.u+'" target="_blank" rel="noopener"><span><span class="co">'+j.co+'</span><span class="t">'+j.t+'</span></span><span class="x">'+j.x+'</span><span class="dd'+(n!==null&&n<=7?" hot":"")+'">'+(n===null?"상시":n===0?"D-DAY":"D-"+n)+'</span></a></li>'}).join("")||'<li><a href="#board"><span class="t">최근 한 달 안에 올라온 공고가 없어요.</span></a></li>';
  }
  chips($("jobChips"),["전체","실무","개발"],jobCur,function(t){jobCur=t;drawJobs()});drawJobs();
  var up=EV.filter(function(e){return d(e.e||e.s)>=now}).slice(0,2);
  var soon=JOBS.filter(function(j){return j.dl}).sort(function(a,b){return d(a.dl)-d(b.dl)})[0];
  var w3=up.map(function(e){var n=ddn(e.s);return n<=0?"진행 중":"D-"+n}),c3=up.map(function(e){return e.t});
  w3.push(JOBS.length+"건");c3.push("최근 한 달 AML 채용 공고");
  if(soon){var sn=ddn(soon.dl);w3.push(sn===0?"D-DAY":"D-"+sn);c3.push("가장 먼저 마감되는 공고 · "+soon.co)}
  M.board=Morph("m3",w3,c3);

  /* ---------- 메일 복사 ---------- */
  $("copy").onclick=function(){var el=$("mail"),t=$("toast");
    function sel(){var r=document.createRange();r.selectNodeContents(el);var s=getSelection();s.removeAllRanges();s.addRange(r);t.textContent="주소를 선택했어요. 복사해 주세요."}
    try{navigator.clipboard.writeText(el.textContent).then(function(){t.textContent="복사했어요."},sel)}catch(e){sel()}
    setTimeout(function(){t.textContent=""},2500)};

  /* ---------- 오늘의 스도쿠 ---------- */
  var PZ=(function(){
    function kstDay(){var f=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return f}
    function hash(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0}}
    function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
    function shuffle(arr,r){for(var i=arr.length-1;i>0;i--){var j=Math.floor(r()*(i+1)),t=arr[i];arr[i]=arr[j];arr[j]=t}return arr}
    var BOX=[];for(var i=0;i<81;i++)BOX[i]=Math.floor(Math.floor(i/9)/3)*3+Math.floor(i%9/3);
    function solveCount(g,limit){
      var rows=new Array(9).fill(0),cols=new Array(9).fill(0),boxes=new Array(9).fill(0),empt=[];
      for(var i=0;i<81;i++){var v=g[i];if(v){var b=1<<v;rows[(i/9)|0]|=b;cols[i%9]|=b;boxes[BOX[i]]|=b}else empt.push(i)}
      var count=0,grid=g.slice();
      function rec(){
        if(count>=limit)return;
        var best=-1,bm=0,bc=10;
        for(var k=0;k<empt.length;k++){var c=empt[k];if(grid[c])continue;var m=~(rows[(c/9)|0]|cols[c%9]|boxes[BOX[c]])&1022,n=0,x=m;while(x){x&=x-1;n++}if(n<bc){bc=n;best=c;bm=m;if(n<=1)break}}
        if(best<0){count++;return}
        if(!bc)return;
        for(var v=1;v<=9;v++){if(!(bm&(1<<v)))continue;var b=1<<v;grid[best]=v;rows[(best/9)|0]|=b;cols[best%9]|=b;boxes[BOX[best]]|=b;rec();grid[best]=0;rows[(best/9)|0]&=~b;cols[best%9]&=~b;boxes[BOX[best]]&=~b;if(count>=limit)return}
      }
      rec();return count;
    }
    function fullGrid(r){
      var g=new Array(81).fill(0);
      function ok(i,v){var rr=(i/9)|0,cc=i%9;for(var k=0;k<9;k++){if(g[rr*9+k]===v||g[k*9+cc]===v)return false}var br=rr-rr%3,bc=cc-cc%3;for(var a=0;a<3;a++)for(var b=0;b<3;b++)if(g[(br+a)*9+bc+b]===v)return false;return true}
      function fill(i){if(i===81)return true;var ns=shuffle([1,2,3,4,5,6,7,8,9],r);for(var k=0;k<9;k++){if(ok(i,ns[k])){g[i]=ns[k];if(fill(i+1))return true;g[i]=0}}return false}
      fill(0);return g;
    }
    function make(day,lv){
      var r=mulberry(hash("aml-insight|"+day+"|"+lv)()),sol=fullGrid(r),puz=sol.slice(),target=lv==="h"?24:33,clues=81;
      var order=shuffle(Array.from({length:81},function(_,i){return i}),r);
      for(var k=0;k<order.length&&clues>target;k++){var c=order[k],o=80-c;if(!puz[c])continue;var a=puz[c],b=puz[o];puz[c]=0;if(o!==c)puz[o]=0;
        if(solveCount(puz,2)!==1){puz[c]=a;puz[o]=b}else clues-=(o!==c&&b)?2:1}
      return {sol:sol,puz:puz};
    }
    return {kstDay:kstDay,make:make};
  })();

  var pz={day:PZ.kstDay(),lv:"n",data:{},cur:null,sel:-1,memo:false,started:false,done:false,elapsed:0,t0:0,tick:null,penalty:0};
  var LVN={n:"보통",h:"어려움"};
  (function(){var p=pz.day.split("-");$("pzDate").textContent=p[0]+"."+p[1]+"."+p[2]+".";})();
  function fmtT(ms){var s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
  function pkey(){return "ai_pz_"+pz.day+"_"+pz.lv}
  function hist(){return LS.get("ai_pz_hist")||{}}
  function streak(){var h=hist(),n=0,d=new Date(pz.day+"T00:00:00+09:00");
    for(;;){var k=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);if(h[k]){n++;d=new Date(d.getTime()-DAY)}else break}
    return n}
  function loadLevel(lv){
    pz.lv=lv;clearInterval(pz.tick);pz.practice=false;
    if(!pz.data[lv])pz.data[lv]=PZ.make(pz.day,lv);
    var sv=LS.get(pkey());
    pz.cur=sv&&sv.v?sv.v.slice():pz.data[lv].puz.slice();
    pz.memos=sv&&sv.m?sv.m:{};
    pz.elapsed=sv?sv.e||0:0;pz.done=!!(sv&&sv.done);pz.started=pz.done;pz.penalty=sv?sv.p||0:0;pz.sel=-1;
    $("pzLvLab").textContent=LVN[lv];$("rkLv").textContent=LVN[lv];
    $("pzCover").hidden=pz.started;$("board").classList.toggle("blur",!pz.started);$("pzCheck").hidden=lv==="h";
    $("pzCoverTxt").textContent=pz.elapsed>0?"이어서 풀기 · "+fmtT(pz.elapsed):"시작을 누르면 시간이 흘러요";
    $("pzStart").textContent=pz.elapsed>0?"이어서":"시작";
    $("pzMsg").textContent=pz.done?"오늘 "+LVN[lv]+" 문제를 "+fmtT(pz.elapsed)+"에 풀었어요. 내일 아침 새 문제가 나와요.":"";
    $("pzTime").textContent=fmtT(pz.elapsed);$("pzMore").hidden=!pz.done;
    drawBoard();drawStats();drawRank();
  }
  function PD(){return pz.practice?pz.pdata:pz.data[pz.lv]}
  function save(){if(pz.practice)return;LS.set(pkey(),{v:pz.cur,m:pz.memos,e:pz.elapsed,done:pz.done,p:pz.penalty})}
  function run(){if(pz.done||!pz.started)return;clearInterval(pz.tick);pz.t0=Date.now()-pz.elapsed;pz.tick=setInterval(function(){pz.elapsed=Date.now()-pz.t0;$("pzTime").textContent=fmtT(pz.elapsed)},500)}
  function pause(){if(pz.tick){clearInterval(pz.tick);pz.tick=null;if(pz.started&&!pz.done){pz.elapsed=Date.now()-pz.t0;save()}}}
  var CODES=["KYC","CTR","EDD","STR","WLF","PEP","RBA","FIU","TMS"],CODEI=["K","C","E","S","W","P","R","F","T"],DISP="num";
  function showTerm(id,i){try{var t=todayTerms()[i];$(id).innerHTML='<small>풀이 보상 · 오늘의 AML 용어</small><b>'+esc(t)+'</b><span>'+esc(TDESC[t])+'</span><em>이 용어는 오늘 아케이드 게임에도 노란 밑줄로 나와요.</em>';$(id).hidden=false}catch(e){}}
  function sym(v){return DISP==="aml"?CODES[v-1]:String(v)}
  function symm(v){return DISP==="aml"?CODEI[v-1]:String(v)}
  function padDraw(){$("pad").classList.toggle("code",DISP==="aml");$("pad").innerHTML=[1,2,3,4,5,6,7,8,9].map(function(n){return '<button type="button" data-n="'+n+'" aria-label="'+sym(n)+' 입력">'+(DISP==="aml"?"<b>"+CODES[n-1]+"</b><small>"+n+"</small>":n)+'</button>'}).join("");
    [].forEach.call($("pad").children,function(b){b.onclick=function(){input(+b.getAttribute("data-n"))}})}
  function drawBoard(){
    var b=$("board"),g=PD().puz,cur=pz.cur,sv=pz.sel>=0?cur[pz.sel]:0;
    b.classList.toggle("code",DISP==="aml");if(!b.children.length){var h="";for(var i=0;i<81;i++){var r=(i/9)|0;h+='<button type="button" class="cell'+(r===2||r===5?" rb":"")+(r===8?" lastrow":"")+'" data-i="'+i+'" role="gridcell" aria-label="'+(r+1)+'행 '+(i%9+1)+'열"></button>'}b.innerHTML=h;
      [].forEach.call(b.children,function(c){c.onclick=function(){if(!pz.started||pz.done)return;pz.sel=+c.getAttribute("data-i");drawBoard()}})}
    var sr=pz.sel>=0?(pz.sel/9)|0:-1,sc=pz.sel>=0?pz.sel%9:-1,sb=pz.sel>=0?Math.floor(sr/3)*3+Math.floor(sc/3):-1,cnt=new Array(10).fill(0);
    for(var i=0;i<81;i++){var c=b.children[i],v=cur[i],r=(i/9)|0,cc=i%9,bx=Math.floor(r/3)*3+Math.floor(cc/3);if(v)cnt[v]++;
      c.classList.toggle("g",!!g[i]);c.classList.toggle("sel",i===pz.sel);c.classList.toggle("peer",i!==pz.sel&&(r===sr||cc===sc||bx===sb));c.classList.toggle("same",i!==pz.sel&&!!sv&&v===sv);
      if(v){c.textContent=sym(v)}else if(pz.memos[i]&&pz.memos[i].length){c.innerHTML='<span class="memo-g">'+[1,2,3,4,5,6,7,8,9].map(function(n){return "<i>"+(pz.memos[i].indexOf(n)>-1?symm(n):"")+"</i>"}).join("")+"</span>"}else c.textContent="";
      if(!v)c.classList.remove("bad")}
    [].forEach.call($("pad").children,function(p){var n=+p.getAttribute("data-n");p.classList.toggle("done",pz.lv!=="h"&&cnt[n]>=9)});
  }
  function input(n){
    if(!pz.started||pz.done||pz.sel<0)return;var i=pz.sel;if(PD().puz[i])return;
    if(pz.memo&&n){var m=pz.memos[i]||[],k=m.indexOf(n);if(k>-1)m.splice(k,1);else m.push(n);pz.memos[i]=m;pz.cur[i]=0}
    else{pz.cur[i]=n;if(n)delete pz.memos[i];$("board").children[i].classList.remove("bad")}
    drawBoard();save();
    if(pz.cur.every(function(v,j){return v===PD().sol[j]}))finish();
  }
  function finish(){
    pause();pz.done=true;$("pzMore").hidden=false;
    if(pz.practice){pz.pcount=(pz.pcount||0)+1;$("pzMsg").textContent="연습 판 완료 · "+fmtT(pz.elapsed)+". 연습 기록은 순위에 올라가지 않아요.";pz.sel=-1;drawBoard();return}
    save();var h=hist();h[pz.day]=true;LS.set("ai_pz_hist",h);
    $("pzMsg").textContent="다 풀었어요. 기록 "+fmtT(pz.elapsed)+(pz.penalty?" (틀린 칸 보기 +"+pz.penalty*30+"초 포함)":"")+". 순위에 올렸어요.";
    pz.sel=-1;drawBoard();drawStats();submit();showTerm("pzTerm",0);
  }
  /* 공유 순위 */
  var LB={db:null,uid:null,docs:[],me:null,unsub:null};
  function recKey(){return pz.day.replace(/-/g,"")+"-"+pz.lv}
  function nick(){return (LB.me&&LB.me.nick)||(PROFILE&&PROFILE.nick)||LS.get("ai_pz_nick")||""}
  function submit(){
    var rec={t:pz.elapsed,at:Date.now()};
    var mine=LS.get("ai_pz_best")||{};mine[recKey()]=rec;LS.set("ai_pz_best",mine);
    if(!LB.db||!LB.uid){drawRank();return}
    if(!nick()){$("nickCard").hidden=false;$("nickIn").focus();return}
    var cur=LB.me?JSON.parse(JSON.stringify(LB.me)):{rec:{}};cur.nick=nick();cur.sector=(PROFILE&&PROFILE.sector)||cur.sector||"";cur.rec=cur.rec||{};
    if(cur.rec[recKey()]&&cur.rec[recKey()].t<=rec.t){drawRank();return}
    cur.rec[recKey()]=rec;cur.streak=streak();
    LB.db.doc("lb/"+LB.uid).set(cur).then(function(){LB.me=cur;drawRank();drawStats()}).catch(function(){$("rkNote").textContent="순위에 올리지 못했어요. 이 기록은 이 기기에만 남아요.";drawRank()});
  }
  $("nickForm").onsubmit=function(e){e.preventDefault();var v=$("nickIn").value.trim();if(!v)return;LS.set("ai_pz_nick",v);$("nickCard").hidden=true;submit()};
  function lbRows(){
    var k=recKey(),l=LB.docs.filter(function(d){return d.rec&&d.rec[k]}).map(function(d){return{id:d._id,nick:d.nick||"익명",sector:d.sector||"",t:d.rec[k].t}});
    if(!LB.db||!LB.uid){var mine=(LS.get("ai_pz_best")||{})[k];if(mine)l.push({id:"me",nick:nick()||"나",sector:"이 기기",t:mine.t})}
    return l.sort(function(a,b){return a.t-b.t});
  }
  function drawRank(){
    var l=lbRows(),k=recKey(),myId=LB.uid||"me";
    $("rkN").textContent=l.length+"명 완료";
    $("pzRank").innerHTML=l.length?l.slice(0,10).map(function(x,i){return '<li'+(x.id===myId?' class="me"':'')+'><span class="r">'+String(i+1).padStart(2,"0")+'</span><span class="n">'+esc(x.nick)+(x.sector?'<small>'+esc(x.sector)+'</small>':'')+'</span><span class="t">'+fmtT(x.t)+'</span></li>'}).join("")+(function(){var mi=l.findIndex(function(x){return x.id===myId});return mi>=10?'<li class="me"><span class="r">'+String(mi+1).padStart(2,"0")+'</span><span class="n">'+esc(l[mi].nick)+'</span><span class="t">'+fmtT(l[mi].t)+'</span></li>':""})()
      :'<li class="empty">아직 오늘 '+LVN[pz.lv]+' 문제를 푼 사람이 없어요. 첫 기록을 남겨 보세요.</li>';
    if(!LB.db||!LB.uid)$("rkNote").textContent="지금은 이 기기 기록만 보여요. 로그인한 상태로 열면 다른 실무자와 순위를 겨뤄요.";
    if(typeof GAME==="undefined"||GAME==="s")$("stTop").textContent=l.length?fmtT(l[0].t):"--:--";
    var dn=lbRows().length;$("nudgeTxt").textContent=(pz.done?"오늘 "+fmtT(pz.elapsed)+"에 풀었어요":"아직 안 풀었어요 · 보통 5~10분")+(dn?" · "+dn+"명 완료":"");
  }
  function drawStats(){
    if(typeof GAME!=="undefined"&&GAME!=="s")return;
    var mine=(LS.get("ai_pz_best")||{})[recKey()];
    $("stMine").textContent=pz.done?fmtT(pz.elapsed):(mine?fmtT(mine.t):"--:--");
    $("stStreak").textContent=streak()+"일";
  }
  function initLB(){
    if(!window.claude||!window.claude.use)return;
    Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){
      var db=r[0],u=r[1];if(!db||!u)return;return u.id().then(function(id){if(!id)return;LB.db=db;LB.uid=id;
        LB.unsub=db.collection("lb").onSnapshot(function(snap){LB.docs=snap.docs.map(function(d){var o=Object.assign({},d.data());o._id=d.id;return o});LB.me=LB.docs.find(function(d){return d._id===id})||LB.me;$("rkNote").textContent="순위는 오늘 자정(한국 시간)에 새로 시작해요.";drawRank();drawMsRank();msStats();if(typeof drawAcRank==="function"){drawAcRank();acStats()}
          if(pz.done){var k=recKey(),mine=(LS.get("ai_pz_best")||{})[k];if(mine&&!(LB.me&&LB.me.rec&&LB.me.rec[k])&&nick())submit()}},function(){});
      })}).catch(function(){});
  }
  /* 컨트롤 */
  padDraw();
  $("pzErase").onclick=function(){if(pz.sel>=0){delete pz.memos[pz.sel];input(0)}};
  $("pzMemo").onclick=function(){pz.memo=!pz.memo;this.setAttribute("aria-pressed",pz.memo);this.textContent=pz.memo?"메모 켬":"메모 끔"};
  $("pzCheck").onclick=function(){if(!pz.started||pz.done)return;var bad=0;pz.cur.forEach(function(v,i){var c=$("board").children[i];var w=v&&v!==PD().sol[i];c.classList.toggle("bad",!!w);if(w)bad++});pz.penalty++;pz.t0-=30000;pz.elapsed+=30000;save();$("pzMsg").textContent=bad?"틀린 칸 "+bad+"개를 표시했어요. 30초가 더해졌어요.":"지금까지 틀린 칸이 없어요. 30초가 더해졌어요."};
  $("pzMore").onclick=function(){pause();pz.practice=true;pz.pdata=PZ.make("practice-"+Date.now()+Math.random(),pz.lv);pz.cur=pz.pdata.puz.slice();pz.memos={};pz.elapsed=0;pz.penalty=0;pz.done=false;pz.started=true;pz.sel=-1;
    $("pzMore").hidden=true;$("pzCover").hidden=true;$("board").classList.remove("blur");[].forEach.call($("board").children,function(c){c.classList.remove("bad")});$("pzMsg").textContent="연습 판이에요. 새로 만든 문제라 순위에는 올라가지 않아요.";$("pzTime").textContent="00:00";drawBoard();run()};
  $("pzStart").onclick=function(){pz.started=true;$("pzCover").hidden=true;$("board").classList.remove("blur");run();save()};
  document.addEventListener("keydown",function(e){
    if($("p-puzzle").hidden||GAME!=="s"||!pz.started||pz.done||e.target.closest("input,select,textarea"))return;
    if(/^[1-9]$/.test(e.key)){input(+e.key);e.preventDefault();return}
    var ci=DISP==="aml"&&e.key.length===1?CODEI.indexOf(e.key.toUpperCase()):-1;if(ci>-1&&!e.ctrlKey&&!e.metaKey){input(ci+1);e.preventDefault();return}
    if(e.key==="Backspace"||e.key==="Delete"||e.key==="0"){$("pzErase").click();e.preventDefault();return}
    var mv={ArrowUp:-9,ArrowDown:9,ArrowLeft:-1,ArrowRight:1}[e.key];if(mv){pz.sel=pz.sel<0?40:Math.min(80,Math.max(0,pz.sel+mv));drawBoard();e.preventDefault()}
  });
  document.addEventListener("visibilitychange",function(){if(document.hidden)pzPause();else if(!$("p-puzzle").hidden)pzResume()});
  chips($("lvChips"),["보통","어려움"],"보통",function(t){pause();loadLevel(t==="보통"?"n":"h");if(pz.started&&!pz.done)run()});
  loadLevel("n");initLB();
  /* ---------- 게임 전환 ---------- */
  var GAME="s";
  function stressFrame(on){var f=$("stressFrame");if(!f)return;var want=on?"stress/?embed=1":"";if(on){if(!f.getAttribute("src"))f.setAttribute("src",want)}else if(f.getAttribute("src")){f.removeAttribute("src");try{f.contentWindow.location.replace("about:blank")}catch(e){}}}
  window.addEventListener("message",function(e){if(e.origin!==location.origin||!e.data||e.data.type!=="aml-stress-h")return;var h=+e.data.h;if(h>200&&h<6000)$("stressFrame").style.height=h+"px"});
  function pzResume(){if(GAME==="x")stressFrame(true);else if(GAME==="s")run();else if(GAME==="m")msRun()}
  function pzPause(){pause();msPause();if(typeof acPause==="function")acPause()}
  function setGame(g){pzPause();GAME=g;$("g-sudoku").hidden=g!=="s";$("g-mines").hidden=g!=="m";$("g-arcade").hidden="dckf".indexOf(g)<0;$("g-stress").hidden=g!=="x";$("pzHero").classList.toggle("solo",g==="x");$("pzEye").hidden=g==="x";$("gPre").hidden=g==="x";$("stEye").hidden=g!=="x";stressFrame(g==="x"&&!$("p-puzzle").hidden);
    $("gName").textContent={x:"스트레스 격파실",s:"스도쿠",m:"대포통장 찾기",d:"자금 피하기",c:"흐름 끊기",k:"결재 팡팡",f:"자금세탁 방어전"}[g];
    $("pzLede").textContent={x:"AML 용어가 지겹고 사람이 지칠 때, 한 판만 부수고 가세요. 용어 격파, 칸막이 두더지, 퇴근길 달리기, 금융범죄 저격 중에 골라요.",s:"매일 모두가 같은 문제를 풀어요. 오늘 안에 풀면 기록이 순위에 올라가고, 다 풀면 오늘의 AML 용어 하나를 알려 드려요.",m:"계좌 사이에 숨은 대포통장을 찾아 STR 표시를 하세요. 매일 모두가 같은 판을 풀고, 첫 판 기록만 순위에 올라가요.",d:"AML맨을 움직여 쏟아지는 대포통장과 환치기를 피하세요. 몇 판이든 할 수 있고, 오늘 최고 점수가 순위에 올라가요.",c:"날아오르는 거래 중 수상한 것만 그어서 팡팡 끊으세요. 정상 거래를 끊으면 감점이에요.",k:"거래 한 줄을 보고 순간 판단해요. 정상이면 화면 왼쪽, 의심되면 오른쪽을 누르면 팡 터지면서 바로 정답이 나와요. 연속으로 맞히면 피버.",f:"좌우로 움직이며 숫자 게이트를 골라 요원 부대를 키우고, 몰려오는 자금세탁 악당과 총책을 막아내세요. 오늘 최고 점수가 순위에 올라가요."}[g];
    var arc="dckf".indexOf(g)>-1;$("stL1").textContent=arc?"오늘 내 최고":"내 기록";$("stL2").textContent="오늘 1위";$("stL3").textContent=arc?"오늘 판 수":"연속 완료";
    if(g==="s"){drawStats();drawRank();$("pzLvLab").textContent=LVN[pz.lv]}else if(g==="m"){msStats();drawMsRank()}else if(g!=="x"){acSetup(g)}
    if(!$("p-puzzle").hidden)pzResume()}

  /* ---------- 오늘의 지뢰찾기 ---------- */
  var MSL={n:{c:9,r:9,m:10},h:{c:12,r:16,m:32}};
  var ms={lv:"n",B:null,st:null,tick:null,t0:0,flag:false,practice:false};
  function msGen(day,lv,salt){
    var cf=MSL[lv],N=cf.c*cf.r,seed=0,s="mines|"+day+"|"+lv+(salt||"");for(var i=0;i<s.length;i++)seed=Math.imul(seed^s.charCodeAt(i),2654435761);
    var r=(function(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})(seed);
    var sc=Math.floor(cf.c/2)+Math.floor(r()*3)-1,sr=Math.floor(cf.r/2)+Math.floor(r()*3)-1,start=sr*cf.c+sc,ban={};
    nb(start,cf).concat([start]).forEach(function(x){ban[x]=1});
    var mines={},k=0;while(k<cf.m){var x=Math.floor(r()*N);if(ban[x]||mines[x])continue;mines[x]=1;k++}
    var num=[];for(var i=0;i<N;i++)num[i]=mines[i]?-1:nb(i,cf).filter(function(y){return mines[y]}).length;
    return{cf:cf,N:N,mines:mines,num:num,start:start};
  }
  function nb(i,cf){var r=Math.floor(i/cf.c),c=i%cf.c,o=[];for(var dr=-1;dr<=1;dr++)for(var dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;var rr=r+dr,cc=c+dc;if(rr>=0&&rr<cf.r&&cc>=0&&cc<cf.c)o.push(rr*cf.c+cc)}return o}
  function mkey(){return "ai_ms_"+pz.day+"_"+ms.lv}
  function mrec(){return "ms-"+pz.day.replace(/-/g,"")+"-"+ms.lv}
  function msLoad(lv){
    msPause();ms.lv=lv;ms.practice=false;ms.B=msGen(pz.day,lv);
    var sv=LS.get(mkey());ms.st=sv||{s:"new",e:0,rev:{},fl:{}};
    $("msRkLv").textContent=LVN[lv];$("msPractice").hidden=!(ms.st.s==="lost"||ms.st.s==="won");
    msCover();msDraw();msStats();drawMsRank();
    $("msMsg").textContent=ms.st.s==="won"?"오늘 "+LVN[lv]+" 판을 "+fmtT(ms.st.e)+"에 풀었어요.":ms.st.s==="lost"?"대포통장을 열었어요. 오늘 순위 기록은 끝났고, 연습으로 다시 해 볼 수 있어요.":"";
  }
  function msCover(){$("msCover").hidden=ms.st.s!=="new";
    $("mfield").classList.toggle("blur",ms.st.s==="new");$("msCoverTxt").textContent="시작하면 정상 계좌 하나가 먼저 열려요";$("msTime").textContent=fmtT(ms.st.e)}
  function msSave(){if(!ms.practice)LS.set(mkey(),ms.st)}
  function msRun(){if(ms.st.s!=="play"||ms.tick)return;ms.t0=Date.now()-ms.st.e;ms.tick=setInterval(function(){ms.st.e=Date.now()-ms.t0;$("msTime").textContent=fmtT(ms.st.e)},500)}
  function msPause(){if(ms.tick){clearInterval(ms.tick);ms.tick=null;if(ms.st&&ms.st.s==="play"){ms.st.e=Date.now()-ms.t0;msSave()}}}
  function flood(i){var B=ms.B,st=ms.st,stack=[i];while(stack.length){var x=stack.pop();if(st.rev[x]||st.fl[x])continue;st.rev[x]=1;if(B.num[x]===0)nb(x,B.cf).forEach(function(y){if(!st.rev[y])stack.push(y)})}}
  function msOpen(i){
    var B=ms.B,st=ms.st;if(st.s!=="play"||st.fl[i])return;
    if(st.rev[i]){var f=nb(i,B.cf).filter(function(y){return st.fl[y]}).length;if(f===B.num[i]&&f>0)nb(i,B.cf).forEach(function(y){if(!st.rev[y]&&!st.fl[y])msOpen(y)});return}
    if(B.mines[i]){msPause();st.s="lost";st.boom=i;msSave();if(ms.practice){msDraw();$("msMsg").textContent="연습 판에서 대포통장을 열었어요. 한 판 더 해 보세요.";$("msPractice").hidden=false;return}msDraw();$("msMsg").textContent="대포통장을 열었어요. 오늘 순위 기록은 끝났고, 연습으로 다시 해 볼 수 있어요.";$("msPractice").hidden=false;return}
    flood(i);msCheck();
  }
  function msToggleFlag(i){var st=ms.st;if(st.s!=="play"||st.rev[i])return;if(st.fl[i])delete st.fl[i];else st.fl[i]=1;msSave();msDraw()}
  function msCheck(){var B=ms.B,st=ms.st,open=Object.keys(st.rev).length;
    if(open===B.N-B.cf.m){msPause();st.s="won";Object.keys(B.mines).forEach(function(m){st.fl[m]=1});msSave();
      if(!ms.practice){var h=LS.get("ai_ms_hist")||{};h[pz.day]=true;LS.set("ai_ms_hist",h);$("msMsg").textContent="대포통장 "+B.cf.m+"개를 모두 찾았어요. 기록 "+fmtT(st.e)+". 순위에 올렸어요.";msSubmit();showTerm("msTerm",1)}
      else $("msMsg").textContent="연습 판 완료 · "+fmtT(st.e)+". 연습 기록은 순위에 올라가지 않아요.";
      $("msPractice").hidden=false;
      msStats()}
    msSave();msDraw()}
  function msDraw(){
    var B=ms.B,st=ms.st,f=$("mfield");f.style.setProperty("--c",B.cf.c);
    if(f.children.length!==B.N){var h="";for(var i=0;i<B.N;i++)h+='<button type="button" class="mc" data-i="'+i+'" role="gridcell"></button>';f.innerHTML=h;
      [].forEach.call(f.children,function(c){var i=+c.getAttribute("data-i"),lp=null,lpFired=false;
        c.addEventListener("click",function(){if(lpFired){lpFired=false;return}if(ms.flag&&!ms.st.rev[i])msToggleFlag(i);else msOpen(i)});
        c.addEventListener("contextmenu",function(e){e.preventDefault();msToggleFlag(i)});
        c.addEventListener("touchstart",function(){lpFired=false;lp=setTimeout(function(){lpFired=true;msToggleFlag(i);if(navigator.vibrate)try{navigator.vibrate(15)}catch(e){}},420)},{passive:true});
        ["touchend","touchmove","touchcancel"].forEach(function(ev){c.addEventListener(ev,function(){clearTimeout(lp)},{passive:true})});
      })}
    var left=B.cf.m-Object.keys(st.fl).length;$("msLeft").textContent=left;
    for(var i=0;i<B.N;i++){var c=f.children[i],rv=!!st.rev[i],fl=!!st.fl[i],end=st.s==="lost"||st.s==="won";
      c.className="mc"+(rv?" o":"")+(fl?" f":"")+(rv&&B.num[i]>0?" n"+B.num[i]:"")+(end&&B.mines[i]&&!fl?" mine":"")+(st.boom===i?" boom":"")+(st.s==="lost"&&fl&&!B.mines[i]?" wrong":"");
      c.textContent=rv&&B.num[i]>0?B.num[i]:"";
      c.setAttribute("aria-label",(Math.floor(i/B.cf.c)+1)+"행 "+(i%B.cf.c+1)+"열 "+(fl?"STR 표시":rv?(B.num[i]||"빈 칸"):"닫힘"))}
  }
  function msRows(){
    var k=mrec(),l=LB.docs.filter(function(d){return d.rec&&d.rec[k]}).map(function(d){return{id:d._id,nick:d.nick||"익명",sector:d.sector||"",t:d.rec[k].t}});
    if(!LB.db||!LB.uid){var mine=(LS.get("ai_pz_best")||{})[k];if(mine)l.push({id:"me",nick:nick()||"나",sector:"이 기기",t:mine.t})}
    return l.sort(function(a,b){return a.t-b.t});
  }
  function drawMsRank(){
    var l=msRows(),myId=LB.uid||"me";$("msRkN").textContent=l.length+"명 완료";
    $("msRank").innerHTML=l.length?l.slice(0,10).map(function(x,i){return '<li'+(x.id===myId?' class="me"':'')+'><span class="r">'+String(i+1).padStart(2,"0")+'</span><span class="n">'+esc(x.nick)+(x.sector?'<small>'+esc(x.sector)+'</small>':'')+'</span><span class="t">'+fmtT(x.t)+'</span></li>'}).join("")
      :'<li class="empty">아직 오늘 '+LVN[ms.lv]+' 판을 푼 사람이 없어요. 첫 기록을 남겨 보세요.</li>';
    if(GAME==="m")$("stTop").textContent=l.length?fmtT(l[0].t):"--:--";
  }
  function msStats(){if(GAME!=="m")return;var mine=(LS.get("ai_pz_best")||{})[mrec()];
    $("pzLvLab").textContent=LVN[ms.lv];$("stMine").textContent=ms.st&&ms.st.s==="won"&&!ms.practice?fmtT(ms.st.e):(mine?fmtT(mine.t):"--:--");
    var h=LS.get("ai_ms_hist")||{},n=0,d=new Date(pz.day+"T00:00:00+09:00");for(;;){var k=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);if(h[k]){n++;d=new Date(d.getTime()-DAY)}else break}
    $("stStreak").textContent=n+"일";var l=msRows();$("stTop").textContent=l.length?fmtT(l[0].t):"--:--"}
  function msSubmit(){
    var k=mrec(),rec={t:ms.st.e,at:Date.now()},mine=LS.get("ai_pz_best")||{};mine[k]=rec;LS.set("ai_pz_best",mine);
    if(!LB.db||!LB.uid){drawMsRank();$("msRkNote").textContent="지금은 이 기기 기록만 보여요. 로그인한 상태로 열면 다른 실무자와 순위를 겨뤄요.";return}
    if(!nick()){$("msNickCard").hidden=false;$("msNickIn").focus();return}
    var cur=LB.me?JSON.parse(JSON.stringify(LB.me)):{rec:{}};cur.nick=nick();cur.sector=(PROFILE&&PROFILE.sector)||cur.sector||"";cur.rec=cur.rec||{};
    if(cur.rec[k]){drawMsRank();return}
    cur.rec[k]=rec;LB.db.doc("lb/"+LB.uid).set(cur).then(function(){LB.me=cur;drawMsRank();msStats()}).catch(function(){$("msRkNote").textContent="순위에 올리지 못했어요. 이 기록은 이 기기에만 남아요."});
  }
  $("msNickForm").onsubmit=function(e){e.preventDefault();var v=$("msNickIn").value.trim();if(!v)return;LS.set("ai_pz_nick",v);$("msNickCard").hidden=true;msSubmit()};
  $("msStart").onclick=function(){if(ms.st.s!=="new")return;ms.st.s="play";ms.st.e=0;flood(ms.B.start);$("msCover").hidden=true;$("mfield").classList.remove("blur");msSave();msDraw();msRun()};
  $("msFlag").onclick=function(){ms.flag=!ms.flag;this.setAttribute("aria-pressed",ms.flag);this.textContent=ms.flag?"STR 표시 켬":"STR 표시 끔"};
  $("msPractice").onclick=function(){msPause();$("msPractice").hidden=true;ms.practice=true;ms.B=msGen(pz.day,ms.lv,"|p"+Date.now());ms.st={s:"play",e:0,rev:{},fl:{}};flood(ms.B.start);$("msCover").hidden=true;$("mfield").classList.remove("blur");$("mfield").innerHTML="";$("msMsg").textContent="연습 판이에요. 새로 섞은 판이라 순위에는 올라가지 않아요.";msDraw();msRun()};
  chips($("msLv"),["보통","어려움"],"보통",function(t){msLoad(t==="보통"?"n":"h");$("mfield").innerHTML="";msDraw();if(ms.st.s==="play")msRun()});
  chips($("gameSw"),["스트레스 격파실","스도쿠","대포통장 찾기","자금 피하기","흐름 끊기","결재 팡팡","방어전"],"스트레스 격파실",function(t){setGame({"스트레스 격파실":"x","스도쿠":"s","대포통장 찾기":"m","자금 피하기":"d","흐름 끊기":"c","결재 팡팡":"k","방어전":"f"}[t])});
  function pickGame(g){var n={x:"스트레스 격파실",s:"스도쿠",m:"대포통장 찾기",d:"자금 피하기",c:"흐름 끊기",k:"결재 팡팡",f:"방어전"}[g];if(!n)return;[].forEach.call($("gameSw").children,function(b){b.setAttribute("aria-pressed",b.textContent===n)});setGame(g)}
  msLoad("n");
  /* ---------- 아케이드: 자금 피하기 · 흐름 끊기 · 결재 폭탄 · 자금세탁 방어전 ---------- */
  /* 키워드 풀: [용어, 쉬운 설명]. 오늘의 키워드 5개는 날짜로 자동으로 뽑혀서 매일 바뀌어요 */
  var POOL=[["대포통장","남의 명의로 만든 통장이 거래에 쓰여요"],["차명계좌","실제 주인과 명의자가 달라요"],["쪼개기 입금","보고 기준 아래로 나눠서 넣어요"],["현금 990만 원","고액현금 보고 기준 바로 아래예요"],["환치기","국내에서 받고 해외에서 정산해요"],["유령법인","영업은 없고 계좌만 쓰는 법인이에요"],["페이퍼컴퍼니","서류로만 있는 회사예요"],["가상계좌 재판매","받은 가상계좌를 남에게 넘겨 써요"],["상품권 깡","상품권을 사서 바로 현금으로 바꿔요"],["불법 도박 자금","도박 사이트 충전·환전 흐름이에요"],
    ["보이스피싱 피해금","피해자 돈이 여러 계좌로 흩어져요"],["인출책","입금 직후 ATM에서 현금을 빼요"],["수거책","피해자 현금을 직접 받아 옮겨요"],["통장 대여","돈을 받고 계좌를 빌려줘요"],["명의 도용","남의 신분으로 계좌를 만들어요"],["거래소 입금 집중","여러 명이 보낸 돈이 거래소로 몰려요"],["믹서 경유","코인 출처를 섞어서 숨겨요"],["해킹 피해금","해킹 사고 지갑과 이어져 있어요"],["휴면 계좌 재가동","오래 멈춘 계좌가 갑자기 큰돈을 움직여요"],["신규 계좌 집중","만들자마자 큰돈이 오가요"],
    ["즉시 전액 출금","들어오자마자 다 빠져나가요"],["다수인 입금","모르는 여러 명이 한 계좌로 보내요"],["분산 송금","한 계좌에서 여러 곳으로 흩어 보내요"],["고위험 국가 송금","위험 국가로 목적 없이 보내요"],["무역 대금 부풀리기","송장보다 훨씬 큰 돈이 오가요"],["허위 세금계산서","실제 거래 없이 증빙만 있어요"],["법인 자금 유용","법인 돈이 대표 개인 계좌로 가요"],["리베이트","거래 대가로 돈이 되돌아와요"],["뇌물 의심","공직자 관련 설명 안 되는 입금이에요"],["PEP 거래","정치적 주요인물 관련 큰돈이에요"],
    ["제재 명단 일치","이름이 제재 명단과 겹쳐요"],["제3국 우회 송금","다른 나라를 거쳐 돌아가요"],["현금 반복 입금","매일 같은 시간에 현금을 넣어요"],["ATM 연속 인출","여러 기기에서 한도까지 빼요"],["선불카드 대량 충전","충전하고 바로 현금으로 바꿔요"],["중고거래 사기","물건 없이 대금만 받아요"],["로맨스 스캠","해외 연인이라며 송금을 요구해요"],["투자 리딩방","고수익 미끼로 입금을 받아요"],["스캠 코인","실체 없는 코인에 투자금을 모아요"],["다단계 수당","하위 회원 돈이 위로 올라가요"],
    ["불법 대부","고금리 원리금이 오가요"],["마약 대금","코인과 소액으로 나눠 결제해요"],["밀수 대금","물건 없이 해외로 결제해요"],["카드깡","가짜 매출로 카드 한도를 현금화해요"],["PG 우회 결제","남의 가맹점으로 결제를 돌려요"],["가맹점 명의 대여","다른 업종이 이름을 빌려 결제해요"],["허위 가맹점","매장 없이 매출만 생겨요"],["결제 취소 반복","승인과 취소가 계속 되풀이돼요"],["바지사장","실제 주인 대신 이름만 빌린 대표예요"],["실소유자 불명","법인의 진짜 주인을 알 수 없어요"],
    ["지분 쪼개기","실소유자 기준 25% 아래로 나눠요"],["해외 법인 경유","조세회피처 법인을 거쳐 가요"],["부동산 현금 매입","큰 부동산을 현금으로 사요"],["명품 현금 구매","고가품을 현금으로 반복해서 사요"],["금괴 현금 거래","금괴·보석을 현금으로 사요"],["카지노 칩 환전","칩을 거의 안 쓰고 다시 바꿔요"],["보험 조기 해지","큰 보험료를 넣고 바로 해지해요"],["대출 조기 상환","출처 모를 돈으로 바로 갚아요"],["매매 없는 증권계좌","주식 거래 없이 돈만 오가요"],["통정매매","서로 짜고 주식을 사고팔아요"],
    ["주가조작 자금","여러 계좌로 같은 종목을 사요"],["미공개 정보 거래","공시 직전에 크게 사요"],["코인 펌핑","짜고 시세를 띄워요"],["해외 거래소 이동","받자마자 해외 거래소로 옮겨요"],["개인 지갑 출금","확인 안 되는 지갑으로 빼요"],["트래블룰 회피","100만 원 아래로 나눠 옮겨요"],["코인 장외거래","개인끼리 코인을 현금으로 바꿔요"],["테러자금 의심","소액이 위험 지역으로 반복해서 가요"],["기부금 유용","단체 기부금이 개인에게 가요"],["비영리단체 악용","단체 계좌로 출처 모를 돈이 들어와요"],
    ["외화 쪼개기 환전","큰 외화를 여러 번 나눠 바꿔요"],["해외 ATM 반복 인출","해외에서 계속 현금을 빼요"],["유학 송금 위장","학비라며 너무 많이 보내요"],["가족 증여 위장","가족 간 이체로 꾸며요"],["거래 목적 불명","물어봐도 설명이 안 돼요"],["직업 대비 과다","소득에 비해 거래가 너무 커요"],["같은 주소 여러 고객","여러 고객이 한 주소를 써요"],["같은 연락처 공유","여러 고객이 한 번호를 써요"],["같은 기기 개설","한 기기에서 계좌를 여러 개 만들어요"],["위조 신분증","신분증 진위 확인이 안 돼요"],
    ["고객확인 거부","정보를 물어도 답하지 않아요"],["급한 송금 요구","이유 없이 서둘러요"],["수수료 무시","손해를 봐도 빨리 옮겨요"],["딱 떨어지는 금액","똑같은 금액이 계속 반복돼요"],["심야 거래 집중","새벽에 거래가 몰려요"],["원격 앱 설치","피해자 폰에 원격 조종 앱이 있어요"],["통장 매매","통장을 돈 받고 팔아요"],["순환 거래","같은 돈이 여러 법인을 돌아요"],["재산 은닉","가족 계좌로 옮겨 숨겨요"],["횡령 자금","회사 돈이 개인 계좌로 가요"]];
  var TERMS=POOL.map(function(p){return p[0]}),TDESC={};POOL.forEach(function(p){TDESC[p[0]]=p[1]});
  var _tt={day:"",l:[]};
  function todayTerms(){if(_tt.day===pz.day)return _tt.l;var s="terms|"+pz.day,a=0;for(var i=0;i<s.length;i++)a=Math.imul(a^s.charCodeAt(i),2654435761);
    var rnd=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    var idx=TERMS.map(function(_,i){return i});for(var j=idx.length-1;j>0;j--){var k=Math.floor(rnd()*(j+1)),x=idx[j];idx[j]=idx[k];idx[k]=x}
    _tt={day:pz.day,l:idx.slice(0,5).map(function(i){return TERMS[i]})};return _tt.l}
  function randBad(){var t=todayTerms(),x;do{x=pick(TERMS)}while(t.indexOf(x)>-1);return x}
  var AC={g:"d",run:false,over:true,raf:0,W:360,H:420,dpr:1,last:0,items:[],parts:[],texts:[],trail:[],score:0,t:0,spawn:0,px:180,keys:{},flash:0,time:60,shield:0,shake:0};
  var OKS=["급여","관리비","카드대금","월세","보험료","통신요금","학원비","적금","공과금","경조사비","병원비","용돈"];
  var BOSS=["보이스피싱 총책","환치기 조직 총책","불법 도박 총책","리딩방 총책","대포통장 유통 총책","다단계 총책"];
  var cv=$("acCv"),cx=cv.getContext("2d");
  var ACG={
    d:{t:"자금 피하기",sub:"점수",cover:"AML맨을 움직여 떨어지는 세탁 자금을 피하세요",ratio:1.25,how:["화면을 누른 채 좌우로 움직이거나 키보드 ← → 로 AML맨을 달리게 해요.","빨간 테두리 거래에 닿으면 끝나요. 오래 버틸수록 점수가 올라요.","노란 <b>오늘의 키워드</b> 카드를 받으면 +30점, STR 동전은 +50점, 방패는 3초 무적이에요.","시간이 지날수록 더 빨리, 더 많이 떨어져요."]},
    c:{t:"흐름 끊기",sub:"남은 시간",cover:"AML맨과 함께 수상한 거래만 그어서 끊으세요",ratio:1.15,how:["화면을 그으면 AML맨이 달려가 칼을 휘둘러요. 빨간 테두리(수상한 거래)는 +10점, 노란 밑줄 <b>오늘의 키워드</b>는 +20점.","동그란 아이템도 그어서 써요. <b>+5초</b>, <b>STR</b>(화면의 수상한 거래 한 번에 끊기), <b>슬로</b>, <b>×2</b>. 빨간 <b>≫ 가속</b>은 점수가 2배지만 모든 게 빨라져요.","잘 끊을수록 속도 레벨이 올라가고, 놓치거나 정상 거래(회색)를 끊으면 내려가요. 실력에 맞춰 난이도가 저절로 바뀌어요.","정상 거래를 끊으면 -20점에 3초가 줄어요. 60초 동안 최대한 많이 끊으세요."]},
    k:{t:"결재 팡팡",sub:"처리",cover:"왼쪽은 승인, 오른쪽은 반려. 보자마자 눌러서 팡팡",ratio:1.2,how:["거래 한 줄을 보고 정상이면 화면 <b>왼쪽(승인)</b>, 의심되면 <b>오른쪽(반려)</b>을 눌러요. 키보드 ← → 도 돼요.","누르는 순간 팡 터지고 정답과 이유가 바로 떠요.","5연속이면 <b>피버</b>(점수 2배), 12연속이면 <b>슈퍼 피버</b>(3배). 빨리 누를수록 점수가 더 붙어요.","틀리거나 시간이 다 되면 검사 지적 1회, 3회면 끝나요. 갈수록 시간이 짧아져요."]},
    f:{t:"자금세탁 방어전",sub:"스테이지",cover:"숫자 게이트를 골라 요원을 불리고, 몰려오는 악당을 막으세요",ratio:1.4,how:["화면을 누른 채 좌우로 움직이거나 ← → 키로 요원 부대를 옮겨요. 총은 자동으로 쏴요.","내려오는 <b>숫자 게이트</b> 둘 중 하나만 지나가요. +와 ×는 요원이 늘고, −와 ÷는 줄어요. 마이너스 게이트도 쏘면 숫자가 올라가요.","악당 몸의 숫자는 체력이에요. 부딪히면 그 숫자만큼 요원을 잃어요. <b>STR 보고서</b> 상자를 부수거나 떨어지는 아이템(공속·확산·관통·방패·+5)에 닿으면 강해져요. 빨간 <b>≫ 가속</b>은 점수가 2배지만 5초 동안 모든 게 빨라져서 부딪히기 쉬워요.","요원이 많아지면 적이 강해지고, 줄어들면 약해져서 실력에 맞게 버틸 수 있어요. 게이지가 차면 총책이 나와요. 급하면 <b>지급정지</b>(PC는 스페이스바)로 악당을 잠깐 멈춰요.","노란 밑줄 악당은 <b>오늘의 키워드</b>예요. 처치하면 +20점."]}
  };
  function acRec(){return ({d:"dg-",c:"cf-",k:"kb-",f:"df-"})[AC.g]+pz.day.replace(/-/g,"")}
  function acSize(){var w=Math.min($("acWrap").clientWidth-40,AC.g==="f"?440:520);if(w<200)w=$("acWrap").clientWidth-20;AC.W=Math.max(240,w);AC.H=Math.round(AC.W*ACG[AC.g].ratio);AC.dpr=Math.min(2,window.devicePixelRatio||1);
    cv.width=AC.W*AC.dpr;cv.height=AC.H*AC.dpr;cv.style.width=AC.W+"px";cv.style.height=AC.H+"px";cx.setTransform(AC.dpr,0,0,AC.dpr,0,0);if(AC.over&&!AC.run)acDrawIdle()}
  function rr(x,y,w,h,r){cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
  var FONT='"Paperlogy","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  function pill(it){cx.save();cx.translate(it.x,it.y);if(it.rot)cx.rotate(it.rot);cx.font="600 "+it.fs+"px "+FONT;
    var w=it.w,h=it.h;rr(-w/2,-h/2,w,h,h/2);
    if(it.kind==="bad"||it.kind==="badk"){cx.fillStyle="#FFFFFF";cx.fill();cx.lineWidth=2.5;cx.strokeStyle="#C9381E";cx.stroke();if(it.kind==="badk"&&it.label){var tw=cx.measureText(it.label).width;cx.fillStyle="#FFE14A";cx.fillRect(-tw/2,2,tw,it.fs*0.45)}cx.fillStyle="#C9381E"}
    else if(it.kind==="ok"){cx.fillStyle="#EEEFF1";cx.fill();cx.lineWidth=1.5;cx.strokeStyle="#C4C6CC";cx.stroke();cx.fillStyle="#6B6E76"}
    else if(it.kind==="key"){cx.fillStyle="#FFE14A";cx.fill();cx.lineWidth=2;cx.strokeStyle="#0F1012";cx.stroke();cx.fillStyle="#0F1012"}
    else if(it.kind==="pw"){cx.beginPath();cx.arc(0,0,17,0,7);cx.fillStyle=it.trap?"#FFF4F1":"#FFFFFF";cx.fill();cx.lineWidth=2.5;cx.strokeStyle=it.trap?"#C9381E":"#0F1012";cx.stroke();cx.beginPath();cx.arc(0,0,21,0,7);cx.lineWidth=1;cx.strokeStyle=it.trap?"rgba(201,56,30,.35)":"rgba(15,16,18,.2)";cx.stroke();
      cx.font="600 10px "+FONT;cx.textAlign="center";cx.textBaseline="top";cx.fillStyle=it.trap?"#C9381E":"#43454B";cx.fillText(it.cap||"",0,24);cx.font="800 "+(it.label.length>2?11:14)+"px "+FONT;cx.fillStyle=it.trap?"#C9381E":"#0F1012"}
    else if(it.kind==="coin"){cx.beginPath();cx.arc(0,0,h/2,0,7);cx.fillStyle="#FFE14A";cx.fill();cx.lineWidth=2;cx.strokeStyle="#0F1012";cx.stroke();cx.fillStyle="#0F1012"}
    else if(it.kind==="shield"){cx.beginPath();cx.moveTo(0,-h/2);cx.lineTo(h/2.2,-h/4);cx.lineTo(h/2.6,h/6);cx.lineTo(0,h/2);cx.lineTo(-h/2.6,h/6);cx.lineTo(-h/2.2,-h/4);cx.closePath();cx.fillStyle="#0F1012";cx.fill();cx.fillStyle="#FFE14A"}
    cx.textAlign="center";cx.textBaseline="middle";cx.fillText(it.label,0,1);cx.restore()}
  function mkItem(kind,label,fs){cx.font="600 "+fs+"px "+FONT;var tw=cx.measureText(label).width;var round=kind==="coin"||kind==="shield";var h=round?fs*2.4:fs*2.1;return{kind:kind,label:label,fs:fs,w:round?h:tw+fs*1.6,h:h,x:0,y:0,vx:0,vy:0,rot:0,vr:0}}
  function burst(x,y,n,colors,sp){for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,v=(sp||220)*(0.4+Math.random());AC.parts.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:0.5+Math.random()*0.4,max:0.9,c:colors[i%colors.length],s:2+Math.random()*4})}}
  function popText(x,y,txt,c,sz){AC.texts.push({x:x,y:y,t:txt,c:c||"#0F1012",life:0.9,sz:sz||18})}
  function acBg(){cx.fillStyle="#FFFFFF";cx.fillRect(0,0,AC.W,AC.H);cx.strokeStyle="#F0F0EC";cx.lineWidth=1;for(var x=0;x<AC.W;x+=24){cx.beginPath();cx.moveTo(x+.5,0);cx.lineTo(x+.5,AC.H);cx.stroke()}for(var y=0;y<AC.H;y+=24){cx.beginPath();cx.moveTo(0,y+.5);cx.lineTo(AC.W,y+.5);cx.stroke()}}
  function pick(a){return a[Math.floor(Math.random()*a.length)]}
  function wrapLines(txt,maxW){var words=txt.split(" "),lines=[],cur="";words.forEach(function(w){var t=cur?cur+" "+w:w;if(cx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t});if(cur)lines.push(cur);return lines}
  function acDrawIdle(){
    if(AC.g==="k"){acBg();AC.lives=3;AC.done=0;AC.right=0;AC.combo=0;AC.fb=null;AC.stamp=null;AC.doc=genDoc();AC.fuseMax=6;AC.fuse=4.2;drawKyul();return}
    if(AC.g==="f"){fdInit(true);AC.n=AC.nShow=12;var tt=todayTerms();[[6,0.22,0.3,tt[0]],[14,0.68,0.24,randBad()],[4,0.45,0.4,randBad()]].forEach(function(d){var e=fdEnemy(d[0]);e.x=AC.W*d[1];e.y=AC.H*d[2];e.label=d[3];e.key=d[3]===tt[0];AC.en.push(e)});var g1=fdGate(["num","요원 채용"],0,1),g2=fdGate(["div","감사 지적"],1,1);[g1,g2].forEach(function(g){g.y=AC.H*0.58;g.h=48*fdK();g.pid=1;AC.gates.push(g)});drawDef();return}
    acBg();var tt2=todayTerms(),demo=AC.g==="d"?[["bad","대포통장",0.25,0.25],["key",tt2[0],0.7,0.4],["coin","STR",0.45,0.55]]:[["badk",tt2[0],0.3,0.45],["ok","급여",0.65,0.35],["bad","유령법인",0.6,0.65]];
    demo.forEach(function(d){var it=mkItem(d[0],d[1],14);it.x=AC.W*d[2];it.y=AC.H*d[3];pill(it)});AC.deadPose=false;AC.vx=0;AC.face=1;if(AC.g==="d"){AC.px=AC.W/2;acPlayer()}else{var pw=mkItem("pw","STR",13);pw.cap="일괄 보고";pw.w=pw.h=34;pw.x=AC.W*0.22;pw.y=AC.H*0.24;pill(pw);amlMan(AC.W/2,AC.H-4,1,{slash:0.5,face:1})}}
  function acStart(){acSize();AC.items=[];AC.parts=[];AC.texts=[];AC.trail=[];AC.score=0;AC.t=0;AC.spawn=0;AC.shield=0;AC.px=AC.W/2;AC.time=60;AC.flash=0;AC.shake=0;AC.over=false;AC.run=true;AC.cuts=0;AC.coins=0;AC.keyN=0;AC.deadPose=false;AC.tx=null;AC.vx=0;AC.face=1;AC.runPh=0;AC.adapt=1;AC.mx=AC.mtx=AC.W/2;AC.slowT=AC.x2T=AC.fastT=AC.slashT=0;
    if(AC.g==="k"){AC.lives=3;AC.done=0;AC.right=0;AC.combo=0;AC.maxCombo=0;AC.miss=[];AC.fb=null;AC.endT=0;AC.rings=[];kbNext()}
    if(AC.g==="f"){fdInit(false)}
    $("acCover").hidden=true;$("acMsg").textContent="";$("acBtns").hidden=true;$("acSkillBar").hidden=AC.g!=="f";AC.last=performance.now();cancelAnimationFrame(AC.raf);AC.raf=requestAnimationFrame(acLoop)}
  function acEnd(reason){AC.run=false;AC.over=true;var sc=Math.round(AC.score);
    var best=LS.get("ai_ac_best")||{},k=acRec(),prev=best[k]?best[k].t:0,newBest=sc>prev;if(newBest){best[k]={t:sc,at:Date.now()};LS.set("ai_ac_best",best)}
    var pl=LS.get("ai_ac_plays")||{};pl[k]=(pl[k]||0)+1;LS.set("ai_ac_plays",pl);
    $("acCoverTxt").textContent=reason+" · "+fmtN(sc)+"점"+(newBest?" · 오늘 최고 기록":"");$("acStart").textContent="한 판 더";$("acCover").hidden=false;$("acBtns").hidden=true;$("acSkillBar").hidden=true;
    $("acMsg").textContent=AC.g==="d"?(AC.keyN?"오늘의 키워드 "+AC.keyN+"개, ":"")+(AC.coins?"STR 동전 "+AC.coins+"개를 받았어요. ":"")+"버틴 시간 "+AC.t.toFixed(1)+"초"
      :AC.g==="c"?"수상한 거래 "+AC.cuts+"건을 끊었어요"+(AC.keyN?" · 오늘의 키워드 "+AC.keyN+"건":"")+"."
      :AC.g==="f"?"스테이지 "+AC.stage+"까지 버텼어요 · 악당 "+AC.kills+"명 처치"+(AC.keyN?" · 오늘의 키워드 "+AC.keyN+"명":"")+" · 최대 요원 "+(AC.maxN||0)+"명."
      :"결재 "+AC.done+"건 · 최고 콤보 "+(AC.maxCombo||0)+" · 정답률 "+(AC.done?Math.round(100*AC.right/AC.done):0)+"%"+(AC.miss&&AC.miss.length?" · 놓친 유형: "+AC.miss.slice(-3).join(", "):"")+".";
    if(newBest)acSubmit(sc);acStats();drawAcRank()}
  function acLoop(ts){if(!AC.run)return;var dt=Math.min(0.033,(ts-AC.last)/1000);AC.last=ts;AC.t+=dt;
    if(AC.g==="d")stepDodge(dt);else if(AC.g==="c")stepCut(dt);else if(AC.g==="k")stepKyul(dt);else if(AC.g==="f")stepDef(dt);
    AC.parts.forEach(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=600*dt;p.life-=dt});AC.parts=AC.parts.filter(function(p){return p.life>0});
    AC.texts.forEach(function(t){t.y-=40*dt;t.life-=dt});AC.texts=AC.texts.filter(function(t){return t.life>0});
    acFrame(ts);
    $("acScore").textContent=AC.g==="d"?fmtN(Math.round(AC.score)):AC.g==="c"?Math.max(0,Math.ceil(AC.time))+"초 · "+fmtN(Math.round(AC.score))+"점":AC.g==="k"?AC.done+"건 · "+fmtN(Math.round(AC.score))+"점":AC.stage+" · 요원 "+fmtN(AC.n)+" · "+fmtN(Math.round(AC.score))+"점";
    if(AC.run)AC.raf=requestAnimationFrame(acLoop)}
  function acFrame(ts){
    cx.save();if(AC.shake>0){cx.translate((Math.random()-.5)*10*AC.shake,(Math.random()-.5)*10*AC.shake);AC.shake=Math.max(0,AC.shake-0.033*5)}
    if(AC.g!=="f")acBg();else drawDef();
    if(AC.flash>0){cx.fillStyle="rgba(201,56,30,"+(AC.flash*0.22)+")";cx.fillRect(0,0,AC.W,AC.H);AC.flash-=0.033*2}
    if(AC.g==="k")drawKyul();else if(AC.g==="f"){}else{AC.items.forEach(pill);if(AC.g==="d")acPlayer();if(AC.g==="c")drawCutHud()}
    if(AC.g==="c"&&AC.trail.length>1){cx.lineCap="round";cx.lineJoin="round";for(var i=1;i<AC.trail.length;i++){var a=AC.trail[i-1],b=AC.trail[i],age=(ts-b.t)/140;if(age>1)continue;cx.strokeStyle="rgba(15,16,18,"+(1-age)*0.85+")";cx.lineWidth=(1-age)*7+1;cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.stroke()}AC.trail=AC.trail.filter(function(p){return ts-p.t<160})}
    AC.parts.forEach(function(p){cx.globalAlpha=Math.max(0,p.life/p.max);cx.fillStyle=p.c;cx.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s)});cx.globalAlpha=1;
    AC.texts.forEach(function(t){cx.globalAlpha=Math.max(0,Math.min(1,t.life*1.5));cx.fillStyle=t.c;cx.font="800 "+t.sz+"px "+FONT;cx.textAlign="center";cx.textBaseline="alphabetic";cx.fillText(t.t,t.x,t.y)});cx.globalAlpha=1;
    cx.restore()}
  /* 자금 피하기 */
  function stepDodge(dt){
    var sp=AC.W*1.1,lx=AC.px;if(AC.keys.ArrowLeft){AC.px-=sp*dt;AC.tx=AC.px}if(AC.keys.ArrowRight){AC.px+=sp*dt;AC.tx=AC.px}
    if(AC.tx!=null){var dd=AC.tx-AC.px,mx=AC.W*1.7*dt;AC.px+=Math.max(-mx,Math.min(mx,dd))}AC.px=Math.max(16,Math.min(AC.W-16,AC.px));
    AC.vx=(AC.px-lx)/Math.max(dt,0.001);if(Math.abs(AC.vx)>8)AC.face=AC.vx>0?1:-1;AC.runPh=(AC.runPh||0)+dt*16*Math.min(1,Math.abs(AC.vx)/180);
    AC.score+=dt*10;AC.shield=Math.max(0,AC.shield-dt);
    var lvl=1+AC.t/14;AC.spawn-=dt;
    if(AC.spawn<=0){AC.spawn=Math.max(0.18,0.75/lvl);var r=Math.random(),it;
      if(r<0.06)it=mkItem("coin","STR",12);else if(r<0.08)it=mkItem("shield","",14);else if(r<0.16)it=mkItem("key",pick(todayTerms()),13);else it=mkItem("bad",randBad(),13+Math.floor(Math.random()*3));
      it.x=it.w/2+Math.random()*(AC.W-it.w);it.y=-it.h;it.vy=AC.H*(0.32+Math.random()*0.25)*Math.min(2.6,lvl)*(it.kind==="key"?0.8:1);it.vr=(Math.random()-.5)*0.6;AC.items.push(it)}
    var py=AC.H-30,hit=null;
    AC.items.forEach(function(it){it.y+=it.vy*dt;it.rot+=it.vr*dt*0.3;
      if(Math.abs(it.y-py)<it.h/2+20&&Math.abs(it.x-AC.px)<it.w/2+11){
        if(it.kind==="coin"){it.dead=1;AC.score+=50;AC.coins++;burst(it.x,it.y,18,["#FFE14A","#0F1012"]);popText(it.x,it.y-10,"+50")}
        else if(it.kind==="key"){it.dead=1;AC.score+=30;AC.keyN++;burst(it.x,it.y,22,["#FFE14A","#0F1012"]);popText(it.x,it.y-10,it.label+" +30")}
        else if(it.kind==="shield"){it.dead=1;AC.shield=3;burst(it.x,it.y,14,["#0F1012","#FFE14A"]);popText(it.x,it.y-10,"방패 3초")}
        else if(AC.shield>0){it.dead=1;burst(it.x,it.y,20,["#C9381E","#0F1012"]);AC.score+=15;popText(it.x,it.y-10,"막았다 +15","#C9381E")}
        else hit=it}
      if(it.y>AC.H+it.h){it.dead=1;if(it.kind==="bad")burst(it.x,AC.H-2,5,["#D6D6D1"],90)}});
    AC.items=AC.items.filter(function(it){return !it.dead});
    if(hit){AC.deadPose=true;burst(AC.px,py,46,["#C9381E","#0F1012","#FFE14A"],320);AC.flash=1;try{navigator.vibrate&&navigator.vibrate(60)}catch(e){};
      AC.run=false;var t0=performance.now();(function fx(ts){var d=Math.min(0.033,(ts-t0)/1000);t0=ts;AC.parts.forEach(function(p){p.x+=p.vx*d;p.y+=p.vy*d;p.vy+=600*d;p.life-=d});AC.parts=AC.parts.filter(function(p){return p.life>0});acBg();AC.items.forEach(pill);acPlayer();AC.parts.forEach(function(p){cx.globalAlpha=Math.max(0,p.life/p.max);cx.fillStyle=p.c;cx.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s)});cx.globalAlpha=1;if(AC.parts.length)requestAnimationFrame(fx)})(t0);
      acEnd(hit.label+"에 닿았어요")}
  }
  /* AML맨: 졸라맨식 캐릭터 */
  function amlMan(x,y,s,o){o=o||{};cx.save();cx.translate(x,y);if(o.dead)cx.rotate(1.35);cx.scale(s,s);
    var ph=o.ph||0,mv=o.mv||0,f=o.face||1,sw=Math.sin(ph)*0.8*mv;cx.lineCap="round";cx.lineJoin="round";cx.strokeStyle="#0F1012";cx.lineWidth=3.2;
    cx.beginPath();cx.moveTo(0,-14);cx.lineTo(-5+Math.sin(sw)*11,0);cx.moveTo(0,-14);cx.lineTo(5+Math.sin(-sw)*11,0);cx.stroke();
    cx.beginPath();cx.moveTo(0,-14);cx.lineTo(0,-31);cx.stroke();
    if(o.slash>0){var a=-1.9+(1-o.slash)*2.6,hx=f*Math.cos(a)*11,hy=-28+Math.sin(a)*11;
      cx.beginPath();cx.moveTo(0,-28);cx.lineTo(hx,hy);cx.moveTo(0,-28);cx.lineTo(-f*7,-19);cx.stroke();
      cx.lineWidth=2.6;cx.beginPath();cx.moveTo(hx,hy);cx.lineTo(hx+f*Math.cos(a)*22,hy+Math.sin(a)*22);cx.stroke();
      cx.fillStyle="#FFE14A";cx.beginPath();cx.arc(hx+f*Math.cos(a)*22,hy+Math.sin(a)*22,2.6,0,7);cx.fill();cx.lineWidth=3.2}
    else{cx.beginPath();cx.moveTo(0,-28);cx.lineTo(-8+Math.sin(-sw)*6,-17);cx.moveTo(0,-28);cx.lineTo(8+Math.sin(sw)*6,-17);cx.stroke()}
    cx.fillStyle="#FFE14A";cx.beginPath();cx.moveTo(-2.6,-30.5);cx.lineTo(2.6,-30.5);cx.lineTo(0,-22);cx.closePath();cx.fill();
    cx.beginPath();cx.arc(0,-39.5,7.5,0,7);cx.fillStyle="#FFFFFF";cx.fill();cx.lineWidth=3;cx.stroke();
    cx.fillStyle="#FFE14A";cx.fillRect(-6.5,-44,13,3);
    cx.fillStyle="#0F1012";cx.beginPath();cx.arc(f*3,-38.5,1.5,0,7);cx.fill();
    cx.restore()}
  function acPlayer(){var x=AC.px,y=AC.H-6;if(AC.shield>0){cx.beginPath();cx.arc(x,y-28,36,0,7);cx.strokeStyle="rgba(15,16,18,"+(0.25+0.25*Math.sin(AC.t*20))+")";cx.lineWidth=3;cx.stroke()}
    amlMan(x,y,1.25,{ph:AC.runPh||0,mv:Math.min(1,Math.abs(AC.vx||0)/180),face:AC.face||1,dead:AC.deadPose})}
  /* 흐름 끊기: 아이템 + 실력 맞춤 속도 */
  var CUTPW=[["time","+5초","시간 +5초",1.2,0],["bomb","STR","일괄 보고",1,0],["slow","슬로","3초 느리게",1,0],["x2","×2","6초 점수 2배",1,0],["fast","≫","가속 · 점수 2배",1.3,1]];
  function cutPw(){var tot=0;CUTPW.forEach(function(p){tot+=p[3]});var r=Math.random()*tot;for(var i=0;i<CUTPW.length;i++){r-=CUTPW[i][3];if(r<=0)return CUTPW[i]}return CUTPW[0]}
  function cutMul(){return (AC.x2T>0||AC.fastT>0)?2:1}
  function adaptBy(d){var before=Math.round(AC.adapt*5);AC.adapt=Math.max(0.6,Math.min(2.4,AC.adapt+d));var after=Math.round(AC.adapt*5);if(after!==before&&AC.t>2){popText(AC.W/2,70,after>before?"속도 UP · Lv."+after:"속도 DOWN · Lv."+after,after>before?"#C9381E":"#6B6E76",15)}}
  function stepCut(dt){
    AC.time-=dt;if(AC.time<=0){AC.time=0;acEnd("시간 끝");return}
    AC.slowT=Math.max(0,(AC.slowT||0)-dt);AC.x2T=Math.max(0,(AC.x2T||0)-dt);AC.fastT=Math.max(0,(AC.fastT||0)-dt);AC.slashT=Math.max(0,(AC.slashT||0)-dt);
    var ts=(AC.slowT>0?0.45:1)*(AC.fastT>0?1.6:1),gdt=dt*ts;
    AC.mx+=(AC.mtx-AC.mx)*Math.min(1,dt*9);AC.runPh=(AC.runPh||0)+dt*16*Math.min(1,Math.abs(AC.mtx-AC.mx)/40);if(Math.abs(AC.mtx-AC.mx)>3)AC.face=AC.mtx>AC.mx?1:-1;
    var lvl=(1+AC.t/30)*AC.adapt;AC.spawn-=gdt;
    if(AC.spawn<=0){AC.spawn=Math.max(0.35,1.05/lvl);var n=1+(Math.random()<0.3*lvl?1:0)+(Math.random()<0.12*lvl?1:0)+(Math.random()<0.05*lvl?1:0);
      for(var k=0;k<n;k++){var r=Math.random(),it;
        if(r<0.1){var p=cutPw();it=mkItem("pw",p[1],13);it.pw=p[0];it.cap=p[2];it.trap=!!p[4];it.w=it.h=34}
        else it=r<0.28?mkItem("badk",pick(todayTerms()),14):r<0.7?mkItem("bad",randBad(),14):mkItem("ok",pick(OKS),14);
        var g=AC.H*1.7,peak=AC.H*(0.45+Math.random()*0.35);it.x=Math.max(it.w/2+4,Math.min(AC.W-it.w/2-4,AC.W*(0.18+Math.random()*0.64)));it.y=AC.H+it.h;it.vy=-Math.sqrt(2*g*peak);it.vx=(AC.W/2-it.x)*(0.25+Math.random()*0.5);it.vr=it.kind==="pw"?0:(Math.random()-.5)*2.4;it.g=g;AC.items.push(it)}}
    AC.items.forEach(function(it){it.x+=it.vx*gdt;it.y+=it.vy*gdt;it.vy+=(it.g||AC.H*1.7)*gdt;it.rot+=it.vr*gdt;if(it.half){it.life-=dt;if(it.life<=0)it.dead=1}
      if(it.y>AC.H+it.h*2&&it.vy>0){it.dead=1;if(!it.half&&(it.kind==="bad"||it.kind==="badk"))adaptBy(-0.05)}});
    AC.items=AC.items.filter(function(it){return !it.dead});
  }
  function segHit(a,b,it){var r=Math.max(it.w,it.h)*0.42,dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((it.x-a.x)*dx+(it.y-a.y)*dy)/l2)),px=a.x+t*dx-it.x,py=a.y+t*dy-it.y;return px*px+py*py<r*r}
  function cutBad(it,ang){var base=it.kind==="badk"?20:10;if(it.kind==="badk")AC.keyN++;AC.cuts++;AC.swipeCuts=(AC.swipeCuts||0)+1;var bonus=AC.swipeCuts>1?(AC.swipeCuts-1)*5:0,pts=(base+bonus)*cutMul();AC.score+=pts;AC.shake=Math.min(1,AC.shake+0.35);adaptBy(0.012);
    burst(it.x,it.y,26,it.kind==="badk"?["#FFE14A","#C9381E","#0F1012"]:["#C9381E","#FFE14A","#0F1012"],300);popText(it.x,it.y-14,AC.swipeCuts>1?"콤보 x"+AC.swipeCuts+" +"+pts:(it.kind==="badk"?"오늘의 키워드 +"+pts:"+"+pts),"#C9381E");
    [1,-1].forEach(function(s){AC.items.push({kind:"bad",label:"",fs:it.fs,w:it.w/2,h:it.h,x:it.x+Math.cos(ang)*s*10,y:it.y,vx:it.vx+Math.cos(ang)*s*120,vy:Math.min(it.vy,0)-80,rot:it.rot,vr:s*4,g:it.g,half:1,life:0.6})});it.dead=1}
  function cutAt(a,b){var ang=Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2,any=false;
    AC.items.forEach(function(it){if(it.half||it.dead||!segHit(a,b,it))return;any=true;
      if(it.kind==="bad"||it.kind==="badk"){cutBad(it,ang);try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}}
      else if(it.kind==="pw"){it.dead=1;burst(it.x,it.y,30,it.trap?["#C9381E","#FFE14A"]:["#0F1012","#FFE14A"],320);
        if(it.pw==="time"){AC.time+=5;popText(it.x,it.y-14,"+5초")}
        else if(it.pw==="slow"){AC.slowT=3;popText(it.x,it.y-14,"슬로 3초")}
        else if(it.pw==="x2"){AC.x2T=6;popText(it.x,it.y-14,"6초 점수 2배")}
        else if(it.pw==="fast"){AC.fastT=5;AC.flash=0.5;AC.shake=0.8;popText(it.x,it.y-14,"가속! 점수 2배","#C9381E")}
        else if(it.pw==="bomb"){var n=0;AC.items.forEach(function(o){if(!o.dead&&!o.half&&(o.kind==="bad"||o.kind==="badk")){n++;cutBad(o,ang)}});AC.shake=1;popText(it.x,it.y-14,"STR 일괄 보고 "+n+"건","#C9381E",20)}}
      else{AC.score=Math.max(0,AC.score-20);AC.time=Math.max(0,AC.time-3);AC.flash=1;adaptBy(-0.05);burst(it.x,it.y,14,["#9A9CA2"],200);popText(it.x,it.y-14,"정상 거래! -20 · -3초","#43454B");it.dead=1;try{navigator.vibrate&&navigator.vibrate([30,40,30])}catch(e){}}});
    if(any){AC.slashT=0.22;AC.face=b.x>=AC.mx?1:-1}
  }
  function drawCutHud(){cx.font="600 12px "+FONT;cx.textBaseline="alphabetic";cx.textAlign="left";cx.fillStyle="#8A8C92";cx.fillText("속도 Lv."+Math.round(AC.adapt*5),12,22);
    var t=[];if(AC.slowT>0)t.push(["슬로 "+AC.slowT.toFixed(1),"#2C4FD1"]);if(AC.x2T>0)t.push(["점수 2배 "+AC.x2T.toFixed(1),"#0F1012"]);if(AC.fastT>0)t.push(["가속 "+AC.fastT.toFixed(1)+" · 점수 2배","#C9381E"]);
    cx.textAlign="right";t.forEach(function(x,i){cx.fillStyle=x[1];cx.fillText(x[0],AC.W-12,22+i*16)});
    if(AC.fastT>0){cx.strokeStyle="rgba(201,56,30,0.16)";cx.lineWidth=2;for(var i=0;i<8;i++){var sx=(i*89+AC.t*400)%AC.W;cx.beginPath();cx.moveTo(sx,(i*131+AC.t*700)%AC.H);cx.lineTo(sx,(i*131+AC.t*700)%AC.H+36);cx.stroke()}}
    if(AC.slowT>0){cx.fillStyle="rgba(44,79,209,0.04)";cx.fillRect(0,0,AC.W,AC.H)}
    amlMan(AC.mx,AC.H-4,1,{ph:AC.runPh||0,mv:Math.min(1,Math.abs(AC.mtx-AC.mx)/30),face:AC.face||1,slash:AC.slashT/0.22})}
  /* 결재 팡팡: 화면 왼쪽(승인)·오른쪽(반려)을 눌러 순간 판단, 맞히면 팡팡 */
  var QB=[["대학생 계좌에 12명이 400만 원씩","당일 거래소로 전액 이체","소득에 비해 큰돈이 모여 바로 빠져요"],["현금 990만 원, 3일 연속","천만 원은 한 번도 안 넘김","보고 기준 아래로 쪼개 넣어요"],["74세 신규 계좌로 1,900만 원","20분 뒤 ATM 세 곳에서 인출","보이스피싱 인출책 패턴이에요"],["무역 송금 5만 달러","송장 금액은 1만 2천 달러","송장보다 큰 돈, 무역 대금 부풀리기예요"],["직원 0명 법인, 입출금만 반복","대표가 법인 8곳 대표 겸직","영업 실체 없는 유령법인 의심이에요"],["상품권 한 달 12번 구매","사자마자 매입업체에 판매","상품권 깡이에요"],["가상계좌에 하루 수십 건 소액","입금자 이름이 전부 다름","도박 충전금이 모이는 계좌예요"],["해킹 사고 지갑에서 코인 입금","믹서 거쳐 개인 지갑으로","해킹 피해금 세탁이에요"],["인허가 공무원 배우자에게 1억","보낸 곳은 인허가 받은 업체","설명 안 되는 공직자 관련 돈이에요"],["같은 날 은행 4곳 계좌 개설","같은 휴대폰, 같은 IP","통장 매매·대여 준비 패턴이에요"],["법인 → 대표 개인 6,500만 원","급여·배당 기록 없음","법인 자금 유용이에요"],["9,900달러 송금, 한 주에 5번","받는 사람이 매번 다름","외화 쪼개기예요"],["개업 1개월 식당, 새벽 결제만","결제 금액이 모두 99만 원","카드깡이에요"],["4년 잠든 계좌에서 2억 출금","당일 제3자에게 전액","휴면 계좌 재가동이에요"],["30명이 '투자 수익금' 입금","매주 소액을 '수익'으로 송금","리딩방 돌려막기예요"],["고위험 국가로 3만 달러","목적을 물으니 답이 없음","목적 없는 위험 국가 송금이에요"],["'고액 알바'로 받은 3,000만 원","받은 날 전액 현금 인출","통장 대여·인출책이에요"],["의류 쇼핑몰인데 결제는 게임머니","승인·취소가 하루 수백 번","가맹점 명의 대여예요"],["해외 연인 부탁으로 받은 돈","바로 코인으로 해외 지갑에","로맨스 스캠 자금 운반이에요"],["지분 24%씩 주주 4명","주주끼리 주소·연락처가 같음","실소유자 기준 피하려 쪼갰어요"],["제재 명단과 이름·생년 일치","국적까지 같음","WLF 일치, 거래를 멈춰야 해요"],["선불카드 수백만 원 충전","충전 즉시 현금화","선불카드 현금화예요"],["5개 계좌가 같은 돈을 돌림","하루에 세 바퀴","순환 거래예요"],["체납자가 가족 계좌로 입금 요청","본인 계좌는 압류 중","재산 은닉이에요"],["학비라며 매달 다른 나라로","받는 곳이 학교가 아님","유학 송금 위장이에요"],["중고거래 대금 50명에게 입금","물건 보낸 기록 없음","중고거래 사기예요"],["증권 계좌에 매매 없이 입출금","한 달 3억","증권 계좌를 통로로 써요"],["개인 지갑으로 99만 원씩 출금","하루 10번","트래블룰 기준 회피예요"],["보험 1억 넣고 2주 만에 해지","환급금은 제3자 계좌로","보험 해지 세탁이에요"],["비영리 단체에 출처 모를 2억","기부자 명단 없음","비영리단체 악용이에요"]];
  var QO=[["전세 보증금 2억 원 수령","임대차 계약서와 일치","큰돈이지만 출처가 분명해요"],["무역 송금 5만 달러","송장·선하증권 금액 일치","서류와 맞는 무역 대금이에요"],["시장 상인 현금 1,500만 원","몇 년째 매주 비슷함","업종에 맞는 현금이에요"],["직원 9명 급여 3,200만 원","4대 보험 인원과 일치","정기 급여예요"],["본인 해외 거래소로 코인 이동","2년째 쓰던 계정","본인 계정 사이 이동이에요"],["딸 결혼자금 3,000만 원 이체","증여세 신고 예정","목적이 분명한 가족 이체예요"],["교통사고 보험금 8,000만 원","보험사 지급 확인서 있음","출처가 분명해요"],["거래처 6곳 용역비 입금","세금계산서와 일치","증빙이 맞아요"],["가게 판 돈으로 대출 1억 상환","매매 계약서 확인","출처가 확인돼요"],["미국 대학 학비 2만 달러","고지서·학교 계좌 일치","학비가 맞아요"],["카페 카드 매출 1,800만 원","점심·저녁에 결제 집중","업종에 맞는 매출이에요"],["명절 앞 현금 500만 원 인출","매년 같은 시기","해마다 반복되는 생활 자금이에요"],["하도급 공사대금 5억 원","계약서·기성 내역 일치","계약에 맞는 대금이에요"],["중고차 판매 대금 990만 원","한 번뿐, 이전 등록 확인","기준 아래지만 출처가 분명해요"],["10년 보유 주식 판 3억","본인 계좌로 이동","본인 자산 이동이에요"],["연말 정기 후원 300건","영수증 발급과 일치","정기 후원이에요"],["외국인 근로자 매달 1,000달러","3년째 같은 모양","생활비 송금이에요"],["쇼핑몰 주문 1,200건 정산","주문 내역과 금액 일치","정상 정산이에요"],["권리금 7,000만 원 수령","양도 계약서와 일치","계약으로 확인돼요"],["이사·가구 비용 1,500만 원","가구점·이사업체로 결제","쓰임이 분명해요"],["퇴직금 1억 2천만 원 입금","회사 명의 지급","출처가 분명한 퇴직금이에요"],["매달 같은 날 월세 85만 원","12개월째 같은 금액","정기 월세예요"],["복권 당첨금 수령","수탁은행에서 지급","출처가 분명해요"],["부모님 병원비 2,000만 원","병원 계좌로 직접","쓰임이 분명해요"],["아파트 중도금 3억 원","분양 계약서와 일치","계약에 맞는 납부예요"],["부가세 환급금 입금","국세청 지급","정상 환급이에요"],["법인 주주 배당 4,000만 원","이사회 결의서 있음","정상 배당이에요"],["해외 출장비 5,000달러 환전","출장 결재 문서 확인","업무 목적이 분명해요"],["헬스장 회원권 결제 300건","연초 등록이 몰림","업종 계절성이에요"],["10년째 매주 같은 헌금 입금","금액 변화 거의 없음","정상 기부금이에요"]];
  var docNo=120,recentDocs=[];
  function genDoc(){var r=Math.random(),c,bad,key=null,id;
    if(r<0.18){var t=Math.random()<0.4?pick(todayTerms()):pick(TERMS);c=[TDESC[t],"",t+"이에요"];bad=true;key=todayTerms().indexOf(t)>-1?t:null;id="t"+t}
    else{bad=r<0.59;var arr=bad?QB:QO,i,tr=0;do{i=Math.floor(Math.random()*arr.length);tr++}while(recentDocs.indexOf((bad?"b":"o")+i)>-1&&tr<20);id=(bad?"b":"o")+i;c=arr[i]}
    recentDocs.push(id);if(recentDocs.length>14)recentDocs.shift();docNo++;
    return{no:docNo,a:c[0],b:c[1],why:c[2],bad:bad,key:key,born:AC.t}}
  function kbNext(){AC.doc=genDoc();AC.fuseMax=Math.max(1.7,3.8-AC.done*0.035);AC.fuse=AC.fuseMax;AC.stamp=null}
  function kbFever(){return AC.combo>=12?3:AC.combo>=5?2:1}
  function kbPop(x,y,good,big){var n=big?90:55,cols=good?["#0F1012","#FFE14A","#FFFFFF","#C4C6CC"]:["#C9381E","#0F1012","#FFE14A"];
    for(var i=0;i<n;i++){var a=Math.random()*Math.PI*2,v=(big?520:380)*(0.3+Math.random());AC.parts.push({x:x+(Math.random()-.5)*AC.W*0.5,y:y+(Math.random()-.5)*AC.H*0.2,vx:Math.cos(a)*v,vy:Math.sin(a)*v-160,life:0.6+Math.random()*0.5,max:1.1,c:cols[i%cols.length],s:3+Math.random()*6})}
    AC.rings=AC.rings||[];AC.rings.push({x:x,y:y,life:0.35,good:good})}
  function kbMiss(d,timeout){AC.lives--;AC.combo=0;AC.flash=1;AC.shake=1;try{navigator.vibrate&&navigator.vibrate([30,40,30])}catch(e){}
    if(d.bad){AC.miss=AC.miss||[];AC.miss.push(d.key||d.a)}
    AC.fb={ok:false,t:(timeout?"시간 초과 · ":"땡 · ")+(d.bad?"반려가 맞아요. ":"승인이 맞아요. ")+d.why,life:1.8};
    if(AC.lives<=0)AC.endT=1}
  function decide(approve){
    if(!AC.run||AC.g!=="k"||AC.stamp||AC.endT>0)return;var d=AC.doc,ok=(approve&&!d.bad)||(!approve&&d.bad),cxp=AC.W/2,cyp=AC.H*0.36;
    AC.stamp={t:0,ok:ok,approve:approve};AC.done++;
    if(ok){AC.combo++;AC.maxCombo=Math.max(AC.maxCombo||0,AC.combo);AC.right++;var fv=kbFever(),speed=Math.round(10*AC.fuse/AC.fuseMax),pts=(10+Math.min(20,(AC.combo-1)*2)+speed+(d.key?10:0))*fv;AC.score+=pts;
      kbPop(cxp,cyp,true,fv>1);AC.shake=Math.min(1,0.45+fv*0.15);try{navigator.vibrate&&navigator.vibrate(fv>1?25:14)}catch(e){}
      popText(approve?AC.W*0.25:AC.W*0.75,cyp-AC.H*0.05,"+"+pts,approve?"#0F1012":"#C9381E",fv>1?30:24);
      if(AC.combo===5)popText(AC.W/2,AC.H*0.12,"FEVER · 점수 2배","#0F1012",22);if(AC.combo===12)popText(AC.W/2,AC.H*0.12,"SUPER FEVER · 점수 3배","#C9381E",22);
      AC.fb={ok:true,t:(approve?"승인":"반려")+" 정답 · "+d.why,life:1.3}}
    else{kbPop(cxp,cyp,false,false);kbMiss(d,false)}}
  function stepKyul(dt){
    if(AC.fb){AC.fb.life-=dt;if(AC.fb.life<=0)AC.fb=null}
    (AC.rings||[]).forEach(function(r){r.life-=dt});AC.rings=(AC.rings||[]).filter(function(r){return r.life>0});
    if(AC.endT>0){AC.endT-=dt;if(AC.endT<=0)acEnd("검사 지적 3회");return}
    if(AC.stamp){AC.stamp.t+=dt;if(AC.stamp.t>0.16)kbNext();return}
    AC.fuse-=dt*(kbFever()>1?1.15:1);if(AC.fuse<=0){AC.fuse=0;var d=AC.doc;AC.done++;AC.stamp={t:0,ok:false,approve:null,boom:true};kbPop(AC.W/2,AC.H*0.36,false,true);popText(AC.W/2,AC.H*0.3,"펑","#C9381E",34);kbMiss(d,true)}
  }
  function drawKyul(){var W=AC.W,H=AC.H,fv=kbFever();
    /* 반으로 나눈 판정 영역 */
    cx.fillStyle="rgba(15,16,18,0.035)";cx.fillRect(0,0,W/2,H);cx.fillStyle="rgba(201,56,30,0.05)";cx.fillRect(W/2,0,W/2,H);
    if(fv>1){cx.fillStyle="rgba(255,225,74,"+(0.10+0.06*Math.sin(AC.t*10))+")";cx.fillRect(0,0,W,H)}
    cx.setLineDash([6,8]);cx.strokeStyle="rgba(15,16,18,0.12)";cx.lineWidth=1;cx.beginPath();cx.moveTo(W/2+.5,0);cx.lineTo(W/2+.5,H);cx.stroke();cx.setLineDash([]);
    cx.textAlign="center";cx.textBaseline="middle";cx.font="800 "+Math.round(W*0.085)+"px "+FONT;cx.fillStyle="rgba(15,16,18,0.13)";cx.fillText("승인",W*0.25,H*0.8);cx.fillStyle="rgba(201,56,30,0.2)";cx.fillText("반려",W*0.75,H*0.8);
    cx.font="600 12px "+FONT;cx.fillStyle="rgba(15,16,18,0.32)";cx.fillText("← 정상이면 여기",W*0.25,H*0.8+W*0.06);cx.fillStyle="rgba(201,56,30,0.45)";cx.fillText("의심이면 여기 →",W*0.75,H*0.8+W*0.06);
    /* 상단 정보 */
    cx.textBaseline="alphabetic";cx.font="600 12px "+FONT;cx.textAlign="left";cx.fillStyle="#8A8C92";cx.fillText("검사 지적",14,24);
    var lives=AC.lives==null?3:AC.lives;for(var i=0;i<3;i++){cx.beginPath();cx.arc(80+i*16,20,5.5,0,7);if(i<3-lives){cx.fillStyle="#C9381E";cx.fill()}else{cx.strokeStyle="#C4C6CC";cx.lineWidth=1.5;cx.stroke()}}
    cx.textAlign="right";cx.fillStyle=AC.combo>=5?"#0F1012":"#8A8C92";cx.font=(AC.combo>=5?"800 14px ":"600 12px ")+FONT;cx.fillText(AC.combo>1?"콤보 "+AC.combo+(fv>1?" · ×"+fv:""):"연속으로 맞히면 피버",W-14,24);
    (AC.rings||[]).forEach(function(r){var k=1-r.life/0.35;cx.beginPath();cx.arc(r.x,r.y,30+k*W*0.45,0,7);cx.strokeStyle=r.good?"rgba(15,16,18,"+(0.5*(1-k))+")":"rgba(201,56,30,"+(0.6*(1-k))+")";cx.lineWidth=4*(1-k)+1;cx.stroke()});
    /* 카드 */
    var d=AC.doc;if(d&&!(AC.stamp&&AC.stamp.t>0.02)){var cw=Math.min(W*0.8,400),ch=H*0.34,age=Math.min(1,(AC.t-(d.born||0))/0.12),sc=0.85+0.15*age,x0=W/2,y0=H*0.36;
      cx.save();cx.translate(x0,y0);cx.scale(sc,sc);cx.globalAlpha=age;
      rr(-cw/2,-ch/2,cw,ch,16);cx.fillStyle="#FFFFFF";cx.shadowColor="rgba(0,0,0,.14)";cx.shadowBlur=24;cx.shadowOffsetY=8;cx.fill();cx.shadowColor="transparent";cx.strokeStyle=fv>1?"#0F1012":"#D6D6D1";cx.lineWidth=fv>1?2:1;cx.stroke();
      var fr=AC.fuseMax?Math.max(0,AC.fuse/AC.fuseMax):1,fx0=-cw/2+18,fw=cw-36,fy=-ch/2+16;cx.strokeStyle="#EDEDE9";cx.lineWidth=4;cx.lineCap="round";cx.beginPath();cx.moveTo(fx0,fy);cx.lineTo(fx0+fw,fy);cx.stroke();
      cx.strokeStyle=fr<0.3?"#C9381E":"#0F1012";cx.beginPath();cx.moveTo(fx0,fy);cx.lineTo(fx0+fw*fr,fy);cx.stroke();cx.lineCap="butt";
      if(AC.run){var sx=fx0+fw*fr;cx.beginPath();cx.arc(sx,fy,4+Math.random()*2.5,0,7);cx.fillStyle=Math.random()<0.5?"#FFE14A":"#C9381E";cx.fill()}
      cx.textAlign="center";cx.fillStyle="#8A8C92";cx.font="500 11px "+FONT;cx.textBaseline="middle";cx.fillText("결재 No."+d.no+(d.key?" · 오늘의 키워드":""),0,-ch/2+36);
      var fs=Math.round(Math.min(26,cw*0.062));cx.font="800 "+fs+"px "+FONT;cx.fillStyle="#0F1012";var ls=wrapLines(d.a,cw-40).slice(0,3),y=(d.b?-fs*0.4:fs*0.3)-(ls.length-1)*fs*0.62;ls.forEach(function(l,i){cx.fillText(l,0,y+i*fs*1.25)});
      if(d.b){cx.font="500 "+Math.round(fs*0.6)+"px "+FONT;cx.fillStyle="#6B6E76";cx.fillText(d.b,0,y+ls.length*fs*1.25+fs*0.25)}
      cx.restore();cx.textBaseline="alphabetic";cx.globalAlpha=1}
    if(AC.stamp&&AC.stamp.t<0.16&&!AC.stamp.boom){var col=AC.stamp.ok?(AC.stamp.approve?"#0F1012":"#C9381E"):"#C9381E";cx.save();cx.translate(W/2,H*0.36);cx.rotate(-0.15);var s2=1.6-AC.stamp.t*4;cx.scale(s2,s2);cx.font="800 "+Math.round(W*0.09)+"px "+FONT;cx.textAlign="center";cx.textBaseline="middle";cx.fillStyle=col;cx.fillText(AC.stamp.ok?(AC.stamp.approve?"승인!":"반려!"):"땡",0,0);cx.restore();cx.textBaseline="alphabetic"}
    /* 즉답 */
    if(AC.fb){var fa=Math.min(1,AC.fb.life*3);cx.globalAlpha=fa;cx.font="600 13.5px "+FONT;cx.textAlign="center";var lines=wrapLines(AC.fb.t,Math.min(W-40,420)),by=H*0.6;
      rr(W/2-Math.min(W-28,440)/2,by-20,Math.min(W-28,440),lines.length*20+20,12);cx.fillStyle=AC.fb.ok?"rgba(255,255,255,0.95)":"rgba(251,237,234,0.97)";cx.fill();cx.strokeStyle=AC.fb.ok?"#E2E2DD":"#F0C9C0";cx.lineWidth=1;cx.stroke();
      cx.fillStyle=AC.fb.ok?"#0F1012":"#C9381E";lines.forEach(function(l,i){cx.fillText(l,W/2,by+i*20)});cx.globalAlpha=1}
  }
  /* 자금세탁 방어전: 좌우로 움직이며 자동 사격, 숫자 게이트로 요원을 불리고 총책까지 막아요 */
  var GOOD=[["num","요원 채용"],["num","요원 채용"],["num","요원 채용"],["mul","TMS 자동화"],["rate","룰 튜닝"],["dmg","EDD 강화"]],BADG=[["num","인력 이탈"],["num","인력 이탈"],["div","감사 지적"]];
  var PERKS=[["spread","확산탄 +1"],["pierce","관통탄 +1"],["rate","공속 +20%"],["heal","요원 +10"],["freeze","즉시 지급정지"]];
  function fdK(){return AC.W/400}
  function fdPY(){return AC.H-62*Math.max(0.85,fdK())}
  function fdMul(){var s=AC.stage||1;return Math.pow(2,s-1)*(1+(AC.st||0)/30)*(AC.adapt||1)}
  function fdSR(){return (7+Math.sqrt(Math.min(AC.n,220))*2.6)*fdK()}
  function fdInit(idle){AC.maxN=8;AC.n=8;AC.nShow=8;AC.dmg=1;AC.rate=2.2;AC.spread=0;AC.pierce=0;AC.px=AC.W/2;AC.en=[];AC.bul=[];AC.gates=[];AC.boxes=[];AC.kills=0;AC.keyN=0;AC.stage=1;AC.st=0;AC.boss=null;AC.bossDone=false;
    AC.gT=1.6;AC.eT=2.4;AC.firstPair=true;AC.boxAt=-1;AC.fireT=0;AC.freeze=0;AC.skillT=0;AC.skillLbl="";AC.scroll=0;AC.banner=idle?0:1.6;AC.bannerTxt="STAGE 1";AC.rings=[];AC.pairId=0;AC.drops=[];AC.iT=1.6;AC.speedT=0;AC.shieldT=0;AC.adapt=1}
  function fdGate(def,side,s){var kind=def[0],v=0;
    var n=AC.n||5;if(kind==="num")v=def[1]==="요원 채용"?Math.round(Math.max(4+3*s,n*0.12)*(0.7+Math.random()*0.8)):-Math.round(Math.max(3+3*s,n*0.3)*(0.6+Math.random()*0.9));
    else if(kind==="mul")v=n<40?2:1.5;else if(kind==="div")v=2;
    return{kind:kind,cap:def[1],v:v,side:side}}
  function gateGood(g){return g.kind==="num"?g.v>=0:g.kind!=="div"}
  function gateText(g){return g.kind==="num"?(g.v>=0?"+":"−")+Math.abs(Math.round(g.v)):g.kind==="mul"?"×"+g.v:g.kind==="div"?"÷"+g.v:g.kind==="rate"?"공속 +25%":"화력 +50%"}
  function fdSpawnGates(){var s=AC.stage,r=AC.firstPair?0:Math.random(),a,b;AC.firstPair=false;
    var g1,g2;if(r>=0.3&&r<0.55&&AC.n>=6){g1=fdGate(["num","요원 채용"],0,s);g1.v=Math.max(3,Math.round(AC.n*(0.6+Math.random()*0.8)));g2=fdGate(["mul","TMS 자동화"],1,s);g2.v=AC.n<40?2:1.5}
    else{if(r<0.3||r<0.72){a=pick(GOOD);b=pick(BADG)}else if(r<0.85){a=pick(GOOD);b=pick(GOOD)}else{a=pick(BADG);b=pick(BADG)}g1=fdGate(a,0,s);g2=fdGate(b,1,s)}if(Math.random()<0.5){g1.side=1;g2.side=0}
    var h=48*fdK(),id=++AC.pairId;[g1,g2].forEach(function(g){g.y=36-h;g.h=h;g.pid=id;AC.gates.push(g)});AC.boxAt=AC.st+3.1}
  function fdSpawnBox(){var k=fdK(),side=Math.random()<0.5?0:1,p=pick(PERKS),hp=Math.round(18*fdMul());AC.boxes.push({x:AC.W*(side?0.75:0.25),y:20,w:84*k,h:50*k,hp:hp,max:hp,perk:p[0],cap:p[1]})}
  function fdEnemy(hp,boss){var k=fdK(),tt=todayTerms(),key=!boss&&Math.random()<0.2,lab=boss?pick(BOSS):key?pick(tt):randBad();
    var r=boss?46*k:(11+Math.min(11,Math.sqrt(hp)*1.5))*k;
    return{x:AC.W*0.1+Math.random()*AC.W*0.8,y:36-r,r:r,hp:hp,max:hp,label:lab,key:key,boss:!!boss,vy:AC.H*(boss?0.035:0.14+Math.random()*0.06),hit:0,wob:Math.random()*6,minT:2.5}}
  function fdSpawnGroup(){var s=AC.stage,n=2+Math.floor(Math.random()*3)+(s>2?1:0),m=fdMul();for(var i=0;i<n;i++){var e=fdEnemy(Math.max(1,Math.round((2+Math.random()*5)*m)));e.x=AC.W*(0.1+0.8*(i+Math.random()*0.6)/n);e.y-=Math.random()*30;AC.en.push(e)}}
  var DROPS=[["rate","공속","공속 +20%",1],["spread","확산","확산탄 +1",1],["pierce","관통","관통탄 +1",0.8],["shield","방패","3초 무적",0.9],["heal","+5","요원 +5",1],["speed","≫","점수 ×2 · 가속",2]];
  function fdSpawnDrop(){var tot=0;DROPS.forEach(function(d){tot+=d[3]});var r=Math.random()*tot,p=DROPS[0];for(var i=0;i<DROPS.length;i++){r-=DROPS[i][3];if(r<=0){p=DROPS[i];break}}
    var k=fdK();AC.drops.push({kind:p[0],ic:p[1],cap:p[2],x:AC.W*(0.12+Math.random()*0.76),y:30,r:17*Math.max(0.85,k),ph:Math.random()*6})}
  function fdTake(d){var c="#0F1012",t=d.cap;
    if(d.kind==="rate")AC.rate=Math.min(7,AC.rate*1.2);else if(d.kind==="spread")AC.spread=Math.min(4,AC.spread+1);else if(d.kind==="pierce")AC.pierce=Math.min(3,AC.pierce+1);
    else if(d.kind==="shield")AC.shieldT=3;else if(d.kind==="heal")AC.n=Math.min(150,AC.n+5);
    else{AC.speedT=5;c="#C9381E";t="가속! 5초 · 점수 2배";AC.shake=0.8;AC.flash=0.5;try{navigator.vibrate&&navigator.vibrate([20,30,20])}catch(x){}}
    burst(d.x,d.y,22,d.kind==="speed"?["#C9381E","#FFE14A"]:["#0F1012","#FFE14A"],260);popText(d.x,d.y-d.r-6,t,c,17)}
  function fdSkill(){if(!AC.run||AC.g!=="f"||AC.skillT>0)return;AC.freeze=2.5;AC.skillT=15;AC.shake=0.6;popText(AC.W/2,AC.H*0.42,"지급정지","#2C4FD1",26);try{navigator.vibrate&&navigator.vibrate(30)}catch(x){}}
  function fdLose(x,y,loss){AC.n=Math.max(0,AC.n-loss);popText(x,y,"−"+loss,"#C9381E",20);AC.flash=0.8;AC.shake=Math.min(1,AC.shake+0.6);burst(x,y,16,["#C9381E","#0F1012"],240);try{navigator.vibrate&&navigator.vibrate(40)}catch(z){}}
  function fdKill(e){e.dead=1;var pts=(e.boss?300*AC.stage:5+Math.round(e.max)+(e.key?20:0))*(AC.speedT>0?2:1);AC.score+=pts;AC.kills++;if(e.key)AC.keyN++;
    burst(e.x,e.y,e.boss?80:16,e.key?["#FFE14A","#0F1012","#C9381E"]:["#0F1012","#C9381E","#FFE14A"],e.boss?400:230);
    popText(e.x,e.y-e.r-4,e.boss?e.label+" 검거 +"+fmtN(pts):e.key?"오늘의 키워드 +"+pts:"+"+pts,e.boss||e.key?"#C9381E":"#0F1012",e.boss?20:14);
    AC.shake=Math.min(1,AC.shake+(e.boss?1:0.1));try{navigator.vibrate&&navigator.vibrate(e.boss?90:6)}catch(x){}
    if(e.boss)fdNext()}
  function fdNext(){AC.boss=null;AC.bossDone=false;AC.stage++;AC.st=0;AC.gT=2;AC.eT=1.5;AC.firstPair=true;AC.banner=1.8;AC.bannerTxt="STAGE "+AC.stage;AC.en.forEach(function(o){if(!o.dead){o.dead=1;burst(o.x,o.y,8,["#0F1012","#FFE14A"],200)}})}
  function fdPerk(b){var t=b.cap;if(b.perk==="spread")AC.spread=Math.min(4,AC.spread+1);else if(b.perk==="pierce")AC.pierce=Math.min(3,AC.pierce+1);else if(b.perk==="rate")AC.rate=Math.min(7,AC.rate*1.2);else if(b.perk==="heal")AC.n=Math.min(150,AC.n+10);else{AC.freeze=2.5}
    AC.score+=30;burst(b.x,b.y,26,["#FFE14A","#0F1012"],280);popText(b.x,b.y-10,t,"#0F1012",17)}
  function stepDef(dt){var k=fdK(),py=fdPY(),W=AC.W,H=AC.H,sm=AC.speedT>0?1.75:1,ws=H*0.21*sm;AC.speedT=Math.max(0,AC.speedT-dt);AC.shieldT=Math.max(0,AC.shieldT-dt);
    var sp=W*1.15;if(AC.keys.ArrowLeft)AC.px-=sp*dt;if(AC.keys.ArrowRight)AC.px+=sp*dt;AC.px=Math.max(18,Math.min(W-18,AC.px));
    AC.st+=dt;AC.scroll+=ws*dt;AC.skillT=Math.max(0,AC.skillT-dt);AC.freeze=Math.max(0,AC.freeze-dt);AC.banner=Math.max(0,AC.banner-dt);
    var fz=AC.freeze>0;
    if(!AC.boss&&AC.st>=28&&!AC.bossDone){AC.bossDone=true;var bh=Math.round(170*Math.pow(2.1,AC.stage-1));var b=fdEnemy(bh,true);b.x=W/2;AC.boss=b;AC.en.push(b);AC.banner=1.6;AC.bannerTxt="총책 등장"}
    if(!AC.boss){AC.gT-=dt;if(AC.gT<=0){AC.gT=Math.max(2.8,3.8-AC.stage*0.15);fdSpawnGates()}if(AC.boxAt>0&&AC.st>=AC.boxAt){AC.boxAt=-1;if(Math.random()<0.65)fdSpawnBox()}}
    AC.eT-=dt;if(AC.eT<=0){AC.eT=Math.max(0.85,1.9-AC.stage*0.12)*(AC.boss?1.6:1);fdSpawnGroup()}
    AC.gates.forEach(function(g){g.y+=ws*dt});AC.boxes.forEach(function(b){b.y+=ws*dt;if(b.y>H+b.h)b.dead=1});
    var sr=fdSR();
    AC.iT-=dt;if(AC.iT<=0){AC.iT=1.5+Math.random()*1.3;fdSpawnDrop()}
    var ab=Math.round(AC.adapt*10);if(AC.n>=60)AC.adapt=Math.min(2.2,AC.adapt+0.035*dt);else if(AC.n<20)AC.adapt=Math.max(0.6,AC.adapt-0.06*dt);if(Math.round(AC.adapt*10)!==ab&&Math.round(AC.adapt*10)%2===0)popText(W/2,64,AC.adapt>1?"적이 강해져요 ×"+AC.adapt.toFixed(1):"적이 약해져요 ×"+AC.adapt.toFixed(1),AC.adapt>1?"#C9381E":"#6B6E76",14);
    AC.drops.forEach(function(d){d.y+=ws*dt;d.ph+=dt*5;var dx=d.x-AC.px,dy=d.y-py;if(dx*dx+dy*dy<(d.r+sr)*(d.r+sr)){d.dead=1;fdTake(d)}if(d.y>H+d.r)d.dead=1});AC.drops=AC.drops.filter(function(d){return !d.dead});
    AC.en.forEach(function(e){e.hit=Math.max(0,e.hit-dt);if(fz)return;e.y+=e.vy*dt*sm;if(!e.boss)e.x+=(AC.px-e.x)*0.6*dt*sm+Math.sin(AC.t*2+e.wob)*6*dt;
      if(e.boss){e.minT-=dt;if(e.minT<=0){e.minT=2.6;for(var j=0;j<2;j++){var m=fdEnemy(Math.max(1,Math.round(3*fdMul())));m.x=Math.max(20,Math.min(W-20,e.x+(j?1:-1)*e.r*1.3));m.y=e.y+e.r*0.4;AC.en.push(m)}}}
      var dx=e.x-AC.px,dy=e.y-py;if(dx*dx+dy*dy<(e.r+sr)*(e.r+sr)){if(AC.shieldT>0&&!e.boss){fdKill(e)}else{e.dead=1;fdLose(e.x,e.y,Math.max(1,Math.ceil(e.hp)));if(e.boss&&AC.n>0)fdNext()}}
      if(e.y>H+e.r)e.dead=1});
    /* 게이트 통과 */
    var hitPid=null;AC.gates.forEach(function(g){if(g.used||hitPid===g.pid)return;if(g.y+g.h/2>=py-sr*0.6){var side=AC.px<W/2?0:1;if(g.side===side){hitPid=g.pid;var before=AC.n;
      if(g.kind==="num")AC.n=Math.max(0,AC.n+Math.round(g.v));else if(g.kind==="mul")AC.n=Math.round(AC.n*g.v);else if(g.kind==="div")AC.n=Math.ceil(AC.n/g.v);else if(g.kind==="rate")AC.rate=Math.min(7,AC.rate*1.25);else if(g.kind==="dmg")AC.dmg=Math.min(4,AC.dmg*1.5);
      AC.n=Math.min(150,AC.n);var good=gateGood(g);burst(AC.px,py-sr,good?26:18,good?["#0F1012","#FFE14A"]:["#C9381E","#0F1012"],260);
      popText(AC.px,py-sr-26,g.kind==="rate"||g.kind==="dmg"?gateText(g):"요원 "+before+" → "+AC.n,good?"#0F1012":"#C9381E",18);if(!good){AC.flash=0.6;AC.shake=0.5}}}});
    if(hitPid!==null)AC.gates.forEach(function(g){if(g.pid===hitPid)g.used=true});
    AC.gates=AC.gates.filter(function(g){return !g.used&&g.y<H+g.h});
    /* 사격 */
    AC.fireT-=dt;if(AC.fireT<=0&&AC.n>0){AC.fireT=1/AC.rate;var base=Math.min(AC.n,5),cnt=base+AC.spread*2,per=AC.n*AC.dmg/base,v=H*1.7;
      for(var i=0;i<cnt;i++){var off=(i-(cnt-1)/2),a=-Math.PI/2+(i>=base?(off>0?1:-1)*0.07*(1+Math.floor((i-base)/2)):0),bx=AC.px+off*Math.min(7,sr*2/cnt)*1.2;
        AC.bul.push({x:bx,y:py-sr*0.6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,d:per,p:AC.pierce,hits:[]})}}
    AC.bul.forEach(function(b){b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y<30||b.x<-10||b.x>W+10){b.dead=1;return}
      for(var i=0;i<AC.gates.length;i++){var g=AC.gates[i];if(g.kind!=="num")continue;var gx=g.side*W/2;if(b.x>gx+6&&b.x<gx+W/2-6&&b.y>g.y-g.h/2&&b.y<g.y+g.h/2){g.v+=0.22*Math.max(1,AC.stage*0.7);g.pulse=0.12;b.dead=1;return}}
      for(var j=0;j<AC.boxes.length;j++){var x=AC.boxes[j];if(x.dead)continue;if(Math.abs(b.x-x.x)<x.w/2&&Math.abs(b.y-x.y)<x.h/2){x.hp-=b.d;x.hit=0.08;b.dead=1;if(x.hp<=0){x.dead=1;fdPerk(x)}return}}
      for(var q=0;q<AC.en.length;q++){var e=AC.en[q];if(e.dead||b.hits.indexOf(e)>-1)continue;var dx=e.x-b.x,dy=e.y-b.y;if(dx*dx+dy*dy<(e.r+3)*(e.r+3)){b.hits.push(e);e.hp-=b.d;e.hit=0.07;if(e.hp<=0)fdKill(e);if(b.p--<=0){b.dead=1;break}}}});
    AC.bul=AC.bul.filter(function(b){return !b.dead});AC.en=AC.en.filter(function(e){return !e.dead});AC.boxes=AC.boxes.filter(function(b){return !b.dead});
    AC.nShow+=(AC.n-AC.nShow)*Math.min(1,dt*10);AC.maxN=Math.max(AC.maxN||0,AC.n);
    if(AC.n<=0){AC.n=0;burst(AC.px,py,60,["#C9381E","#0F1012","#FFE14A"],360);acFrame(performance.now());acEnd("요원이 모두 쓰러졌어요 · 스테이지 "+AC.stage);return}
    var sl=AC.skillT>0?"지급정지 · "+Math.ceil(AC.skillT)+"초":"지급정지";if(sl!==AC.skillLbl){AC.skillLbl=sl;var sb=$("acSkill");sb.textContent=sl;sb.disabled=AC.skillT>0}
  }
  function drawVillain(e){var r=e.r,fz=AC.freeze>0;cx.save();cx.translate(e.x,e.y);
    if(e.boss){cx.beginPath();cx.arc(0,0,r+5,0,7);cx.strokeStyle="#C9381E";cx.lineWidth=3;cx.stroke()}
    cx.beginPath();cx.arc(0,0,r,0,7);cx.fillStyle=e.hit>0?"#FFFFFF":e.boss?"#1A1B20":"#2A2C32";cx.fill();cx.lineWidth=1.5;cx.strokeStyle="#0F1012";cx.stroke();
    cx.fillStyle="#0F1012";cx.fillRect(-r*0.72,-r*1.02,r*1.44,r*0.42);rr(-r*1.02,-r*0.66,r*2.04,r*0.16,r*0.08);cx.fill();
    rr(-r*0.86,-r*0.42,r*1.72,r*0.36,r*0.18);cx.fill();
    cx.fillStyle="#FFFFFF";cx.beginPath();cx.ellipse(-r*0.34,-r*0.24,r*0.15,r*0.09,0,0,7);cx.ellipse(r*0.34,-r*0.24,r*0.15,r*0.09,0,0,7);cx.fill();
    var hp=Math.max(1,Math.ceil(e.hp));cx.fillStyle=e.boss?"#FFE14A":"#FFFFFF";cx.font="800 "+Math.round(Math.max(10,r*(String(hp).length>3?0.48:0.62)))+"px "+FONT;cx.textAlign="center";cx.textBaseline="middle";cx.fillText(fmtN(hp),0,r*0.36);
    if(fz){cx.beginPath();cx.arc(0,0,r+3,0,7);cx.strokeStyle="#2C4FD1";cx.lineWidth=2;cx.stroke()}
    if(e.label){var fs=e.boss?13:10.5;cx.font=(e.boss?"800 ":"600 ")+fs+"px "+FONT;cx.textBaseline="top";var tw=cx.measureText(e.label).width;
      if(e.key){cx.fillStyle="#FFE14A";cx.fillRect(-tw/2,r+4+fs*0.55,tw,fs*0.45)}
      cx.fillStyle=e.boss?"#C9381E":"#43454B";cx.fillText(e.label,0,r+4)}
    cx.restore();cx.textBaseline="alphabetic"}
  function drawDef(){var W=AC.W,H=AC.H,k=fdK(),py=fdPY(),sr=fdSR();
    cx.fillStyle="#FFFFFF";cx.fillRect(0,0,W,H);cx.strokeStyle="#F0F0EC";cx.lineWidth=1;for(var x=0;x<W;x+=24){cx.beginPath();cx.moveTo(x+.5,0);cx.lineTo(x+.5,H);cx.stroke()}
    var off=(AC.scroll||0)%24;for(var y=off-24;y<H;y+=24){cx.beginPath();cx.moveTo(0,y+.5);cx.lineTo(W,y+.5);cx.stroke()}
    cx.setLineDash([6,8]);cx.strokeStyle="#E2E2DD";cx.beginPath();cx.moveTo(W/2+.5,40);cx.lineTo(W/2+.5,H);cx.stroke();cx.setLineDash([]);
    (AC.gates||[]).forEach(function(g){var gx=g.side*W/2+6,gw=W/2-12,good=gateGood(g),pu=g.pulse>0?1:0;g.pulse=Math.max(0,(g.pulse||0)-0.016);
      rr(gx,g.y-g.h/2,gw,g.h,10);cx.fillStyle=good?"rgba(15,16,18,0.05)":"rgba(201,56,30,0.09)";cx.fill();cx.lineWidth=pu?3:2;cx.strokeStyle=good?"#0F1012":"#C9381E";cx.stroke();
      cx.textAlign="center";cx.textBaseline="middle";cx.fillStyle=good?"#0F1012":"#C9381E";var big=gateText(g);cx.font="800 "+Math.round((big.length>4?17:24)*Math.max(0.85,k))+"px "+FONT;cx.fillText(big,gx+gw/2,g.y-g.h*0.1);
      cx.font="600 "+Math.round(10.5*Math.max(0.9,k))+"px "+FONT;cx.fillStyle=good?"#6B6E76":"#C9381E";cx.fillText(g.cap,gx+gw/2,g.y+g.h*0.3);cx.textBaseline="alphabetic"});
    (AC.boxes||[]).forEach(function(b){cx.save();cx.translate(b.x,b.y);rr(-b.w/2,-b.h/2,b.w,b.h,6);cx.fillStyle=b.hit>0?"#FFE14A":"#FFFFFF";b.hit=Math.max(0,(b.hit||0)-0.016);cx.fill();cx.lineWidth=2;cx.strokeStyle="#0F1012";cx.stroke();
      cx.fillStyle="#0F1012";cx.fillRect(-b.w/2,-b.h/2,b.w,b.h*0.3);cx.fillStyle="#FFE14A";cx.font="700 "+Math.round(9.5*Math.max(0.9,k))+"px "+FONT;cx.textAlign="center";cx.textBaseline="middle";cx.fillText("STR 보고서",0,-b.h*0.35);
      cx.fillStyle="#0F1012";cx.font="800 "+Math.round(17*Math.max(0.85,k))+"px "+FONT;cx.fillText(fmtN(Math.max(1,Math.ceil(b.hp))),0,b.h*0.08);cx.font="500 "+Math.round(9.5*Math.max(0.9,k))+"px "+FONT;cx.fillStyle="#6B6E76";cx.fillText(b.cap,0,b.h*0.34);cx.restore();cx.textBaseline="alphabetic"});
    (AC.drops||[]).forEach(function(d){var sp=d.kind==="speed",pr=d.r*(1+Math.sin(d.ph)*0.07);cx.beginPath();cx.arc(d.x,d.y,pr,0,7);cx.fillStyle=sp?"#FFF4F1":"#FFFFFF";cx.fill();cx.lineWidth=2.5;cx.strokeStyle=sp?"#C9381E":"#0F1012";cx.stroke();
      cx.beginPath();cx.arc(d.x,d.y,pr+4+Math.sin(d.ph)*2,0,7);cx.lineWidth=1;cx.strokeStyle=sp?"rgba(201,56,30,.35)":"rgba(15,16,18,.2)";cx.stroke();
      cx.textAlign="center";cx.textBaseline="middle";cx.fillStyle=sp?"#C9381E":"#0F1012";cx.font="800 "+Math.round(pr*(d.ic.length>1?0.62:0.95))+"px "+FONT;cx.fillText(d.ic,d.x,d.y+1);
      cx.font="600 "+Math.round(10*Math.max(0.9,k))+"px "+FONT;cx.fillStyle=sp?"#C9381E":"#43454B";cx.textBaseline="top";cx.fillText(d.cap,d.x,d.y+pr+5);cx.textBaseline="alphabetic"});
    (AC.en||[]).slice().sort(function(a,b){return a.y-b.y}).forEach(drawVillain);
    (AC.bul||[]).forEach(function(b){cx.fillStyle="#0F1012";cx.fillRect(b.x-1.5,b.y-5,3,10);cx.fillStyle="#FFE14A";cx.fillRect(b.x-1.5,b.y-5,3,3)});
    var cnt=Math.min(Math.round(AC.nShow||AC.n||0),70),dr=Math.max(3,4.2*k);for(var i=0;i<cnt;i++){var rad=sr*Math.sqrt((i+0.5)/Math.max(cnt,1)),ang=i*2.39996;var ax=AC.px+Math.cos(ang)*rad,ay=py+Math.sin(ang)*rad*0.7;
      cx.beginPath();cx.arc(ax,ay,dr,0,7);cx.fillStyle="#0F1012";cx.fill();cx.fillStyle="#FFE14A";cx.fillRect(ax-dr*0.6,ay+dr*0.15,dr*1.2,dr*0.35)}
    if(AC.shieldT>0){cx.beginPath();cx.arc(AC.px,py,sr+10,0,7);cx.lineWidth=3;cx.strokeStyle="rgba(15,16,18,"+(0.35+0.25*Math.sin(AC.t*18))+")";cx.stroke()}
    var nt=fmtN(Math.round(AC.nShow||0));cx.font="800 "+Math.round(18*Math.max(0.9,k))+"px "+FONT;var nw=cx.measureText(nt).width+20,ny=py-sr*0.7-26;
    rr(AC.px-nw/2,ny-13,nw,26,13);cx.fillStyle="#0F1012";cx.fill();cx.fillStyle="#FFFFFF";cx.textAlign="center";cx.textBaseline="middle";cx.fillText(nt,AC.px,ny+1);cx.textBaseline="alphabetic";
    if(AC.speedT>0){cx.strokeStyle="rgba(201,56,30,0.18)";cx.lineWidth=2;for(var si=0;si<10;si++){var sx=(si*97+(AC.scroll*3)%W)%W,sy=((si*173+AC.scroll*4)%H);cx.beginPath();cx.moveTo(sx,sy);cx.lineTo(sx,sy+40);cx.stroke()}cx.font="700 12px "+FONT;cx.fillStyle="#C9381E";cx.textAlign="center";cx.fillText("가속 "+AC.speedT.toFixed(1)+"초 · 점수 2배",W/2,58)}
    if(AC.freeze>0){cx.fillStyle="rgba(44,79,209,0.05)";cx.fillRect(0,0,W,H);cx.font="700 12px "+FONT;cx.fillStyle="#2C4FD1";cx.textAlign="center";cx.fillText("지급정지 중 "+AC.freeze.toFixed(1)+"초",W/2,58)}
    cx.fillStyle="rgba(255,255,255,0.94)";cx.fillRect(0,0,W,36);cx.strokeStyle="#EDEDE9";cx.beginPath();cx.moveTo(0,36.5);cx.lineTo(W,36.5);cx.stroke();
    cx.font="600 12px "+FONT;cx.textBaseline="middle";cx.textAlign="left";cx.fillStyle="#0F1012";cx.fillText("STAGE "+(AC.stage||1),14,19);
    var bx0=80,bw=W-bx0-14;if(AC.boss){cx.fillStyle="#E7E7E3";cx.fillRect(bx0,16,bw,6);cx.fillStyle="#C9381E";cx.fillRect(bx0,16,bw*Math.max(0,AC.boss.hp/AC.boss.max),6);cx.textAlign="right";cx.fillStyle="#C9381E";cx.font="600 10.5px "+FONT;cx.fillText(AC.boss.label,W-14,29)}
    else{var pr=Math.min(1,(AC.st||0)/28);cx.fillStyle="#E7E7E3";cx.fillRect(bx0,16,bw,4);cx.fillStyle="#0F1012";cx.fillRect(bx0,16,bw*pr,4);cx.textAlign="right";cx.fillStyle="#8A8C92";cx.font="500 10.5px "+FONT;cx.fillText("총책까지",W-14,29)}
    cx.textBaseline="alphabetic";
    if(AC.banner>0){cx.globalAlpha=Math.min(1,AC.banner);cx.font="800 "+Math.round(W*0.075)+"px "+FONT;cx.textAlign="center";cx.fillStyle=AC.bannerTxt==="총책 등장"?"#C9381E":"#0F1012";cx.fillText(AC.bannerTxt||"",W/2,H*0.4);cx.globalAlpha=1}
  }
  /* 입력 */
  function acXY(e){var r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*(AC.W/r.width),y:(e.clientY-r.top)*(AC.H/r.height),t:performance.now()}}
  var acDown=false,acStartX=0;
  cv.addEventListener("pointerdown",function(e){if(!AC.run)return;acDown=true;cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);var p=acXY(e);
    if(AC.g==="d")AC.tx=p.x;else if(AC.g==="c"){AC.trail=[p];AC.swipeCuts=0;AC.mtx=p.x}else if(AC.g==="k")decide(p.x<AC.W/2);else if(AC.g==="f")AC.px=p.x;e.preventDefault()});
  cv.addEventListener("pointermove",function(e){if(!AC.run)return;var p=acXY(e);
    if(AC.g==="d"){if(acDown||e.pointerType==="mouse")AC.tx=p.x}else if(AC.g==="f"){if(acDown||e.pointerType==="mouse")AC.px=p.x}else if(AC.g==="c"&&acDown){AC.mtx=p.x;var last=AC.trail[AC.trail.length-1];AC.trail.push(p);if(last)cutAt(last,p)}e.preventDefault()});
  cv.addEventListener("pointerup",function(e){acDown=false;AC.swipeCuts=0});
  ["pointercancel","pointerleave"].forEach(function(ev){cv.addEventListener(ev,function(){acDown=false;AC.swipeCuts=0})});
  cv.style.touchAction="none";
  $("acOk").onclick=function(){decide(true)};$("acNo").onclick=function(){decide(false)};$("acSkill").onclick=fdSkill;
  document.addEventListener("keydown",function(e){if(!AC.run)return;
    if((GAME==="d"||GAME==="f")&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){AC.keys[e.key]=true;e.preventDefault()}
    if(GAME==="k"&&(e.key==="ArrowLeft"||e.key==="ArrowRight")&&!e.repeat){decide(e.key==="ArrowLeft");e.preventDefault()}
    if(GAME==="f"&&e.code==="Space"&&!e.repeat){fdSkill();e.preventDefault()}});
  document.addEventListener("keyup",function(e){AC.keys[e.key]=false});
  function acPause(){if(AC.run){AC.run=false;AC.paused=true;$("acCoverTxt").textContent="잠시 멈췄어요";$("acStart").textContent="계속";$("acCover").hidden=false}}
  $("acStart").onclick=function(){if(AC.paused&&!AC.over){AC.paused=false;AC.run=true;$("acCover").hidden=true;AC.last=performance.now();AC.raf=requestAnimationFrame(acLoop);return}AC.paused=false;acStart()};
  function acRows(){var k=acRec(),l=LB.docs.filter(function(d){return d.rec&&d.rec[k]}).map(function(d){return{id:d._id,nick:d.nick||"익명",sector:d.sector||"",t:d.rec[k].t}});
    if(!LB.db||!LB.uid){var m=(LS.get("ai_ac_best")||{})[k];if(m)l.push({id:"me",nick:nick()||"나",sector:"이 기기",t:m.t})}return l.sort(function(a,b){return b.t-a.t})}
  function drawAcRank(){var l=acRows(),myId=LB.uid||"me";$("acRkN").textContent=l.length+"명";
    $("acRank").innerHTML=l.length?l.slice(0,10).map(function(x,i){return '<li'+(x.id===myId?' class="me"':'')+'><span class="r">'+String(i+1).padStart(2,"0")+'</span><span class="n">'+esc(x.nick)+(x.sector?'<small>'+esc(x.sector)+'</small>':'')+'</span><span class="t">'+fmtN(x.t)+'</span></li>'}).join("")
      :'<li class="empty">아직 오늘 기록이 없어요. 첫 기록을 남겨 보세요.</li>';
    if("dckf".indexOf(GAME)>-1)$("stTop").textContent=l.length?fmtN(l[0].t):"-"}
  function acStats(){if("dckf".indexOf(GAME)<0)return;
    var k=acRec(),m=(LS.get("ai_ac_best")||{})[k],pl=(LS.get("ai_ac_plays")||{})[k]||0;
    $("pzLvLab").textContent="무한 모드";$("stMine").textContent=m?fmtN(m.t):"-";$("stStreak").textContent=pl+"판";var l=acRows();$("stTop").textContent=l.length?fmtN(l[0].t):"-"}
  function acSubmit(sc){if(!LB.db||!LB.uid){drawAcRank();$("acRkNote").textContent="지금은 이 기기 기록만 보여요. 로그인한 상태로 열면 다른 실무자와 순위를 겨뤄요.";return}
    if(!nick()){$("acNickCard").hidden=false;AC.pending=sc;return}
    var k=acRec(),cur=LB.me?JSON.parse(JSON.stringify(LB.me)):{rec:{}};cur.nick=nick();cur.sector=(PROFILE&&PROFILE.sector)||cur.sector||"";cur.rec=cur.rec||{};
    if(cur.rec[k]&&cur.rec[k].t>=sc){drawAcRank();return}cur.rec[k]={t:sc,at:Date.now()};
    LB.db.doc("lb/"+LB.uid).set(cur).then(function(){LB.me=cur;drawAcRank();acStats()}).catch(function(){$("acRkNote").textContent="순위에 올리지 못했어요. 이 기록은 이 기기에만 남아요."})}
  $("acNickForm").onsubmit=function(e){e.preventDefault();var v=$("acNickIn").value.trim();if(!v)return;LS.set("ai_pz_nick",v);$("acNickCard").hidden=true;if(AC.pending)acSubmit(AC.pending)};
  function acSetup(g){cancelAnimationFrame(AC.raf);AC.g=g;AC.over=true;AC.run=false;AC.paused=false;var G=ACG[g];$("acTitle").textContent=G.t;$("acSub").textContent=G.sub;
    $("acScore").textContent={d:"0",c:"60초",k:"0건",f:"1"}[g];
    $("acCoverTxt").textContent=G.cover;$("acStart").textContent="시작";$("acCover").hidden=false;$("acMsg").textContent="";$("acBtns").hidden=true;$("acSkillBar").hidden=true;
    $("acTerms").innerHTML="오늘의 키워드 "+todayTerms().map(function(t){return '<b title="'+esc(TDESC[t])+'">'+esc(t)+"</b>"}).join("");
    $("acHow").innerHTML=G.how.map(function(h){return "<li><span>"+h+"</span></li>"}).join("");requestAnimationFrame(acSize);drawAcRank();acStats()}
  window.addEventListener("resize",function(){if(!$("g-arcade").hidden&&!AC.run&&!AC.paused)acSize()});

  if(ms.st.s==="play"){$("msCover").hidden=true;$("mfield").classList.remove("blur")}


  /* ---------- 라운지: 오늘의 실무 투표 + 에디터 노트 + 한 줄 의견 ---------- */
  var POLLS=[
    ["고객이 거래 목적 설명을 끝까지 거부하면, 우리 회사는?",["거래를 보류하고 다시 요청","거래 거절","거래는 진행하고 STR 검토","정해진 기준이 없어요"],"설명 거부 자체가 의심 신호예요. 거래를 진행하더라도 거부한 사실과 판단 근거는 꼭 남겨 두세요. 검사 때 가장 먼저 보는 부분이에요."],
    ["STR 보고서 한 건 쓰는 데 보통 얼마나 걸리나요?",["1시간 안","반나절","하루 이상","며칠씩 걸려요"],"가장 오래 걸리는 건 자금 흐름 정리예요. 자주 나오는 유형별로 흐름도 틀을 만들어 두면 시간이 확 줄어요."],
    ["탐지 알림 중 실제 의심거래로 이어지는 비율은?",["1% 미만","1~5%","5~10%","10% 넘어요"],"오탐이 많으면 담당자가 지쳐서 진짜를 놓쳐요. 알림이 가장 많이 나오는 룰부터 기준값을 다시 보세요."],
    ["WLF 동명이인, 어디까지 맞춰 보고 종결하나요?",["생년월일만","생년월일과 국적","신분증까지 다시 확인","시스템 판단 그대로"],"이름이 같으면 생년월일과 국적까지는 맞춰 보는 게 기본이에요. 종결 사유를 한 줄이라도 남겨야 나중에 설명할 수 있어요."],
    ["고위험 고객 재확인 주기, 실제로 지켜지고 있나요?",["잘 지켜져요","조금 밀려 있어요","많이 밀려 있어요","주기 관리를 안 해요"],"밀린 건 한 번에 해결하려 하면 또 밀려요. 이번 달 만료 대상부터 끊어서 처리하는 게 현실적이에요."],
    ["AML 업무에서 시간이 가장 많이 드는 일은?",["알림 검토","STR 작성","고객확인 다시 하기","보고 자료 준비"],"시간이 많이 드는 일과 위험이 큰 일은 다를 수 있어요. 위험이 큰 일에 시간이 가도록 순서를 다시 짜 보세요."],
    ["임직원 AML 교육, 주로 어떻게 하나요?",["온라인 동영상","모여서 하는 교육","사례 토론","자료만 배포"],"실제 회사 사례로 한 장짜리 퀴즈를 만들면 참여율이 확 올라요. 길게 한 번보다 짧게 자주가 좋아요."],
    ["신규 상품 위험평가, 언제 하나요?",["출시 전에 반드시","출시 후에","요청이 오면","아직 안 하고 있어요"],"출시 뒤에 하면 이미 고객이 들어와 있어요. 기획 단계 체크리스트에 AML 항목 하나만 넣어도 달라져요."],
    ["가상자산 거래소로 가는 송금, 따로 보고 있나요?",["전용 룰로 탐지","금액 기준으로만","건별로 눈으로","따로 안 봐요"],"거래소 이체 자체보다 '여러 명에게 받아서 바로 거래소로'가 핵심이에요. 입금자 수와 같이 보세요."],
    ["검사·감사에서 가장 많이 지적받은 분야는?",["고객확인","의심거래 보고","위험평가","내부통제·교육"],"지적은 대부분 '했다는 기록이 없다'에서 나와요. 했으면 남기고, 못 했으면 이유를 남기는 게 기본이에요."],
    ["현업이 AML 요청에 협조하지 않을 때 주로 어떻게 하나요?",["근거 규정을 보여 줘요","윗선에 보고해요","직접 찾아가 설명해요","그냥 넘어가요"],"규정보다 '안 하면 우리 부서에 무슨 일이 생기는지'를 보여줄 때 잘 움직여요. 비슷한 회사의 제재 사례 한 장이 효과적이에요."],
    ["전체 고객 중 고위험 등급 비율은?",["1% 미만","1~5%","5~10%","10% 넘어요"],"고위험·중위험·저위험 3등급이라면 고위험은 실제로 관리할 수 있는 수준이어야 해요. 너무 적으면 모델이 위험을 못 잡는 거예요."],
    ["고액현금 기준 바로 아래 반복 입금, 어떻게 잡나요?",["전용 룰이 있어요","며칠 합산 룰","눈으로 확인","따로 안 잡아요"],"하루 단위로는 안 보여요. 3일, 7일처럼 기간을 나눠 합산하는 룰이 많이 쓰여요."],
    ["AML 시스템, 어떤 형태로 쓰나요?",["외부 솔루션","자체 개발","외부 솔루션을 고쳐서","엑셀 위주"],"어떤 형태든 결국 룰을 이해하는 사람이 있어야 돌아가요. 룰 설명서 한 장부터 만들어 두세요."],
    ["의심거래 보고 뒤 고객이 문의하면?",["정해진 응대 문구로","해당 부서로 넘겨요","AML팀이 직접","정해진 게 없어요"],"보고 사실은 알려 주면 안 돼요. 현업이 쓸 응대 문구를 미리 정해 두면 실수가 줄어요."],
    ["우리 회사 AML 담당자는 몇 명인가요?",["1명","2~3명","4~9명","10명 이상"],"혼자라면 다 하려 하기보다, 위험이 큰 순서로 할 일과 안 할 일을 문서로 정해 두세요. 그게 나를 지키는 방법이에요."],
    ["국내 PEP 확인, 어떻게 하나요?",["외부 DB 이용","고객 자기 신고","언론 검색","따로 안 해요"],"국내 PEP는 자기 신고만으로는 빠지기 쉬워요. 고위험 고객만이라도 언론 검색을 한 번 더 해 보세요."],
    ["트래블룰 대응에서 가장 힘든 점은?",["상대 사업자 정보 부족","개인 지갑 확인","시스템 연동","해당 없어요"],"개인 지갑으로 가는 건 소유 확인 기록이 핵심이에요. 확인 방법을 고객에게 쉽게 안내하는 게 실무의 절반이에요."],
    ["AML 자격증, 실무에 도움이 됐나요?",["많이 됐어요","조금 됐어요","별로요","아직 없어요"],"자격증 공부의 진짜 효과는 용어와 구조가 잡히는 거예요. 현업을 설득할 때 말에 힘이 생겨요."],
    ["보고책임자에게 AML 현황은 얼마나 자주 보고하나요?",["매주","매달","분기마다","필요할 때만"],"숫자 몇 개만 정해서 매달 보고하면 변화가 보여요. 알림 수, STR 건수, 밀린 재확인 건수면 충분해요."],
    ["하위 가맹점·거래처 관리, 어디까지 보나요?",["직접 거래처만","하위까지 일부","하위까지 전부","아직 기준이 없어요"],"하위로 갈수록 위험이 안 보여요. 전부 못 보면 업종이나 매출 급증 기준으로 일부라도 보세요."],
    ["AML 담당자로 일하며 가장 힘든 점은?",["업무량","현업 협조","규정 해석","인정받기 어려움"],"혼자 고민하기보다 다른 회사 담당자와 비교해 보는 게 도움이 돼요. 이 투표 결과가 그 기준이 되면 좋겠어요."],
    ["고객 위험등급, 현업에 어디까지 공유하나요?",["등급만","등급과 사유까지","공유 안 해요","요청할 때만"],"등급만 보내면 현업은 이유를 몰라요. 사유 한 줄만 붙여도 고객 응대가 달라져요."],
    ["올해 AML 업무량, 작년과 비교하면?",["많이 늘었어요","조금 늘었어요","비슷해요","줄었어요"],"늘었다면 근거 숫자를 모아 두세요. 인력이나 시스템을 요청할 때 가장 강한 무기예요."]];
  var TK={db:null,uid:null,owner:false,docs:[],mine:null,q:Promise.resolve(),ro:false,ready:false};
  function kday(d){return d.replace(/-/g,"")}
  function pollOf(ymd){var s="poll|"+ymd,a=0;for(var i=0;i<s.length;i++)a=Math.imul(a^s.charCodeAt(i),2654435761);return POLLS[(a>>>0)%POLLS.length]}
  function myVote(d){var v=TK.mine&&TK.mine.votes&&TK.mine.votes[d];if(v==null){var lv=LS.get("ai_vote_"+d);if(lv!=null)v=lv}return v==null?null:+v}
  function pollTally(d){var c=[0,0,0,0],bySec={},n=0;TK.docs.forEach(function(doc){var v=doc.votes&&doc.votes[d];if(v==null)return;v=+v;if(v<0||v>3)return;c[v]++;n++;var s=doc.sector||"기타";(bySec[s]=bySec[s]||[0,0,0,0])[v]++});
    if(!TK.db){var lv=myVote(d);if(lv!=null){c[lv]++;n++}}return{c:c,n:n,bySec:bySec}}
  function pct(a,b){return b?Math.round(100*a/b):0}
  function ago(ts){var s=(Date.now()-ts)/1000;if(s<60)return"방금";if(s<3600)return Math.floor(s/60)+"분 전";if(s<86400)return Math.floor(s/3600)+"시간 전";var d=new Date(ts+9*3600e3);return (d.getUTCMonth()+1)+"."+d.getUTCDate()+"."}
  function allPosts(){var out=[],likes={},reps={};
    TK.docs.forEach(function(doc){var lk=doc.likes||{},rp=doc.rep||{};Object.keys(lk).forEach(function(g){if(lk[g])likes[g]=(likes[g]||0)+1});Object.keys(rp).forEach(function(g){if(rp[g])reps[g]=(reps[g]||0)+1})});
    TK.docs.forEach(function(doc){var ps=doc.posts||{},v=doc.votes||{};Object.keys(ps).forEach(function(pid){var p=ps[pid];if(!p||p.del)return;var gid=doc._id+"~"+pid,d=(p.k||"").replace("q-","");
      out.push({gid:gid,pid:pid,uid:doc._id,nick:doc.nick||"익명",sector:doc.sector||"",k:p.k,d:d,t:p.t||"",at:p.at||0,hid:!!p.hid||(reps[gid]||0)>=3,likes:likes[gid]||0,reps:reps[gid]||0,vote:v[d]})})});return out}
  function lgDraw(){var d=kday(pz.day),P=pollOf(d),mv=myVote(d),T=pollTally(d),voted=mv!=null;
    $("lgQ").textContent=P[0];$("lgNudgeQ").textContent=P[0];
    $("lgOpts").innerHTML=P[1].map(function(o,i){var p=pct(T.c[i],T.n);return '<button type="button" class="lg-opt'+(voted?' done':'')+(mv===i?' mine':'')+'" data-i="'+i+'"'+(voted?' disabled':'')+'><span class="bar" style="width:'+(voted?p:0)+'%"></span><span class="t">'+esc(o)+(mv===i?' <small>내 선택</small>':'')+'</span>'+(voted?'<span class="mono p">'+p+'%</span>':'')+'</button>'}).join("");
    $("lgMeta").textContent=voted?(T.n+"명 참여"+(TK.db?"":" · 이 기기 결과만 보여요")):(T.n?T.n+"명이 답했어요. 고르면 결과가 보여요.":"고르면 다른 실무자 결과가 보여요.");
    var ms=$("lgSector").value||(TK.mine&&TK.mine.sector)||"";
    if(voted&&ms&&T.bySec[ms]){var sc=T.bySec[ms],sn=sc.reduce(function(a,b){return a+b},0),top=sc.indexOf(Math.max.apply(null,sc));$("lgSec").textContent="· 내 업권("+ms+") "+sn+"명이 가장 많이 고른 답: "+P[1][top]+" "+pct(sc[top],sn)+"%"}else $("lgSec").textContent="";
    $("lgAfter").hidden=!voted;$("lgEd").textContent=P[2];
    var posts=allPosts(),myLikes=(TK.mine&&TK.mine.likes)||{},myRep=(TK.mine&&TK.mine.rep)||{};
    var list=posts.filter(function(p){return p.d===d&&(!p.hid||TK.owner||p.uid===TK.uid)}).sort(function(a,b){return b.likes-a.likes||b.at-a.at});
    $("lgCnt").textContent=list.length?list.length+"개":"";
    $("lgList").innerHTML=list.length?list.map(function(p){var mine=p.uid===TK.uid,liked=!!myLikes[p.gid];
      return '<li'+(p.hid?' class="hid"':'')+'><div class="lg-h"><b>'+esc(p.nick)+'</b><span>'+(p.sector?esc(p.sector)+' · ':'')+(p.vote!=null&&P[1][p.vote]?"'"+esc(P[1][p.vote])+"' 선택 · ":"")+ago(p.at)+(p.hid?' · 가려짐':'')+'</span></div><p>'+esc(p.t)+'</p><div class="lg-a">'
        +'<button type="button" class="lk" data-g="'+p.gid+'" aria-pressed="'+liked+'"'+(mine?' disabled':'')+'>공감 <span class="mono">'+p.likes+'</span></button>'
        +(mine?'<button type="button" class="del" data-p="'+p.pid+'">삭제</button>':'<button type="button" class="rp" data-g="'+p.gid+'"'+(myRep[p.gid]?' disabled':'')+'>'+(myRep[p.gid]?'신고함':'신고')+'</button>')
        +(TK.owner&&!mine?'<button type="button" class="hd" data-u="'+p.uid+'" data-p="'+p.pid+'" data-h="'+(p.hid?0:1)+'">'+(p.hid?'다시 보이기':'가리기')+(p.reps?' · 신고 '+p.reps:'')+'</button>':'')+'</div></li>'}).join("")
      :'<li class="empty">아직 덧붙인 의견이 없어요. 고른 이유를 한 줄 남겨 주면 다른 실무자에게 큰 도움이 돼요.</li>';
    /* 지난 투표 */
    var days={};TK.docs.forEach(function(doc){Object.keys(doc.votes||{}).forEach(function(k){if(k<d)days[k]=1})});if(!TK.db)Object.keys(LS.get("ai_vote_days")||{}).forEach(function(k){if(k<d)days[k]=1});
    var ks=Object.keys(days).sort().reverse();
    $("lgPast").innerHTML=ks.length?ks.slice(0,14).map(function(k){var P2=pollOf(k),T2=pollTally(k),top=T2.c.indexOf(Math.max.apply(null,T2.c)),best=posts.filter(function(p){return p.d===k&&!p.hid}).sort(function(a,b){return b.likes-a.likes})[0];
      return '<li><small class="mono">'+k.slice(4,6)+"."+k.slice(6)+'. · '+T2.n+'명</small><b>'+esc(P2[0])+'</b><p>가장 많은 답 · '+esc(P2[1][top])+' <span class="mono">'+pct(T2.c[top],T2.n)+'%</span></p>'+(best?'<p class="q">"'+esc(best.t.length>90?best.t.slice(0,90)+"…":best.t)+'" · '+esc(best.nick)+'</p>':'')+'</li>'}).join("")
      :'<li class="empty">투표가 하루씩 쌓이면 업권별 실무 현황이 여기에 모여요.</li>';
    var tot=0;TK.docs.forEach(function(doc){tot+=Object.keys(doc.votes||{}).length});var myDays=TK.mine?Object.keys(TK.mine.votes||{}).length:Object.keys(LS.get("ai_vote_days")||{}).length;
    $("lgN1").textContent=T.n;$("lgN2").textContent=TK.db?tot:myDays;$("lgN3").textContent=myDays+"일";$("lgLive").textContent=TK.db?(TK.docs.length+"명 참여"):"이 기기만";
    $("lgNudgeN").textContent=voted?"오늘 결과 보기 →":(T.n?T.n+"명 참여 · 1초 투표 →":"1초 투표 →");
    lgAuto();
    if(TK.owner){$("lgAdmin").hidden=false;$("lgAdminTxt").textContent="오늘 "+T.n+"명 · 누적 투표 "+tot+" · 한 줄 의견 "+posts.length+"개"}
    lgFormState()}
  function lgFormState(){var can=!!(TK.db&&TK.uid&&!TK.ro);["lgText","lgNick"].forEach(function(id){$(id).disabled=!can});$("lgSend").disabled=!can;
    $("lgNote").textContent=!TK.db?"로그인한 상태로 열면 한 줄 의견도 남길 수 있어요.":TK.ro?"이 링크 권한으로는 투표 결과를 보기만 할 수 있어요.":"회사명·고객 정보는 빼고 써 주세요. 남긴 글은 닉네임·업권과 함께 AML 인사이트 콘텐츠에 인용될 수 있어요."}
  function tkWrite(fn){TK.q=TK.q.then(fn).catch(function(e){if(e&&e.code==="invalid_argument"){TK.ro=true;lgFormState()}else{$("lgNote").textContent="저장하지 못했어요. 잠시 뒤 다시 해 주세요."}});return TK.q}
  function deepMerge(a,b){var o=Object.assign({},a);Object.keys(b).forEach(function(k){o[k]=b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==="object"?deepMerge(a[k],b[k]):b[k]});return o}
  function tkSave(patch,full){if(!TK.ready)return Promise.resolve();return tkWrite(function(){var ref=TK.db.doc("talk/"+TK.uid);if(!TK.mine||full){var base=Object.assign({nick:"",sector:"",votes:{},posts:{},likes:{},rep:{}},TK.mine||{});delete base._id;return ref.set(full||deepMerge(base,patch))}return ref.update(patch)})}
  $("lgOpts").addEventListener("click",function(e){var b=e.target.closest(".lg-opt");if(!b||b.disabled)return;var d=kday(pz.day),i=+b.getAttribute("data-i"),sc=$("lgSector").value;
    LS.set("ai_vote_"+d,i);var vd=LS.get("ai_vote_days")||{};vd[d]=1;LS.set("ai_vote_days",vd);if(sc)LS.set("ai_lg_sector",sc);
    if(TK.db&&TK.uid&&!TK.ro){var o={votes:{},sector:sc||(TK.mine&&TK.mine.sector)||""};o.votes[d]=i;tkSave(o)}
    try{navigator.vibrate&&navigator.vibrate(12)}catch(x){}lgDraw()});
  $("lgSector").addEventListener("change",function(){LS.set("ai_lg_sector",this.value);if(TK.db&&TK.uid&&TK.mine&&!TK.ro)tkSave({sector:this.value});lgDraw()});
  $("lgText").addEventListener("input",function(){$("lgCount").textContent=this.value.length+" / 300"});
  $("lgForm").onsubmit=function(e){e.preventDefault();if(!TK.db||!TK.uid||TK.ro)return;var t=$("lgText").value.trim(),n=$("lgNick").value.trim();
    if(t.length<3){$("lgNote").textContent="세 글자 이상 써 주세요.";return}if(!n){$("lgNick").focus();$("lgNote").textContent="닉네임을 정해 주세요.";return}
    LS.set("ai_pz_nick",n);var d=kday(pz.day),pid=Date.now().toString(36)+Math.random().toString(36).slice(2,5),post={};post[pid]={k:"q-"+d,t:t.slice(0,300),at:Date.now()};
    $("lgSend").disabled=true;tkSave({nick:n,posts:post}).then(function(){$("lgText").value="";$("lgCount").textContent="0 / 300";lgFormState()})};
  $("lgList").addEventListener("click",function(e){var b=e.target.closest("button");if(!b||!TK.db||!TK.uid||TK.ro)return;
    if(b.classList.contains("lk")){var g=b.getAttribute("data-g"),cur=TK.mine&&TK.mine.likes&&TK.mine.likes[g],o={likes:{}};o.likes[g]=cur?0:1;tkSave(o)}
    else if(b.classList.contains("rp")){var g2=b.getAttribute("data-g"),o2={rep:{}};o2.rep[g2]=1;tkSave(o2)}
    else if(b.classList.contains("del")){var pid=b.getAttribute("data-p"),full=JSON.parse(JSON.stringify(TK.mine||{}));delete full._id;if(full.posts)delete full.posts[pid];tkSave(null,full)}
    else if(b.classList.contains("hd")&&TK.owner){var u=b.getAttribute("data-u"),p=b.getAttribute("data-p"),o3={posts:{}};o3.posts[p]={hid:b.getAttribute("data-h")==="1"};tkWrite(function(){return TK.db.doc("talk/"+u).update(o3)})}});
  /* 결과 카드 이미지 */
  $("lgCard").onclick=function(){var d=kday(pz.day),P=pollOf(d),T=pollTally(d),mv=myVote(d),W=1080,H=1080,c=document.createElement("canvas");c.width=W;c.height=H;var g=c.getContext("2d"),F='"Paperlogy",sans-serif';
    g.fillStyle="#FAFAF8";g.fillRect(0,0,W,H);g.fillStyle="#0F1012";g.fillRect(80,96,44,30);g.fillStyle="#FFE14A";g.fillRect(88,114,28,6);
    g.font="800 34px "+F;g.fillStyle="#0F1012";g.textBaseline="middle";g.fillText("AML 인사이트",140,112);g.font="500 26px "+F;g.fillStyle="#8A8C92";g.textAlign="right";g.fillText("실무자 투표 · "+d.slice(0,4)+"."+d.slice(4,6)+"."+d.slice(6)+".",W-80,112);g.textAlign="left";
    g.font="800 56px "+F;g.fillStyle="#0F1012";var words=P[0].split(" "),lines=[],cur="";words.forEach(function(w){var t=cur?cur+" "+w:w;if(g.measureText(t).width>W-160&&cur){lines.push(cur);cur=w}else cur=t});lines.push(cur);
    var y=230;lines.forEach(function(l){g.fillText(l,80,y);y+=74});y+=30;
    P[1].forEach(function(o,i){var p=pct(T.c[i],T.n);g.fillStyle="#EFEFEB";g.fillRect(80,y,W-160,92);g.fillStyle=i===mv?"#0F1012":"#C9CBD0";g.fillRect(80,y,(W-160)*p/100,92);
      g.font="700 34px "+F;g.fillStyle=i===mv&&p>40?"#FFFFFF":"#0F1012";g.fillText(o,108,y+46);g.textAlign="right";g.fillStyle="#0F1012";g.fillText(p+"%",W-108,y+46);g.textAlign="left";y+=112});
    g.font="500 28px "+F;g.fillStyle="#6B6E76";g.fillText(T.n+"명의 AML 실무자가 답했어요",80,H-110);g.fillStyle="#FFE14A";g.fillRect(80,H-80,180,8);
    c.toBlob(function(bl){var use=window.claude&&window.claude.use?window.claude.use("downloads"):Promise.resolve(null);use.then(function(dl){if(!dl){var a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download="aml-poll-"+d+".png";a.click();return}return dl.save({filename:"AML인사이트_실무투표_"+d+".png",data:bl})}).catch(function(){})},"image/png")};
  $("lgExport").onclick=function(){var rows=[["날짜","질문","선택지","전체","업권별"]];var days={};TK.docs.forEach(function(doc){Object.keys(doc.votes||{}).forEach(function(k){days[k]=1})});
    Object.keys(days).sort().forEach(function(k){var P=pollOf(k),T=pollTally(k);P[1].forEach(function(o,i){rows.push([k,P[0],o,T.c[i]+"명 ("+pct(T.c[i],T.n)+"%)",Object.keys(T.bySec).map(function(s){return s+" "+T.bySec[s][i]}).join(" / ")])})});
    rows.push([]);rows.push(["날짜","닉네임","업권","공감","신고","가려짐","의견"]);allPosts().sort(function(a,b){return a.at-b.at}).forEach(function(p){rows.push([p.d,p.nick,p.sector,p.likes,p.reps,p.hid?"Y":"",p.t])});
    var csv="﻿"+rows.map(function(r){return r.map(function(v){v=String(v==null?"":v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(",")}).join("\n");
    window.claude.use("downloads").then(function(dl){if(!dl){$("lgAdminTxt").textContent="이 화면에서는 내려받기를 쓸 수 없어요.";return}return dl.save({filename:"AML인사이트_라운지_"+kday(pz.day)+".csv",data:csv})}).catch(function(){})};
  $("lgNick").value=nick();(function(){var s=LS.get("ai_lg_sector")||(PROFILE&&PROFILE.sector)||"";if(s){if(![].some.call($("lgSector").options,function(x){return x.value===s})){var op=document.createElement("option");op.value=op.textContent=s;$("lgSector").appendChild(op)}$("lgSector").value=s}})();
  function initTalk(){if(!window.claude||!window.claude.use){lgDraw();return}
    Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){var db=r[0],u=r[1];if(!db||!u){lgDraw();return}
      return Promise.all([u.id(),u.isOwner()]).then(function(x){if(!x[0]){lgDraw();return}TK.db=db;TK.uid=x[0];TK.owner=!!x[1];lgDraw();
        db.collection("talk").onSnapshot(function(snap){TK.docs=snap.docs.map(function(dd){var o=Object.assign({},dd.data());o._id=dd.id;return o});TK.mine=TK.docs.find(function(dd){return dd._id===TK.uid})||null;TK.ready=true;
          if(TK.mine){if(TK.mine.nick&&!$("lgNick").value)$("lgNick").value=TK.mine.nick;if(TK.mine.sector&&!$("lgSector").value)$("lgSector").value=TK.mine.sector;
            var lv=LS.get("ai_vote_"+kday(pz.day));if(lv!=null&&!(TK.mine.votes&&TK.mine.votes[kday(pz.day)]!=null)&&!TK.ro){var o={votes:{}};o.votes[kday(pz.day)]=lv;tkSave(o)}}
          lgDraw()},function(){lgDraw()})})}).catch(function(){lgDraw()})}
  $("lgDate").textContent=pz.day.replace(/-/g,".")+".";
  initTalk();

  /* ---------- 인사이트 스크랩 (회원) + 체크 집계 ---------- */
  var SC={list:LS.get("ai_scraps")||{},loaded:false,day:ck.replace("ai_judge_","")};
  function artKey(art){var h=art.querySelector("h2 a"),s=String(h?(h.getAttribute("href")||h.textContent):""),a=0;for(var i=0;i<s.length;i++)a=Math.imul(a^s.charCodeAt(i),2654435761);return "s"+(a>>>0).toString(36)}
  function artTitle(art){var h=art.querySelector("h2 a");return h?h.textContent.replace(/\s*↗\s*$/,"").trim():""}
  function artSnap(art){var h=art.querySelector("h2 a");return{t:artTitle(art),u:h?h.href:"",k:[].map.call(art.querySelectorAll(".kick > span"),function(x){return x.textContent}).join(" · "),
    s:[].map.call(art.querySelectorAll(".sum p"),function(p){return p.textContent}).join("\n"),d:SC.day,at:Date.now(),
    c:[].map.call(art.querySelectorAll(".checks li"),function(li){var id=li.getAttribute("data-c");return{id:id,lv:(li.querySelector(".lv")||{}).textContent||"",t:(li.querySelector(".ins")||{}).textContent||"",v:J[id]||""}})}}
  function scCloud(){return MODE==="cloud"&&db&&uid}
  function scLoad(){if(SC.loaded||!scCloud())return;SC.loaded=true;db.collection("data/users/"+uid).get().then(function(q){var l={};q.docs.forEach(function(dc){if(dc.id.charAt(0)==="s"&&dc.id!=="profile"){var o=dc.data();if(o&&o.t)l[dc.id]=o}});SC.list=l;scrapRefresh()}).catch(function(){})}
  function scrapRefresh(){if(!SC)return;scLoad();
    [].forEach.call(document.querySelectorAll("#p-today .art"),function(art){var b=art.querySelector(".scrap");if(!b)return;var on=!!SC.list[artKey(art)];b.setAttribute("aria-pressed",on);b.textContent=on?"스크랩함":"스크랩"});
    var keys=Object.keys(SC.list).sort(function(a,b){return (SC.list[b].at||0)-(SC.list[a].at||0)});$("scN").textContent=keys.length?keys.length+"개":"";
    $("scList").innerHTML=!PROFILE?'<li class="join-pitch"><b>무료 회원이 되면</b><span>기사 인사이트 스크랩, 어느 기기에서나 다시 보기</span><span>퍼즐·게임 순위에 내 닉네임</span><span>WLF 조회 이력 24시간 보관과 결과 캡처</span><button class="btn sm" type="button" data-join="scrap">10초 만에 가입</button></li>'
      :keys.length?keys.slice(0,30).map(function(k){var x=SC.list[k],y=0,n=0;(x.c||[]).forEach(function(c){if(c.v==="y")y++;if(c.v==="n")n++});var d=(x.d||"").split("-");
        return '<li><a href="'+esc(x.u||"#")+'" target="_blank" rel="noopener">'+esc(x.t)+'</a><small>'+(d.length===3?d[1]+"."+d[2]+". · ":"")+(y+n?"우리 회사 해당 "+y+" · 해당 없음 "+n:"아직 판단 전")+'</small>'
          +'<details><summary>인사이트 다시 보기</summary>'+(x.s?'<p>'+esc(x.s)+'</p>':'')+'<ol>'+(x.c||[]).map(function(c){return '<li><b>'+esc(c.lv)+'</b> '+esc(c.t)+(c.v?' <em>'+(c.v==="y"?"해당":"해당 없음")+'</em>':'')+'</li>'}).join("")+'</ol></details>'
          +'<button type="button" class="scx" data-k="'+k+'">삭제</button></li>'}).join("")
      :'<li class="empty">기사 오른쪽 위 \'스크랩\'을 누르면 인사이트와 내 판단이 함께 여기에 모여요.</li>'}
  function scSave(k,snap){SC.list[k]=snap;if(scCloud())db.doc("data/users/"+uid+"/"+k).set(snap).catch(function(){});else LS.set("ai_scraps",SC.list);
    var o={sc:{}};o.sc[k]={t:snap.t,at:snap.at,on:1};if(typeof tkSave==="function"&&TK.db)tkSave(o)}
  function scDel(k){var t=SC.list[k]&&SC.list[k].t;delete SC.list[k];if(scCloud())db.doc("data/users/"+uid+"/"+k).delete().catch(function(){});else LS.set("ai_scraps",SC.list);
    var o={sc:{}};o.sc[k]={t:t||"",at:Date.now(),on:0};if(typeof tkSave==="function"&&TK.db)tkSave(o)}
  function onJudge(cid,v){var li=document.querySelector('.checks li[data-c="'+cid+'"]'),art=li&&li.closest(".art");if(!art)return;var k=artKey(art);
    if(SC.list[k]){SC.list[k].c=artSnap(art).c;if(scCloud())db.doc("data/users/"+uid+"/"+k).set(SC.list[k]).catch(function(){});else LS.set("ai_scraps",SC.list);scrapRefresh()}
    if(TK.db&&TK.uid){var o={jd:{}};o.jd[k+"|"+cid]=v||"";tkSave(o)}}
  function addScrapButtons(){[].forEach.call(document.querySelectorAll("#p-today .art .kick"),function(kk){if(kk.querySelector(".scrap"))return;var b=document.createElement("button");b.type="button";b.className="scrap";b.textContent="스크랩";b.setAttribute("aria-pressed","false");kk.appendChild(b);
    b.onclick=function(){var art=b.closest(".art"),k=artKey(art);if(!PROFILE){openJoin("scrap");return}
      if(SC.list[k])scDel(k);else{scSave(k,artSnap(art));popScrap(b)}scrapRefresh()}})}
  addScrapButtons();
  function popScrap(b){b.classList.remove("pop");void b.offsetWidth;b.classList.add("pop")}
  $("scList").addEventListener("click",function(e){var b=e.target.closest(".scx");if(!b)return;scDel(b.getAttribute("data-k"));scrapRefresh()});
  scrapRefresh();
  /* 라운지 자동 집계: 기사 체크 · 많이 스크랩한 인사이트 */
  function lgAuto(){
    var html="";[].forEach.call(document.querySelectorAll("#p-today .art"),function(art,ai){var k=artKey(art);
      [].forEach.call(art.querySelectorAll(".checks li"),function(li){var cid=li.getAttribute("data-c"),y=0,n=0;TK.docs.forEach(function(doc){var v=doc.jd&&doc.jd[k+"|"+cid];if(v==="y")y++;else if(v==="n")n++});
        if(!TK.db){if(J[cid]==="y")y++;else if(J[cid]==="n")n++}
        var tot=y+n,t=((li.querySelector(".ins")||{}).textContent||"");html+='<li><small>기사 '+(ai+1)+' · '+esc((li.querySelector(".lv")||{}).textContent||"")+'</small><p>'+esc(t.length>58?t.slice(0,58)+"…":t)+'</p><div class="lg-bar"><span style="width:'+(tot?Math.round(100*y/tot):0)+'%"></span></div><span class="mono">'+(tot?"우리 회사 해당 "+Math.round(100*y/tot)+"% · "+tot+"명":"아직 판단한 사람이 없어요")+'</span></li>'})});
    $("lgChk").innerHTML=html||'<li class="empty">오늘 기사가 없어요.</li>';
    var agg={};TK.docs.forEach(function(doc){var s=doc.sc||{};Object.keys(s).forEach(function(k){if(!s[k]||!s[k].on)return;agg[k]=agg[k]||{t:s[k].t,n:0,at:0};agg[k].n++;agg[k].at=Math.max(agg[k].at,s[k].at||0)})});
    if(!TK.db&&SC)Object.keys(SC.list).forEach(function(k){agg[k]={t:SC.list[k].t,n:1,at:SC.list[k].at}});
    var top=Object.keys(agg).sort(function(a,b){return agg[b].n-agg[a].n||agg[b].at-agg[a].at}).slice(0,6);
    $("lgTop").innerHTML=top.length?top.map(function(k,i){return '<li><span class="mono r">'+String(i+1).padStart(2,"0")+'</span><b>'+esc(agg[k].t)+'</b><span class="mono">'+agg[k].n+'명</span></li>'}).join(""):'<li class="empty">회원들이 스크랩한 기사가 여기 순위로 쌓여요.</li>'}
  lgDraw();
  /* ---------- 오늘 기사: 매일 아침 저장소(daily)에서 불러오기 ---------- */
  var DAILY={date:"2026-10-04",n:3};
  function ymdLabel(d){var p=d.split("-"),w=["일","월","화","수","목","금","토"][new Date(Date.UTC(+p[0],+p[1]-1,+p[2])).getUTCDay()];return p[0]+"."+p[1]+"."+p[2]+". "+w+"요일"}
  function mkArt(it,i){var n=0,url=/^https?:\/\//.test(it.url||"")?it.url:"#";
    var sum=(it.sum||[]).map(function(p){return "<p>"+esc(p).replace(/\[\[(.+?)\]\]/g,function(_,x){n++;return '<mark data-n="'+n+'">'+x+'</mark>'})+"</p>"}).join("");
    var checks=(it.checks||[]).map(function(c,j){return '<li data-c="a'+(i+1)+'-'+(j+1)+'"><span class="no">'+(j+1)+'</span><div><p class="lv'+(c.hi?" hi":"")+'">'+esc(c.lv||(c.hi?"바로 확인":"점검 권장"))+'</p><p class="ins">'+esc(c.t)+'</p></div><div class="yn" role="group" aria-label="우리 회사 해당 여부"><button type="button" data-v="y">해당</button><button type="button" data-v="n">해당 없음</button></div></li>'}).join("");
    var a=document.createElement("article");a.className="card art"+(i===0?" lead":"");a.setAttribute("data-art","a"+(i+1));
    a.innerHTML='<p class="kick">'+(it.tags||[]).slice(0,3).map(function(t){return "<span>"+esc(t)+"</span>"}).join("")+'<span class="mono">'+esc(it.src||"")+'</span></p><h2><a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(it.title||"")+'<span aria-hidden="true"> ↗</span></a></h2><div class="sum">'+sum+'</div><ol class="checks">'+checks+'</ol>';return a}
  function renderArts(D){if(!D||!D.items||!D.items.length||!D.date)return;if(D.date===DAILY.date&&DAILY.rendered)return;
    var wrap=document.querySelector("#p-today .arts-main");
    [].forEach.call(wrap.querySelectorAll(".art"),function(a){a.remove()});
    D.items.slice(0,5).forEach(function(it,i){wrap.appendChild(mkArt(it,i))});
    DAILY={date:D.date,n:D.items.length,rendered:true};
    $("tdEye").innerHTML='<span class="dot" aria-hidden="true"></span><b>TODAY</b>'+ymdLabel(D.date)+' · 평일 아침 발행';$("tdCnt").textContent=D.items.length;
    ck="ai_judge_"+D.date;J=LS.get(ck)||{};if(SC)SC.day=D.date;
    bindToday();if(typeof addScrapButtons==="function"&&SC)addScrapButtons();scrapRefresh();if(TK)lgDraw();newsAlert()}
  function newsAlert(){var seen=LS.get("ai_seen_day")||"";if(DAILY.date<=seen)return;var onToday=!$("p-today").hidden;
    if(onToday){LS.set("ai_seen_day",DAILY.date);if(seen)showToast("오늘의 인사이트 "+DAILY.n+"건이 새로 올라왔어요")}
    else document.querySelector('.seg a[data-go="today"]').classList.add("new")}
  function showToast(t){var el=$("toast");el.textContent=t;el.hidden=false;el.classList.remove("in");void el.offsetWidth;el.classList.add("in");clearTimeout(el._t);el._t=setTimeout(function(){el.hidden=true},4200)}
  /* ---------- 방문 집계 (운영자만 봄) ---------- */
  var VS={db:null,uid:null,doc:null,timer:0};
  function kstDay(){return pz.day.replace(/-/g,"")}
  function visitInit(db,uid){VS.db=db;VS.uid=uid;var ref=db.doc("visits/"+uid),d=kstDay(),dv=window.matchMedia&&matchMedia("(max-width:700px)").matches?"m":"d";
    ref.get().then(function(s){var o=s.exists?Object.assign({},s.data()):{first:Date.now()};o.d=Object.assign({},o.d||{});o.t=Object.assign({},o.t||{});o.d[d]=(o.d[d]||0)+1;o.last=Date.now();o.dv=dv;if(PROFILE)o.mem=1;VS.doc=o;return ref.set(o)}).then(function(){var cur=location.hash.slice(1)||"today";visitTab(cur)}).catch(function(){})}
  function visitTab(k){if(!VS||!VS.db||!VS.doc)return;var d=kstDay();VS.doc.t[d]=Object.assign({},VS.doc.t[d]||{});VS.doc.t[d][k]=(VS.doc.t[d][k]||0)+1;clearTimeout(VS.timer);
    VS.timer=setTimeout(function(){var o={t:{}};o.t[d]=VS.doc.t[d];VS.db.doc("visits/"+VS.uid).update(o).catch(function(){})},2500)}
  var MB={synced:null};
  function memberSync(){if(!VS||!VS.db||!VS.uid||MODE!=="cloud")return;var want=PROFILE?"in":"out";if(MB.synced===want)return;MB.synced=want;var ref=VS.db.doc("members/"+VS.uid);
    if(PROFILE)ref.set({sector:PROFILE.sector||"",joinedAt:PROFILE.joinedAt||Date.now()}).catch(function(){MB.synced=null});else ref.delete().catch(function(){})}
  /* ---------- 운영 현황 ---------- */
  var ADM={owner:false,data:null};
  function lastDays(n){var p=pz.day.split("-"),base=Date.UTC(+p[0],+p[1]-1,+p[2]),out=[];for(var i=n-1;i>=0;i--){var dt=new Date(base-i*864e5);out.push(dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0"))}return out}
  function loadAdmin(){if(!ADM.owner||!VS.db)return;$("admState").textContent="불러오는 중";
    Promise.all([VS.db.collection("visits").get(),VS.db.collection("members").get()]).then(function(r){ADM.data={v:r[0].docs.map(function(x){return x.data()}),m:r[1].docs.map(function(x){return x.data()})};drawAdmin();$("admState").textContent="방금 갱신"}).catch(function(){$("admState").textContent="불러오지 못했어요"})}
  function drawAdmin(){var V=ADM.data.v,M=ADM.data.m,d30=lastDays(30),d7=d30.slice(-7),today=d30[29];
    var uv=function(days){return V.filter(function(v){return days.some(function(d){return v.d&&v.d[d]})}).length};
    var series=d30.map(function(d){var u=0,p=0;V.forEach(function(v){var c=v.d&&v.d[d];if(c){u++;p+=c}});return{d:d,u:u,p:p}});
    var t=series[29],u7=uv(d7),u30=uv(d30),ret=V.filter(function(v){return d30.filter(function(d){return v.d&&v.d[d]}).length>=2}).length,mob=V.filter(function(v){return d30.some(function(d){return v.d&&v.d[d]})&&v.dv==="m"}).length;
    var avg=Math.round(series.reduce(function(s,x){return s+x.u},0)/30*10)/10;
    $("admTiles").innerHTML=[["오늘 방문자",t.u+"명"],["오늘 페이지뷰",t.p+"회"],["최근 7일 방문자",u7+"명"],["최근 30일 방문자",u30+"명"],["하루 평균 (30일)",avg+"명"],["다시 온 비율",u30?Math.round(100*ret/u30)+"%":"-"],["회원",M.length+"명"],["모바일 비율",u30?Math.round(100*mob/u30)+"%":"-"]].map(function(x){return '<div><b class="mono">'+x[1]+'</b><span>'+x[0]+'</span></div>'}).join("");
    var mx=Math.max(1,Math.max.apply(null,series.map(function(x){return x.u})));
    $("admChart").innerHTML=series.map(function(x){return '<div class="col" data-tip="'+x.d.slice(4,6)+"."+x.d.slice(6)+". · 방문자 "+x.u+"명 · 페이지뷰 "+x.p+'회"><span style="height:'+Math.max(x.u?4:0,Math.round(100*x.u/mx))+'%"></span></div>'}).join("");
    $("admAxis").innerHTML='<span>'+d30[0].slice(4,6)+"."+d30[0].slice(6)+'.</span><span>최고 '+mx+'명</span><span>오늘</span>';
    var TABN={today:"오늘",puzzle:"퍼즐",lounge:"라운지",wlf:"WLF 조회",score:"실무 점수",board:"일정·채용",partner:"광고·협업"},tc={};V.forEach(function(v){d7.forEach(function(d){var o=v.t&&v.t[d];if(o)Object.keys(o).forEach(function(k){if(TABN[k])tc[k]=(tc[k]||0)+o[k]})})});
    var tk=Object.keys(TABN).sort(function(a,b){return (tc[b]||0)-(tc[a]||0)}),tm=Math.max(1,tc[tk[0]]||0);
    $("admTabs").innerHTML=tk.map(function(k){return '<li><span>'+TABN[k]+'</span><div class="lg-bar"><span style="width:'+Math.round(100*(tc[k]||0)/tm)+'%"></span></div><b class="mono">'+(tc[k]||0)+'</b></li>'}).join("");
    var sc={};M.forEach(function(m){var s=m.sector||"기타";sc[s]=(sc[s]||0)+1});var sk=Object.keys(sc).sort(function(a,b){return sc[b]-sc[a]}),sm=Math.max(1,sc[sk[0]]||0);
    $("admSec").innerHTML=sk.length?sk.map(function(k){return '<li><span>'+esc(k)+'</span><div class="lg-bar"><span style="width:'+Math.round(100*sc[k]/sm)+'%"></span></div><b class="mono">'+sc[k]+'</b></li>'}).join(""):'<li class="empty">아직 회원이 없어요.</li>';
    var votes=0,scraps=0;(TK&&TK.docs||[]).forEach(function(doc){votes+=Object.keys(doc.votes||{}).length;Object.keys(doc.sc||{}).forEach(function(k){if(doc.sc[k]&&doc.sc[k].on)scraps++})});
    ADM.pitch="AML 인사이트 운영 현황 ("+d30[0].slice(4,6)+"."+d30[0].slice(6)+".~"+today.slice(4,6)+"."+today.slice(6)+".)\n· 최근 30일 방문자 "+u30+"명, 하루 평균 "+avg+"명\n· 최근 7일 방문자 "+u7+"명, 다시 온 비율 "+(u30?Math.round(100*ret/u30):0)+"%\n· 회원 "+M.length+"명"+(sk.length?" ("+sk.slice(0,4).map(function(k){return k+" "+sc[k]}).join(", ")+")":"")+"\n· 실무 투표 누적 "+votes+"건, 인사이트 스크랩 "+scraps+"건";
    $("admPitch").textContent=ADM.pitch}
  $("admChart").addEventListener("pointermove",function(e){var c=e.target.closest(".col"),tip=$("admTip");if(!c){tip.hidden=true;return}tip.textContent=c.getAttribute("data-tip");tip.hidden=false;var r=$("admChart").getBoundingClientRect(),cr=c.getBoundingClientRect();tip.style.left=Math.min(r.width-150,Math.max(0,cr.left-r.left-60))+"px"});
  $("admChart").addEventListener("pointerleave",function(){$("admTip").hidden=true});
  $("admReload").onclick=loadAdmin;
  $("admCopy").onclick=function(){try{navigator.clipboard.writeText(ADM.pitch||"").then(function(){showToast("협업 제안용 요약을 복사했어요")})}catch(e){}};
  $("admCsv").onclick=function(){if(!ADM.data)return;var rows=[["날짜","방문자","페이지뷰"]];lastDays(90).forEach(function(d){var u=0,p=0;ADM.data.v.forEach(function(v){var c=v.d&&v.d[d];if(c){u++;p+=c}});rows.push([d,u,p])});
    var csv="﻿"+rows.map(function(r){return r.join(",")}).join("\n");window.claude.use("downloads").then(function(dl){if(dl)return dl.save({filename:"AML인사이트_방문현황_"+kstDay()+".csv",data:csv})}).catch(function(){})};
  /* ---------- 회원가입 · 약관 ---------- */
  function openJoin(why){if(PROFILE){go("wlf",true);return}$("jmWhy").textContent=why==="scrap"?"스크랩은 회원 기능이에요. 닉네임과 업권만 넣으면 바로 가입돼요.":"닉네임과 업권만 넣으면 10초 만에 가입돼요. 이름·연락처·이메일은 받지 않아요.";
    $("jmSec").innerHTML=SECT.map(function(s){return "<option>"+s+"</option>"}).join("");$("jmNick").value=nick()||"";$("joinModal").hidden=false;setTimeout(function(){$("jmNick").focus()},50)}
  $("jmForm").onsubmit=function(e){e.preventDefault();var n=$("jmNick").value.trim();if(!n){$("jmNick").focus();return}if(!$("jmT").checked||!$("jmP").checked){$("jmErr").textContent="필수 항목 두 가지에 동의해 주세요.";return}
    join(n,$("jmSec").value,{agreed:{terms:"2026-10-05",privacy:"2026-10-05",at:Date.now()}});$("joinModal").hidden=true;LS.set("ai_pz_nick",n);showToast("가입했어요. 이제 기사 오른쪽 위 '스크랩'을 눌러 보세요")};
  $("jmClose").onclick=function(){$("joinModal").hidden=true};
  function openDoc(which){$("docModal").hidden=false;[].forEach.call(document.querySelectorAll("#docTabs button"),function(b){b.setAttribute("aria-pressed",b.getAttribute("data-d")===which)});$("docTerms").hidden=which!=="terms";$("docPrivacy").hidden=which!=="privacy";$("docBody").scrollTop=0}
  [].forEach.call(document.querySelectorAll("#docTabs button"),function(b){b.onclick=function(){openDoc(b.getAttribute("data-d"))}});
  $("docClose").onclick=function(){$("docModal").hidden=true};
  $("alertClose").onclick=function(){$("alertModal").hidden=true};
  [$("joinModal"),$("docModal"),$("alertModal")].forEach(function(m){m.addEventListener("click",function(e){if(e.target===m)m.hidden=true})});
  document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-join],[data-doc],[data-alert]");if(!t)return;e.preventDefault();
    if(t.hasAttribute("data-join"))openJoin(t.getAttribute("data-join"));else if(t.hasAttribute("data-doc"))openDoc(t.getAttribute("data-doc"));else $("alertModal").hidden=false});
  $("whoBtn").addEventListener("click",function(e){if(!PROFILE){e.preventDefault();e.stopPropagation();openJoin()}});
  /* ---------- 저장소 연결 ---------- */
  (function opsInit(){if(!window.claude||!window.claude.use)return;
    Promise.all([window.claude.use("db"),window.claude.use("user")]).then(function(r){var db=r[0],u=r[1];if(!db)return;
      db.collection("daily").orderBy("date","desc").limit(1).onSnapshot(function(q){if(q.docs.length)renderArts(q.docs[0].data())},function(){});if(!u)return;
      return Promise.all([u.id(),u.isOwner()]).then(function(x){if(!x[0])return;visitInit(db,x[0]);ADM.owner=!!x[1];$("adminLink").hidden=!ADM.owner;memberSync();if(ADM.owner&&location.hash==="#admin")go("admin",false)})}).catch(function(){})})();
  /* ---------- AML 규정: 바뀐 규정 · 규정 찾기 · 연결 보기 ---------- */
  var LX={meta:null,docs:{},arts:{},chg:[],cases:[],rev:{},crf:{},loaded:false,loading:null,hist:[],cur:null,q:"",flt:"all",open:{}};
  var LXORD=["fta","ftad","sup","biz","tf","tfd","kfr","pc","pcd","vp","vpd","rn","rnd"];
  function lxDate(s){s=String(s||"");return s.length===8?s.slice(0,4)+"."+(+s.slice(4,6))+"."+(+s.slice(6,8))+".":s}
  function lxToday(){return pz.day.replace(/-/g,"")}
  function lxYearAgo(){var t=lxToday(),d=new Date(Date.UTC(+t.slice(0,4)-1,+t.slice(4,6)-1,+t.slice(6,8)));return d.toISOString().slice(0,10).replace(/-/g,"")}
  function lxLv(d){return d.k==="adm"?"고시·규정":d.lv}
  function lxArtName(n){return /호$/.test(n)?n.replace("호","")+"번 항목":"제"+n.replace("의","조의")+(n.indexOf("의")>-1?"":"조")}
  function lxUrl(d,n){var base=d.k==="adm"?"https://www.law.go.kr/행정규칙/":"https://www.law.go.kr/법령/";var u=base+encodeURIComponent(d.name.replace(/\s+/g,""));
    if(n&&d.k!=="adm"&&!/호$/.test(n))u+="/"+encodeURIComponent(lxArtName(n));return u}
  function lxDb(){return window.claude&&window.claude.use?window.claude.use("db"):Promise.resolve(null)}
  function lxMeta(){return lxDb().then(function(db){if(!db)return null;return db.doc("lex/meta").get().then(function(m){if(!m.exists)return null;LX.meta=m.data();LX.dbh=db;lxAlert();return LX.meta})}).catch(function(){return null})}
  function lxAlert(){var M=LX.meta;if(!M||!M.latest)return;var seen=LS.get("ai_seen_lex")||"",t=$("p-law");
    var age=(Date.UTC(+lxToday().slice(0,4),+lxToday().slice(4,6)-1,+lxToday().slice(6,8))-Date.UTC(+M.latest.slice(0,4),+M.latest.slice(4,6)-1,+M.latest.slice(6,8)))/864e5;
    if(M.latest>seen&&age<=14){if(t&&!t.hidden)LS.set("ai_seen_lex",M.latest);else document.querySelector('.seg a[data-go="law"]').classList.add("new")}}
  function lxLoad(){if(LX.loading)return LX.loading;$("lxState").textContent="불러오는 중";
    LX.loading=(LX.meta?Promise.resolve(LX.meta):lxMeta()).then(function(M){if(!M)throw 0;var db=LX.dbh,ps=[],names=[];
      M.docs.forEach(function(d){LX.docs[d.key]=d;LX.arts[d.key]=[];for(var i=1;i<=d.parts;i++)names.push("a-"+d.key+"-"+i)});
      for(var i=1;i<=M.chg;i++)names.push("chg-"+i);for(i=1;i<=M.cases;i++)names.push("cases-"+i);
      names.forEach(function(n){ps.push(db.doc("lex/"+n).get())});
      return Promise.all(ps).then(function(ss){ss.forEach(function(s,i){if(!s.exists)return;var o=s.data(),n=names[i];
        if(n.indexOf("a-")===0)LX.arts[o.key]=LX.arts[o.key].concat(o.arts||[]);else if(n.indexOf("chg-")===0)LX.chg=LX.chg.concat(o.items||[]);else LX.cases=LX.cases.concat(o.cases||[])});
        var cut=lxYearAgo();LX.chg=LX.chg.filter(function(x){return x.prom>=cut});lxIndex();LX.loaded=true;lxRenderHead();lxRenderChg();lxPickers();if(!LX.cur)lxShow({k:"fta",n:"5의2"},true);if(LX.q)lxSearch(LX.q)})})
    .catch(function(){$("lxState").textContent="잠시 후 다시 열어 주세요";LX.loading=null});return LX.loading}
  /* 참조 찾기: 영·고시 본문의 '법 제N조', '영 제N조' */
  var LXRE=/(^|[^가-힣A-Za-z0-9」])(법|영)\s?제(\d+)조(?:의(\d+))?/g;
  function lxRefs(key,text){var d=LX.docs[key],out=[],m;if(!d)return out;LXRE.lastIndex=0;
    while((m=LXRE.exec(text))){var tk=m[2]==="법"?(d.k==="adm"?d.up:(d.lv==="시행령"?d.up:null)):(d.k==="adm"?d.upd:null);
      if(!tk)continue;out.push({k:tk,n:m[3]+(m[4]?"의"+m[4]:""),at:m.index+m[1].length,len:m[0].length-m[1].length})}return out}
  function lxIndex(){LX.rev={};LXORD.forEach(function(key){(LX.arts[key]||[]).forEach(function(a){var seen={};
      lxRefs(key,a.x).forEach(function(r){var id=r.k+"|"+r.n;if(seen[id])return;seen[id]=1;(LX.rev[id]=LX.rev[id]||[]).push({k:key,n:a.n,at:r.at})})})});
    LX.crf={};LX.cases.forEach(function(c){(c.refs||[]).forEach(function(id){(LX.crf[id]=LX.crf[id]||[]).push(c)})})}
  function lxFind(k,n){var l=LX.arts[k]||[];for(var i=0;i<l.length;i++)if(l[i].n===n)return l[i];return null}
  function lxRenderHead(){var M=LX.meta,c={"법률":0,"시행령":0,"고시·규정":0};M.docs.forEach(function(d){c[lxLv(d)]=(c[lxLv(d)]||0)+1});
    $("lxN1").textContent=c["법률"];$("lxN2").textContent=c["시행령"];$("lxN3").textContent=c["고시·규정"];$("lxN4").textContent=fmtN(LX.cases.length);
    $("lxAsof").textContent=lxDate(M.asof)+" 확인";var soon=LX.chg.filter(function(x){return x.eff>lxToday()}).length;
    $("lxState").textContent=soon?"시행 예정 "+soon+"건":"최신 반영"}
  /* 1. 바뀐 규정 */
  function lxMark(s,side){return esc(s).replace(/\[\[([\s\S]*?)\]\]/g,side==="o"?'<del>$1</del>':'<mark>$1</mark>')}
  function lxPairArt(s){var m=/^(?:\[\[)?제(\d+)조(?:의(\d+))?/.exec(s||"");return m?m[1]+(m[2]?"의"+m[2]:""):null}
  function lxChgArts(x){var seen={},l=[];(x.pairs||[]).forEach(function(p){var n=lxPairArt(p.n)||lxPairArt(p.o);if(n&&!seen[n]&&(/\[\[/.test(p.n)||/\[\[/.test(p.o)||p.o!==p.n)){seen[n]=1;l.push(n)}});
    if(x.amd)x.amd.concat(x.why||[]).forEach(function(t){var re=/제(\d+)조(?:의(\d+))?/g,m;while((m=re.exec(t))){var n=m[1]+(m[2]?"의"+m[2]:"");if(!seen[n]&&lxFind(x.key,n)){seen[n]=1;l.push(n)}}});
    else if(x.why)x.why.forEach(function(t){var re=/제(\d+)조(?:의(\d+))?/g,m;while((m=re.exec(t))){var n=m[1]+(m[2]?"의"+m[2]:"");if(!seen[n]&&lxFind(x.key,n)){seen[n]=1;l.push(n)}}});
    return l}
  function lxRenderChg(){var t=lxToday(),L=LX.chg;$("lxChgN").textContent=L.length+"건";
    $("lxChgList").innerHTML=L.length?L.map(function(x){var d=LX.docs[x.key]||{short:x.key},arts=lxChgArts(x),soon=x.eff>t;
      return '<li class="lx-c'+(soon?" soon":"")+'" id="lxc-'+x.id+'"><button type="button" class="lx-ch" aria-expanded="'+(!!LX.open[x.id])+'" data-cid="'+x.id+'">'
        +'<span class="mono">'+lxDate(x.eff)+(soon?" 시행 예정":" 시행")+'</span><b>'+esc(d.short)+'</b><span class="lx-ty">'+esc(x.type||"")+(arts.length?" · 조문 "+arts.length+"곳":"")+'</span><i aria-hidden="true"></i></button>'
        +(LX.open[x.id]?lxDiff(x,d,arts):"")+'</li>'}).join(""):'<li class="empty">최근 개정 내역이 없어요.</li>'}
  function lxDiff(x,d,arts){var h='<div class="lx-diff"><p class="lx-meta">'+esc(d.name)+' · '+(d.k==="adm"?(d.org||"")+" 고시 제"+esc(x.no)+"호":(d.lv==="법률"?"법률":"대통령령")+" 제"+esc(x.no)+"호")+' · '+lxDate(x.prom)+' '+(d.k==="adm"?"발령":"공포")+'</p>';
    if(x.type==="타법개정")h+='<p class="lx-note">다른 법이 바뀌면서 이 규정의 문구가 함께 바뀐 경우예요.</p>';
    if(x.pairs){h+='<div class="lx-pairs"><div class="lx-ph"><span>개정 전</span><span>개정 후</span></div>';
      x.pairs.forEach(function(p){var same=p.o===p.n||/\((생\s*략|현행과\s*같음)\)\s*$/.test(p.n);var n=lxPairArt(p.n)||lxPairArt(p.o);
        h+='<div class="lx-pr'+(same?" same":"")+'"><p>'+lxMark(p.o,"o")+'</p><p>'+lxMark(p.n,"n")+(n&&lxFind(x.key,n)&&!same?' <button type="button" class="lx-go" data-k="'+x.key+'" data-n="'+n+'">연결 보기</button>':'')+'</p></div>'});h+='</div>'}
    else{var why=(x.why||[]).filter(function(l){return !/^◇/.test(l)});
      if(why.length)h+='<div class="lx-why"><h5>바뀐 이유와 주요 내용</h5>'+why.map(function(l){return '<p'+(/^[가-하]\.|^○|^ㅇ/.test(l)?' class="b"':'')+'>'+esc(l)+'</p>'}).join("")+'</div>';
      if(x.amd&&x.amd.length){var a=x.amd.filter(function(l){return !/^⊙|^\d{4}년|원장$|위원장$|다음과 같이 개정한다/.test(l)});
        h+='<details class="lx-amd"><summary>개정 문안 보기</summary>'+a.map(function(l){return '<p>'+esc(l)+'</p>'}).join("")+'</details>'}}
    if(arts.length)h+='<div class="lx-arts"><span>바뀐 조문</span>'+arts.map(function(n){return '<button type="button" class="lx-go" data-k="'+x.key+'" data-n="'+n+'">'+lxArtName(n)+'</button>'}).join("")+'</div>';
    return h+'<a class="lx-src" href="'+lxUrl(d)+'" target="_blank" rel="noopener">국가법령정보센터 원문 ↗</a></div>'}
  /* 2. 규정 찾기 */
  function lxTok(q){return q.replace(/[^\w가-힣\s]/g," ").split(/\s+/).filter(function(t){return t.length>0}).slice(0,6)}
  function lxHas(text,flat,t){return text.indexOf(t)>-1||flat.indexOf(t)>-1}
  function lxSnip(x,toks){var f=-1;toks.forEach(function(t){var i=x.indexOf(t);if(i>-1&&(f<0||i<f))f=i});x=x.replace(/\s+/g," ");if(f<0)f=0;
    var s=Math.max(0,f-40),out=(s?"…":"")+x.slice(s,s+150)+(x.length>s+150?"…":"");var h=esc(out);
    toks.slice().sort(function(a,b){return b.length-a.length}).forEach(function(t){if(t.length<2&&toks.length>1)return;h=h.split(esc(t)).join("\u0001"+esc(t)+"\u0002")});
    return h.replace(/\u0001/g,"<mark>").replace(/\u0002/g,"</mark>")}
  function lxSearch(q){LX.q=q=(q||"").trim();var box=$("lxRes");if(!q){box.hidden=true;return}box.hidden=false;
    if(!LX.loaded){$("lxResH").textContent="'"+q+"' 찾는 중";$("lxList").innerHTML='<li class="empty">규정을 불러오고 있어요.</li>';lxLoad();return}
    var toks=lxTok(q),hits=[],jump=null,m=/(?:^|\s)(?:제)?(\d+)조(?:의\s?(\d+))?/.exec(q);
    if(m){var jn=m[1]+(m[2]?"의"+m[2]:"");jump=jn;toks=toks.filter(function(t){return !/^제?\d+조/.test(t)&&!/^의?\d+$/.test(t)})}
    var dts=toks.filter(function(t){return t.length>=3&&LXORD.some(function(k){var d=LX.docs[k];return d&&d.short.replace(/\s/g,"").indexOf(t)>-1})});
    var allow=LXORD.filter(function(k){var d=LX.docs[k];return d&&dts.every(function(t){return d.short.replace(/\s/g,"").indexOf(t)>-1})});
    if(dts.length&&dts.indexOf("시행령")<0){var al2=allow.filter(function(k){return LX.docs[k].lv!=="시행령"});if(al2.length)allow=al2}
    var docTok=dts.length&&allow.length?dts:null,ws=docTok?toks.filter(function(t){return dts.indexOf(t)<0}):toks;
    LXORD.forEach(function(k,di){var d=LX.docs[k];if(!d)return;if(docTok&&allow.indexOf(k)<0)return;
      (LX.arts[k]||[]).forEach(function(a){var x=a.t+" "+a.x,fl=x.replace(/\s+/g,""),sc=0;
        if(jump&&a.n===jump)sc+=50;else if(jump&&!ws.length)return;
        for(var i=0;i<ws.length;i++){var t=ws[i];if(!lxHas(x,fl,t))return;sc+=(a.t.replace(/\s+/g,"").indexOf(t)>-1?8:0)+Math.min(4,fl.split(t).length-1)}
        if(!ws.length&&!jump)return;if(/^제\d+조(의\d+)?\s*삭제/.test(a.x))sc-=20;hits.push({type:"a",k:k,a:a,d:d,sc:sc+(d.lv==="법률"?4:d.lv==="시행령"?2:0)-di*.1})})});
    if(ws.length&&!docTok)LX.cases.forEach(function(c){var x=c.nm+" "+c.hs+" "+c.yo,fl=x.replace(/\s+/g,""),sc=0;for(var i=0;i<ws.length;i++){if(!lxHas(x,fl,ws[i]))return;sc+=Math.min(4,x.split(ws[i]).length-1)}hits.push({type:"c",c:c,sc:sc})});
    hits.sort(function(a,b){return b.sc-a.sc});LX.hits=hits;LX.toks=ws.length?ws:toks;lxRenderHits()}
  function lxDocLab(d){return esc(d.short)+(d.lv==="법률"?" · 법률":d.k==="adm"?" · 고시":"")}
  function lxGroup(h){return h.type==="c"?"판례":lxLv(h.d)}
  function lxRenderHits(){var hits=LX.hits||[],cnt={all:hits.length,"법률":0,"시행령":0,"고시·규정":0,"판례":0};hits.forEach(function(h){cnt[lxGroup(h)]++});
    if(LX.flt!=="all"&&!cnt[LX.flt])LX.flt="all";
    $("lxResH").textContent="'"+LX.q+"' 찾은 결과";$("lxResN").textContent=hits.length+"건";
    $("lxFlt").innerHTML=["all","법률","시행령","고시·규정","판례"].map(function(f){return '<button type="button" data-f="'+f+'" aria-pressed="'+(LX.flt===f)+'"'+(f!=="all"&&!cnt[f]?" disabled":"")+'>'+(f==="all"?"전체":f)+' <span class="mono">'+cnt[f]+'</span></button>'}).join("");
    var L=hits.filter(function(h){return LX.flt==="all"||lxGroup(h)===LX.flt}).slice(0,40);
    $("lxList").innerHTML=L.length?L.map(function(h){if(h.type==="c"){var c=h.c;return '<li><button type="button" class="lx-hit" data-case="'+c.id+'"><small>판례 · '+esc(c.ct)+' '+lxDate(c.d)+' · '+esc(c.no)+'</small><b>'+esc(lxCaseTitle(c))+'</b><p>'+lxSnip(c.hs||c.yo,LX.toks)+'</p></button></li>'}
      return '<li><button type="button" class="lx-hit" data-k="'+h.k+'" data-n="'+h.a.n+'"><small>'+lxDocLab(h.d)+'</small><b>'+lxArtName(h.a.n)+(h.a.t?' '+esc(h.a.t):'')+'</b><p>'+lxSnip(h.a.x.replace(/^제\d+조(의\d+)?\([^)]*\)\s*/,""),LX.toks)+'</p></button></li>'}).join("")
      :'<li class="empty"><b>찾은 조문이 없어요</b>낱말을 줄이거나 다른 말로 찾아 보세요. 예: 고객확인, 제4조의2</li>'}
  function lxCaseTitle(c){var m=/\[([^\]]+)\]\s*$/.exec(c.nm);if(m)return m[1];var h=(c.hs||"").replace(/^\s*\[\d+\]\s*/,"").split(/\n|\[2\]/)[0].trim();if(h)return h.length>72?h.slice(0,70)+"…":h;return c.nm.split("·").slice(0,2).join("·")}
  /* 3. 연결 보기 */
  function lxLinkText(key,x){var refs=lxRefs(key,x),h="",p=0;refs.forEach(function(r){if(!lxFind(r.k,r.n))return;h+=esc(x.slice(p,r.at))+'<button type="button" class="lx-ref" data-k="'+r.k+'" data-n="'+r.n+'">'+esc(x.substr(r.at,r.len))+'</button>';p=r.at+r.len});
    return (h+esc(x.slice(p))).replace(/\n/g,"<br>")}
  function lxRow(it,cls){var d=LX.docs[it.k],a=lxFind(it.k,it.n);if(!d||!a)return "";var sn=a.x.replace(/\s+/g," "),s=Math.max(0,(it.at||0)-30);
    return '<li><button type="button" class="lx-go'+(cls?" "+cls:"")+'" data-k="'+it.k+'" data-n="'+it.n+'"><small>'+esc(d.short)+'</small><b>'+lxArtName(it.n)+(a.t?' '+esc(a.t):'')+'</b>'+(it.at!=null?'<p>'+(s?"…":"")+esc(sn.slice(s,s+90))+'…</p>':'')+'</button></li>'}
  function lxChgOf(k,n){for(var i=0;i<LX.chg.length;i++){var x=LX.chg[i];if(x.key===k&&lxChgArts(x).indexOf(n)>-1)return x}return null}
  function lxShow(t,silent){if(!LX.loaded){LX.cur=t;return}var box=$("lxArtBox");
    if(LX.cur&&!silent&&!(LX.cur.k===t.k&&LX.cur.n===t.n&&LX.cur.c===t.c))LX.hist.push(LX.cur);LX.cur=t;
    var back=LX.hist.length?'<button type="button" class="lx-back" id="lxBack">← 이전 조문</button>':'';
    if(t.c){var c=null;LX.cases.forEach(function(x){if(x.id===t.c)c=x});if(!c)return;
      box.innerHTML=back+'<div class="lx-a"><p class="lx-crumb">판례 · '+esc(c.ct)+' '+lxDate(c.d)+' 선고 · '+esc(c.no)+'</p><h4>'+esc(lxCaseTitle(c))+'</h4><p class="lx-cap" style="margin-top:6px">'+esc(c.nm.replace(/\s*\[[^\]]+\]\s*$/,""))+'</p>'
        +(c.hs?'<h5>판시사항</h5><div class="lx-tx">'+esc(c.hs).replace(/\n/g,"<br>")+'</div>':'')
        +(c.yo?'<h5>판결요지</h5><div class="lx-tx">'+esc(c.yo).replace(/\n/g,"<br>")+'</div>':'')
        +((c.refs||[]).length?'<h5>참조 조문</h5><ul class="lx-rel">'+c.refs.map(function(id){var p=id.split("|");return lxRow({k:p[0],n:p[1]})}).join("")+'</ul>':'')
        +(c.rf?'<p class="lx-cap">'+esc(c.rf)+'</p>':'')+'<a class="lx-src" href="https://www.law.go.kr/precInfoP.do?precSeq='+encodeURIComponent(c.id)+'" target="_blank" rel="noopener">판례 전문 ↗</a></div>';lxSyncPick();return}
    var d=LX.docs[t.k],a=lxFind(t.k,t.n);if(!d||!a){box.innerHTML='<p class="empty">조문을 찾지 못했어요.</p>';return}
    var up=[],seen={};lxRefs(t.k,a.x).forEach(function(r){var id=r.k+"|"+r.n;if(seen[id]||!lxFind(r.k,r.n))return;seen[id]=1;up.push({k:r.k,n:r.n})});
    var down=(LX.rev[t.k+"|"+t.n]||[]),dDec=down.filter(function(x){return LX.docs[x.k].lv==="시행령"}),dAdm=down.filter(function(x){return LX.docs[x.k].k==="adm"});
    var cs=LX.crf[t.k+"|"+t.n]||[],ch=lxChgOf(t.k,t.n),long=a.x.length>700;
    var h=back+'<div class="lx-a"><p class="lx-crumb">'+lxDocLab(d)+(a.c?' · '+esc(a.c.replace(/<[^>]*>/g,"").trim()):'')+'</p><h4>'+lxArtName(a.n)+(a.t?' <span>'+esc(a.t)+'</span>':'')+'</h4>'
      +(ch?'<button type="button" class="lx-chn" data-cid="'+ch.id+'">'+lxDate(ch.eff)+(ch.eff>lxToday()?" 시행 예정":" 시행")+' 개정 · 바뀐 내용 보기</button>':'')
      +'<div class="lx-tx'+(long?" fold":"")+'" id="lxTx">'+lxLinkText(t.k,a.x.replace(/^제\d+조(의\d+)?(\([^)]*\))?\s*/,""))+'</div>'+(long?'<button type="button" class="lx-more" id="lxMore">전체 펼치기</button>':'');
    if(up.length)h+='<h5>근거가 된 상위 규정 <span class="mono">'+up.length+'</span></h5><ul class="lx-rel">'+up.map(function(x){return lxRow(x)}).join("")+'</ul>';
    if(dDec.length)h+='<h5>구체화한 시행령 <span class="mono">'+dDec.length+'</span></h5><ul class="lx-rel">'+dDec.map(function(x){return lxRow(x)}).join("")+'</ul>';
    if(dAdm.length)h+='<h5>구체화한 고시·규정 <span class="mono">'+dAdm.length+'</span></h5><ul class="lx-rel">'+dAdm.slice(0,24).map(function(x){return lxRow(x)}).join("")+'</ul>'+(dAdm.length>24?'<p class="lx-cap">외 '+(dAdm.length-24)+'개 조문</p>':'');
    if(!up.length&&!dDec.length&&!dAdm.length)h+='<p class="lx-cap">'+(d.lv==="법률"?"이 조문을 직접 인용한 시행령·고시 조문이 없어요.":"이 조문이 인용한 상위 조문이 없어요.")+'</p>';
    if(cs.length)h+='<h5>이 조문을 다룬 판례 <span class="mono">'+cs.length+'</span></h5><ul class="lx-rel">'+cs.slice().sort(function(x,y){return y.d<x.d?-1:1}).slice(0,8).map(function(c){return '<li><button type="button" class="lx-hit" data-case="'+c.id+'"><small>'+esc(c.ct)+' '+lxDate(c.d)+' · '+esc(c.no)+'</small><b>'+esc(lxCaseTitle(c))+'</b></button></li>'}).join("")+'</ul>';
    h+='<a class="lx-src" href="'+lxUrl(d,a.n)+'" target="_blank" rel="noopener">국가법령정보센터 원문 ↗</a></div>';
    box.innerHTML=h;lxSyncPick()}
  function lxPickers(){var g={"법률":[],"시행령":[],"고시·규정":[]};LXORD.forEach(function(k){var d=LX.docs[k];if(d)g[lxLv(d)].push(d)});
    $("lxDoc").innerHTML=Object.keys(g).map(function(l){return '<optgroup label="'+l+'">'+g[l].map(function(d){return '<option value="'+d.key+'">'+esc(d.short)+'</option>'}).join("")+'</optgroup>'}).join("");lxSyncPick()}
  function lxArtOpts(k){$("lxArt").innerHTML=(LX.arts[k]||[]).filter(function(a){return !/^제\d+조(의\d+)?\s*삭제/.test(a.x)}).map(function(a){return '<option value="'+a.n+'">'+lxArtName(a.n)+(a.t?' '+esc(a.t):'')+'</option>'}).join("");$("lxArt").dataset.k=k}
  function lxSyncPick(){var t=LX.cur;if(!t||t.c||!$("lxDoc").options.length)return;$("lxDoc").value=t.k;if($("lxArt").dataset.k!==t.k)lxArtOpts(t.k);$("lxArt").value=t.n}
  function lxFocusView(){if(window.matchMedia&&matchMedia("(max-width:900px)").matches)$("lxView").scrollIntoView({behavior:"smooth",block:"start"})}
  function lxOpenChg(id,scroll){LX.open[id]=true;lxRenderChg();if(scroll){var el=$("lxc-"+id);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}}
  $("lxForm").addEventListener("submit",function(e){e.preventDefault();LX.flt="all";lxSearch($("lxQ").value)});
  $("lxQ").addEventListener("input",function(){var v=$("lxQ").value;clearTimeout(LX.t);LX.t=setTimeout(function(){if(v.trim().length>=2||!v.trim())lxSearch(v)},260)});
  $("p-law").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;
    if(b.hasAttribute("data-lq")){$("lxQ").value=b.getAttribute("data-lq");LX.flt="all";lxSearch($("lxQ").value);$("lxRes").scrollIntoView({behavior:"smooth",block:"start"});return}
    if(b.hasAttribute("data-f")){LX.flt=b.getAttribute("data-f");lxRenderHits();return}
    if(b.hasAttribute("data-case")){lxShow({c:b.getAttribute("data-case")});lxFocusView();return}
    if(b.classList.contains("lx-ch")){var id=b.getAttribute("data-cid");LX.open[id]=!LX.open[id];lxRenderChg();return}
    if(b.classList.contains("lx-chn")){lxOpenChg(b.getAttribute("data-cid"),true);return}
    if(b.id==="lxBack"){var p=LX.hist.pop();if(p)lxShow(p,true);return}
    if(b.id==="lxMore"){$("lxTx").classList.remove("fold");b.remove();return}
    if(b.hasAttribute("data-k")){var inView=!!b.closest("#lxView");lxShow({k:b.getAttribute("data-k"),n:b.getAttribute("data-n")});if(!inView)lxFocusView();else $("lxView").scrollIntoView({behavior:"smooth",block:"nearest"})}});
  $("lxDoc").addEventListener("change",function(){var k=$("lxDoc").value;lxArtOpts(k);var f=$("lxArt").options[0];if(f)lxShow({k:k,n:f.value})});
  $("lxArt").addEventListener("change",function(){lxShow({k:$("lxDoc").value,n:$("lxArt").value})});
  function lxOpen(){var M=LX.meta;if(M&&M.latest)LS.set("ai_seen_lex",M.latest);document.querySelector('.seg a[data-go="law"]').classList.remove("new");lxLoad()}
  setTimeout(lxMeta,1200);
  if(pz.done&&!pz.practice)showTerm("pzTerm",0);if(ms.st&&ms.st.s==="won"&&!ms.practice)showTerm("msTerm",1);
  try{setGame("x")}catch(e){}
  go((location.hash||"#today").slice(1),false);
})();
