import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../pwa.js',import.meta.url),'utf8');
function browser({ua='iPhone Version/26.0 Mobile Safari/604.1',platform='iPhone',touch=1,standalone=false,query=''}={}){
  const events={},nodes=[],memory={};
  const element=()=>({style:{},lastChild:{},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v},appendChild(n){nodes.push(n)},insertBefore(n){nodes.push(n)},focus(){},remove(){},querySelector(){return null}});
  const body=element(),main=element(),footer=element(),head=element();
  const document={body,head,readyState:'complete',activeElement:null,createElement:element,getElementById:id=>nodes.find(n=>n.id===id)||null,querySelector:s=>s==='main'?main:s==='.foot-l'?footer:null,addEventListener:(k,f)=>events[k]=f};
  const window={addEventListener:(k,f)=>events[k]=f,matchMedia:()=>({matches:standalone})};
  vm.runInNewContext(source,{window,document,navigator:{userAgent:ua,platform,maxTouchPoints:touch,standalone},location:{protocol:'https:',origin:'https://aml.korbono.com',search:query},localStorage:{getItem:k=>memory[k],setItem:(k,v)=>memory[k]=v},matchMedia:()=>({matches:true}),URLSearchParams,requestAnimationFrame:f=>f(),setTimeout:()=>1,clearTimeout(){}});
  function click(action){events.click({preventDefault(){},target:{closest:()=>({getAttribute:()=>action})}})}
  return {nodes,events,click,dialog:()=>nodes.find(n=>n.role==='dialog')};
}
test('iPhone Safari shows discoverable banner and the complete manual install steps',()=>{
  const b=browser();assert.ok(b.nodes.some(n=>n.className==='pwa-banner'));b.click('open');
  const html=b.dialog().innerHTML;assert.match(html,/웹 앱으로 열기/);assert.match(html,/동작 편집/);assert.match(html,/공유/);assert.doesNotMatch(html,/data-pwa="install"/);
});
test('iOS app browsers and Chrome get a Safari handoff with a copyable clean address',()=>{
  for(const suffix of ['KAKAOTALK','NAVER(inapp','Instagram','CriOS/140']){
    const b=browser({ua:'iPhone Mobile Safari '+suffix});b.click('open');
    assert.match(b.dialog().innerHTML,/먼저 Safari에서/);assert.match(b.dialog().innerHTML,/설치 주소 복사/);
    assert.match(b.dialog().innerHTML,/https:\/\/aml.korbono.com\/\?install=1/);assert.doesNotMatch(b.dialog().innerHTML,/data-pwa="kakao"/);
  }
});
test('iPad desktop user agent receives the iOS guide; already installed apps are quiet',()=>{
  const b=browser({ua:'Macintosh Safari',platform:'MacIntel',touch:5});b.click('open');assert.match(b.dialog().innerHTML,/아이폰 홈 화면/);
  assert.equal(browser({standalone:true}).nodes.length,0);
});
test('an explicit install link opens immediately even on a first visit',()=>{
  const b=browser({query:'?install=1'});assert.ok(b.dialog());assert.match(b.dialog().innerHTML,/웹 앱으로 열기/);
});
test('Android still uses the native installation prompt when available',()=>{
  const b=browser({ua:'Android Chrome',platform:'Linux'});b.events.beforeinstallprompt({preventDefault(){}});b.click('open');assert.match(b.dialog().innerHTML,/data-pwa="install"/);
});
