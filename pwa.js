/* AML 인사이트: 앱 설치(PWA)·즐겨찾기 안내
   - 휴대폰: 홈 화면에 앱으로 설치하도록 안내(안드로이드 Chrome·삼성 인터넷은 버튼 한 번, iPhone은 공유 → 홈 화면에 추가)
   - 카카오톡·인스타그램 같은 앱 안 브라우저: 설치가 안 되니 바깥 브라우저로 열도록 안내
   - 컴퓨터: Chrome·Edge는 앱 설치 버튼, 그 밖에는 즐겨찾기(Ctrl+D / ⌘+D) 안내
   - 처음 들어오면 몇 초 뒤 한 번 띄우고, '다음에'를 누르면 7일 동안 다시 띄우지 않아요. 머리말의 '앱 설치' 버튼으로 언제든 다시 열 수 있어요. */
(function () {
  if (!('addEventListener' in window)) return;
  var KEY = 'aml-pwa';
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid;
  var isKakao = /KAKAOTALK/i.test(ua);
  var isInApp = isKakao || /NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|Whale\/.*inapp|; wv\)/i.test(ua);
  var isMac = /Mac/.test(navigator.platform || '') && !isIOS;
  var isMacSafari = isMac && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var deferred = null, root = null, shown = false;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) { return {} } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)) } catch (e) {} }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}) });
  }
  if (standalone) return;

  var css = ''
    + '.pwa-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--line2,#D6D6D1);background:var(--card,#fff);color:var(--ink,#0F1012);font:600 12.5px/1 var(--f,sans-serif);cursor:pointer;white-space:nowrap}'
    + '.pwa-btn:hover{border-color:var(--ink,#0F1012)}.pwa-btn svg{width:14px;height:14px}'
    + '.pwa-dim{position:fixed;inset:0;z-index:94;background:rgba(15,16,18,.28);opacity:0;transition:opacity .25s}'
    + '.pwa{position:fixed;z-index:95;background:var(--card,#fff);color:var(--ink,#0F1012);font-family:var(--f,sans-serif);box-shadow:0 20px 60px -20px rgba(0,0,0,.35);border:1px solid var(--line,#E7E7E3);transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .25s;opacity:0}'
    + '.pwa.m{left:0;right:0;bottom:0;border-radius:20px 20px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));transform:translateY(40px)}'
    + '.pwa.d{right:24px;bottom:24px;width:380px;border-radius:16px;padding:20px;transform:translateY(16px)}'
    + '.pwa.in{opacity:1;transform:none}.pwa-dim.in{opacity:1}'
    + '.pwa-h{display:flex;gap:14px;align-items:center;padding-right:28px}.pwa-h img{width:52px;height:52px;border-radius:12px;flex:none}'
    + '.pwa-h b{display:block;font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1.35}.pwa-h span{display:block;font-size:13px;color:var(--ink2,#43454B);margin-top:4px;line-height:1.5}'
    + '.pwa-x{position:absolute;right:12px;top:12px;width:32px;height:32px;border:0;background:none;color:var(--muted,#8A8C92);font-size:22px;line-height:1;cursor:pointer;border-radius:50%}'
    + '.pwa-x:hover{background:var(--sunk,#F2F2EF);color:var(--ink,#0F1012)}'
    + '.pwa ol{list-style:none;margin:16px 0 0;padding:14px 16px;background:var(--sunk,#F2F2EF);border-radius:12px;display:grid;gap:10px;counter-reset:s}'
    + '.pwa ol li{counter-increment:s;display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.55;color:var(--ink2,#43454B)}'
    + '.pwa ol li::before{content:counter(s);flex:none;width:20px;height:20px;border-radius:50%;background:var(--ink,#0F1012);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;margin-top:1px}'
    + '.pwa ol li b{color:var(--ink,#0F1012);font-weight:700}'
    + '.pwa .ic{display:inline-block;vertical-align:-3px;width:16px;height:16px;margin:0 2px}'
    + '.pwa kbd{display:inline-block;min-width:22px;padding:2px 7px;border:1px solid var(--line2,#D6D6D1);border-bottom-width:2px;border-radius:6px;background:#fff;font:600 12px/1.4 var(--m,monospace);color:var(--ink,#0F1012);text-align:center}'
    + '.pwa-b{display:flex;gap:8px;margin-top:16px}.pwa-b button,.pwa-b a{flex:1;height:46px;border-radius:999px;font:600 14.5px/1 var(--f,sans-serif);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}'
    + '.pwa-b .p{background:var(--ink,#0F1012);color:#fff;border:1px solid var(--ink,#0F1012)}.pwa-b .p:hover{background:#000}'
    + '.pwa-b .l{background:transparent;color:var(--ink2,#43454B);border:1px solid var(--line2,#D6D6D1)}.pwa-b .l:hover{border-color:var(--ink,#0F1012);color:var(--ink,#0F1012)}'
    + '.pwa-note{font-size:12px;color:var(--muted,#8A8C92);margin-top:12px;line-height:1.5}'
    + '@media (max-width:720px){.pwa-btn{height:28px;padding:0 10px;font-size:12px}.pwa-btn svg{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SHARE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var PLUS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  var mod = isMac ? '⌘' : 'Ctrl';

  function mode() {
    if (isKakao) return 'kakao';
    if (isInApp) return isAndroid ? 'inapp-a' : 'inapp-i';
    if (deferred) return 'prompt';
    if (isIOS) return 'ios';
    if (isAndroid) return 'android';
    return 'desk';
  }
  function content(m) {
    var head = function (t, s) { return '<div class="pwa-h"><img src="/icons/icon-192.png" alt=""><div><b>' + t + '</b><span>' + s + '</span></div></div>' };
    var mobileSub = '홈 화면 아이콘 하나로 매일 아침 인사이트를 바로 열 수 있어요. 무료고 용량도 거의 차지하지 않아요.';
    var later = '<button type="button" class="l" data-pwa="later">다음에</button>';
    if (m === 'prompt') return head(isMobile ? 'AML 인사이트 앱을 설치해 보세요' : '컴퓨터에 앱으로 설치해 두세요', isMobile ? mobileSub : '작업 표시줄이나 Dock에서 바로 열 수 있어요. 즐겨찾기만 하려면 <kbd>' + mod + '</kbd> + <kbd>D</kbd>를 누르세요.')
      + '<div class="pwa-b">' + later + '<button type="button" class="p" data-pwa="install">앱 설치</button></div>';
    if (m === 'kakao') return head('앱으로 설치하려면 브라우저로 열어 주세요', '카카오톡 안에서는 설치가 안 돼요. ' + (isIOS ? 'Safari' : 'Chrome') + '로 열면 홈 화면에 추가할 수 있어요.')
      + '<div class="pwa-b">' + later + '<button type="button" class="p" data-pwa="kakao">' + (isIOS ? 'Safari' : '브라우저') + '로 열기</button></div>';
    if (m === 'inapp-a') return head('앱으로 설치하려면 Chrome으로 열어 주세요', '이 앱 안의 브라우저에서는 설치가 안 돼요. Chrome으로 열면 버튼 한 번으로 설치할 수 있어요.')
      + '<div class="pwa-b">' + later + '<button type="button" class="p" data-pwa="chrome">Chrome으로 열기</button></div>';
    if (m === 'inapp-i') return head('앱으로 설치하려면 Safari로 열어 주세요', '이 앱 안의 브라우저에서는 홈 화면에 추가할 수 없어요.')
      + '<ol><li><span>오른쪽 위나 아래의 <b>···</b> 메뉴를 누르세요.</span></li><li><span><b>Safari로 열기</b>(또는 기본 브라우저로 열기)를 고르세요.</span></li><li><span>Safari에서 이 안내가 다시 뜨면 따라 하세요.</span></li></ol>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">닫기</button></div>';
    if (m === 'ios') return head('홈 화면에 AML 인사이트를 추가하세요', mobileSub)
      + '<ol><li><span>화면 아래(또는 주소창 옆)의 <b>공유</b> ' + SHARE + ' 버튼을 누르세요. 안 보이면 <b>···</b> 메뉴 안에 있어요.</span></li><li><span>목록을 올려 <b>홈 화면에 추가</b> ' + PLUS + '를 누르세요.</span></li><li><span>오른쪽 위 <b>추가</b>를 누르면 끝이에요.</span></li></ol>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">다음에</button><button type="button" class="p" data-pwa="done">추가했어요</button></div>';
    if (m === 'android') return head('홈 화면에 AML 인사이트를 추가하세요', mobileSub)
      + '<ol><li><span>브라우저 오른쪽 위(삼성 인터넷은 아래)의 <b>메뉴</b> ⋮ 를 누르세요.</span></li><li><span><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요.</span></li></ol>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">다음에</button><button type="button" class="p" data-pwa="done">추가했어요</button></div>';
    return head('즐겨찾기에 추가해 두세요', '매일 아침 한 번에 열 수 있게 두면 편해요.')
      + '<ol><li><span>키보드에서 <kbd>' + mod + '</kbd> + <kbd>D</kbd>를 누르고 <b>완료</b>를 누르세요.</span></li>'
      + (isMacSafari ? '<li><span>앱처럼 쓰려면 Safari 메뉴의 <b>파일 → Dock에 추가</b>를 누르세요.</span></li>' : '<li><span>Chrome·Edge는 주소창 오른쪽의 <b>설치</b> 아이콘으로 앱처럼 설치할 수도 있어요.</span></li>') + '</ol>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">다음에</button><button type="button" class="p" data-pwa="done">추가했어요</button></div>';
  }

  function close(remember) {
    if (!root) return;
    var o = load();
    if (remember === 'later') o.later = Date.now();
    if (remember === 'done') o.done = Date.now();
    save(o);
    var r = root, d = root._dim; root = null;
    r.classList.remove('in'); if (d) d.classList.remove('in');
    setTimeout(function () { r.remove(); if (d) d.remove() }, 300);
  }
  function open() {
    if (root) { root.innerHTML = '<button type="button" class="pwa-x" data-pwa="later" aria-label="닫기">×</button>' + content(mode()); return }
    shown = true;
    var m = matchMedia('(max-width:720px)').matches || isMobile;
    var dim = null;
    if (m) { dim = document.createElement('div'); dim.className = 'pwa-dim'; dim.setAttribute('data-pwa', 'later'); document.body.appendChild(dim) }
    root = document.createElement('div');
    root.className = 'pwa ' + (m ? 'm' : 'd');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '앱 설치 안내');
    root.innerHTML = '<button type="button" class="pwa-x" data-pwa="later" aria-label="닫기">×</button>' + content(mode());
    root._dim = dim;
    document.body.appendChild(root);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root && root.classList.add('in'); dim && dim.classList.add('in') }) });
  }
  function toast(t) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = t; el.hidden = false; clearTimeout(el._pt); el._pt = setTimeout(function () { el.hidden = true }, 4200);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-pwa]'); if (!t) return;
    var a = t.getAttribute('data-pwa');
    if (a === 'open') { e.preventDefault(); var am = document.getElementById('alertModal'); if (am) am.hidden = true; open(); return }
    if (a === 'later' || a === 'done') { close(a); if (a === 'done') toast('고마워요. 내일 아침에 또 만나요.'); return }
    if (a === 'install' && deferred) {
      var p = deferred; deferred = null;
      p.prompt();
      p.userChoice.then(function (c) { close(c && c.outcome === 'accepted' ? 'done' : 'later') }).catch(function () { close('later') });
      return;
    }
    if (a === 'kakao') { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); return }
    if (a === 'chrome') { location.href = 'intent://' + location.host + location.pathname + location.search + location.hash + '#Intent;scheme=https;package=com.android.chrome;end'; return }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root) close('later') });

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (root) open();
    var b = document.getElementById('pwaBtn'); if (b) b.lastChild.textContent = '앱 설치';
  });
  window.addEventListener('appinstalled', function () {
    var o = load(); o.installed = Date.now(); save(o);
    close(); toast('설치했어요. 홈 화면에서 AML 인사이트를 찾아보세요.');
    var b = document.getElementById('pwaBtn'); if (b) b.remove();
  });

  function addButtons() {
    var r = document.querySelector('.top-r');
    if (r && !document.getElementById('pwaBtn')) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'pwaBtn'; b.className = 'pwa-btn'; b.setAttribute('data-pwa', 'open');
      b.innerHTML = DL + '<span>' + (isMobile ? '앱 설치' : '앱·즐겨찾기') + '</span>';
      r.insertBefore(b, r.firstChild);
    }
    // '매일 아침 알림' 창의 '홈 화면에 앱처럼 추가' 항목에 바로 가기 버튼
    var li = document.querySelector('#alertModal .al-list li:nth-child(2)');
    if (li && !li.querySelector('[data-pwa]')) {
      var a = document.createElement('button');
      a.type = 'button'; a.className = 'btn sm'; a.setAttribute('data-pwa', 'open'); a.textContent = isMobile ? '앱으로 설치하기' : '설치·즐겨찾기 방법 보기';
      li.appendChild(a);
    }
  }

  function auto() {
    var o = load();
    if (o.installed || shown) return;
    var now = Date.now(), DAY = 864e5;
    if (o.done && now - o.done < 60 * DAY) return;
    if (o.later && now - o.later < 7 * DAY) return;
    var busy = document.querySelector('.modal:not([hidden])');
    if (busy) { setTimeout(auto, 4000); return }
    open();
  }

  function start() { addButtons(); setTimeout(auto, isMobile ? 3500 : 6000) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
