/* AML 인사이트: 앱 설치(PWA)·즐겨찾기 안내
   - 휴대폰: 홈 화면에 앱으로 설치하도록 안내(안드로이드 Chrome·삼성 인터넷은 버튼 한 번, iPhone은 공유 → 홈 화면에 추가)
   - 카카오톡·인스타그램 같은 앱 안 브라우저: 설치가 안 되니 바깥 브라우저로 열도록 안내
   - 컴퓨터: Chrome·Edge는 앱 설치 버튼, 그 밖에는 즐겨찾기(Ctrl+D / ⌘+D) 안내
   - iPhone은 첫 방문에도 안내 배너를 보여 주고, 설치는 Safari의 공유 메뉴에서 직접 진행해요. */
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
  var deferred = null, root = null, shown = false, selectedMode = null, opener = null, oldOverflow = '';
  var installURL = location.origin + '/?install=1';
  var isOtherIOS = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|Whale/i.test(ua);

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
    + '.pwa{position:fixed;z-index:95;background:var(--card,#fff);color:var(--ink,#0F1012);font-family:var(--f,sans-serif);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;box-shadow:0 20px 60px -20px rgba(0,0,0,.35);border:1px solid var(--line,#E7E7E3);transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .25s;opacity:0}'
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
    + '.pwa-help{margin-top:14px;font-size:13px;line-height:1.6}.pwa-help summary{cursor:pointer;font-weight:700;padding:8px 0}.pwa-help p{margin:6px 0}.pwa-link{border:0;background:none;text-decoration:underline;color:inherit;font:inherit;cursor:pointer;padding:8px 0}.pwa-url{display:block;width:100%;box-sizing:border-box;font:16px/1.4 var(--f,sans-serif);padding:10px;border:1px solid var(--line2,#D6D6D1);border-radius:8px;background:var(--bg,#FAFAF8);color:inherit}.pwa-status{font-size:13px;line-height:1.5;margin-top:8px}.pwa-banner{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px 16px;border:1px solid var(--line,#E7E7E3);border-radius:14px;margin:16px auto;background:var(--card,#fff);max-width:1060px}.pwa-banner span{font-size:13px;line-height:1.5}.pwa-banner button{flex:none;min-height:44px}.pwa-banner b{display:block}.pwa button:focus-visible,.pwa a:focus-visible{outline:3px solid #0A84FF;outline-offset:3px}'
    + '.pwa-note{font-size:12px;color:var(--muted,#8A8C92);margin-top:12px;line-height:1.5}'
    + '@media (max-width:720px){.pwa-btn{height:28px;padding:0 10px;font-size:12px}.pwa-btn svg{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SHARE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var PLUS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  var mod = isMac ? '⌘' : 'Ctrl';

  function mode() {
    if (isKakao) return isIOS ? 'inapp-i' : 'kakao';
    if (isInApp) return isAndroid ? 'inapp-a' : 'inapp-i';
    if (isOtherIOS) return 'inapp-i';
    if (deferred && !isIOS) return 'prompt';
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
    if (m === 'inapp-i') return head('먼저 Safari에서 열어 주세요', '지금 열린 브라우저에서 설치가 어렵다면 주소를 복사해 Safari로 이동해 주세요.')
      + '<ol><li><span>아래 <b>설치 주소 복사</b>를 누르세요.</span></li><li><span><b>Safari 앱</b>을 열고 주소창에 붙여 넣어 이동하세요.</span></li><li><span>사이트에서 <b>아이폰 설치 안내</b>를 누르면 다음 단계가 나와요.</span></li></ol>'
      + copyTools() + '<p class="pwa-note">앱의 ··· 메뉴에 Safari로 열기 또는 외부 브라우저로 열기가 있다면 이용해도 돼요.</p>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">닫기</button><button type="button" class="p" data-pwa="ios">Safari 설치 단계 보기</button></div>';
    if (m === 'ios') return head('아이폰 홈 화면에 추가해요', 'Safari에서 아래 3단계만 따라 해 주세요. 설치 창은 Safari 메뉴에서 직접 열어요.')
      + '<ol><li><span>Safari의 <b>공유</b> ' + SHARE + '를 누르세요. 안 보이면 주소창 옆 <b>··· 메뉴 → 공유</b>를 눌러 주세요.</span></li><li><span>공유 목록을 아래로 내려 <b>홈 화면에 추가</b> ' + PLUS + '를 누르세요.</span></li><li><span><b>웹 앱으로 열기</b>가 보이면 켜고, <b>추가</b>를 누르세요. 홈 화면의 아이콘으로 실행하면 돼요.</span></li></ol>'
      + '<details class="pwa-help"><summary>홈 화면에 추가가 안 보이나요?</summary><p>공유 목록 맨 아래의 <b>동작 편집</b>에서 <b>홈 화면에 추가</b>를 찾아 추가해 주세요. 카카오톡·네이버 등 앱 안이라면 Safari로 옮겨 진행해 주세요.</p>' + copyTools() + '</details>'
      + '<p class="pwa-note">설치 후에는 홈 화면 아이콘에서 프로필을 등록해 주세요. 브라우저에 있던 기록이 자동으로 연결되지 않을 수 있어요.</p>'
      + '<a class="pwa-link" href="https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener">Apple 공식 설치 안내 ↗</a>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">닫기</button><button type="button" class="p" data-pwa="done">안내 확인했어요</button></div>';
    if (m === 'android') return head('홈 화면에 AML 인사이트를 추가하세요', mobileSub)
      + '<ol><li><span>브라우저 오른쪽 위(삼성 인터넷은 아래)의 <b>메뉴</b> ⋮ 를 누르세요.</span></li><li><span><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요.</span></li></ol>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">다음에</button><button type="button" class="p" data-pwa="done">추가했어요</button></div>';
    return head('즐겨찾기에 추가해 두세요', '매일 아침 한 번에 열 수 있게 두면 편해요.')
      + '<ol><li><span>키보드에서 <kbd>' + mod + '</kbd> + <kbd>D</kbd>를 누르고 <b>완료</b>를 누르세요.</span></li>'
      + (isMacSafari ? '<li><span>앱처럼 쓰려면 Safari 메뉴의 <b>파일 → Dock에 추가</b>를 누르세요.</span></li>' : '<li><span>Chrome·Edge는 주소창 오른쪽의 <b>설치</b> 아이콘으로 앱처럼 설치할 수도 있어요.</span></li>') + '</ol>'
      + '<div class="pwa-b"><button type="button" class="l" data-pwa="later">다음에</button><button type="button" class="p" data-pwa="done">추가했어요</button></div>';
  }

  function copyTools() {
    return '<div class="pwa-b"><button type="button" class="p" data-pwa="copy">설치 주소 복사</button></div><label class="pwa-note">Safari에 붙여 넣을 주소<input class="pwa-url" aria-label="설치 주소" readonly value="' + installURL + '"></label><p class="pwa-status" role="status" data-copy-status></p>';
  }

  function close(remember) {
    if (!root) return;
    var o = load();
    if (remember === 'later') o.later = Date.now();
    if (remember === 'done') o.done = Date.now();
    save(o);
    var r = root, d = root._dim; root = null; selectedMode = null;
    document.body.style.overflow = oldOverflow;
    if (opener && opener.isConnected) opener.focus();
    r.classList.remove('in'); if (d) d.classList.remove('in');
    setTimeout(function () { r.remove(); if (d) d.remove() }, 300);
  }
  function open(forceMode) {
    if (forceMode) selectedMode = forceMode;
    if (root) { root.innerHTML = '<button type="button" class="pwa-x" data-pwa="later" aria-label="닫기">×</button>' + content(selectedMode || mode()); root.focus(); return }
    shown = true; opener = document.activeElement; oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    var m = matchMedia('(max-width:720px)').matches || isMobile;
    var dim = null;
    if (m) { dim = document.createElement('div'); dim.className = 'pwa-dim'; dim.setAttribute('data-pwa', 'later'); document.body.appendChild(dim) }
    root = document.createElement('div');
    root.className = 'pwa ' + (m ? 'm' : 'd');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.tabIndex = -1; root.setAttribute('aria-label', '앱 설치 안내');
    root.innerHTML = '<button type="button" class="pwa-x" data-pwa="later" aria-label="닫기">×</button>' + content(selectedMode || mode());
    root._dim = dim;
    document.body.appendChild(root); root.focus();
    requestAnimationFrame(function () { requestAnimationFrame(function () { root && root.classList.add('in'); dim && dim.classList.add('in') }) });
  }
  function toast(t) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = t; el.hidden = false; clearTimeout(el._pt); el._pt = setTimeout(function () { el.hidden = true }, 4200);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-pwa]'); if (!t) return;
    var a = t.getAttribute('data-pwa');
    if (a === 'open' || a === 'ios') { e.preventDefault(); var am = document.getElementById('alertModal'); if (am) am.hidden = true; open(a === 'ios' ? 'ios' : null); return }
    if (a === 'later' || a === 'done') { close(a); return }
    if (a === 'copy') {
      var field = root.querySelector('.pwa-url'), status = root.querySelector('[data-copy-status]');
      function fallback() { field.focus(); field.select(); field.setSelectionRange(0, field.value.length); status.textContent = '주소를 길게 눌러 복사한 뒤 Safari 주소창에 붙여 넣어 주세요.'; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(installURL).then(function () { status.textContent = '복사했어요. Safari 앱의 주소창에 붙여 넣어 주세요.' }, fallback);
      else fallback();
      return;
    }
    if (a === 'install' && deferred) {
      var p = deferred; deferred = null;
      p.prompt();
      p.userChoice.then(function (c) { close(c && c.outcome === 'accepted' ? 'done' : 'later') }).catch(function () { close('later') });
      return;
    }
    if (a === 'kakao') { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); return }
    if (a === 'chrome') { location.href = 'intent://' + location.host + location.pathname + location.search + location.hash + '#Intent;scheme=https;package=com.android.chrome;end'; return }
  });
  document.addEventListener('keydown', function (e) {
    if (!root) return;
    if (e.key === 'Escape') { close('later'); return; }
    if (e.key !== 'Tab') return;
    var items = Array.prototype.filter.call(root.querySelectorAll('button,a[href],input,summary'), function (el) { return el.getClientRects().length && !el.disabled; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root)) { e.preventDefault(); first.focus(); }
  });

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
      b.innerHTML = DL + '<span>' + (isIOS ? '아이폰 앱 설치' : isMobile ? '앱 설치' : '앱·즐겨찾기') + '</span>';
      r.insertBefore(b, r.firstChild);
    }
    var footer = document.querySelector('.foot-l');
    if (footer && !document.getElementById('iosInstallLink')) {
      var ios = document.createElement('a'); ios.id = 'iosInstallLink'; ios.href = '/?install=1'; ios.setAttribute('data-pwa', 'ios'); ios.textContent = '아이폰 설치 안내'; footer.appendChild(ios);
    }
    if (isIOS) {
      var main = document.querySelector('main');
      if (main) { var banner = document.createElement('div'); banner.className = 'pwa-banner'; banner.innerHTML = '<span><b>홈 화면에서 앱처럼 열어요</b>Safari에서 공유 → 홈 화면에 추가</span><button type="button" class="pwa-btn" data-pwa="open">설치 안내</button>'; main.insertBefore(banner, main.firstChild); }
    }
    // '매일 아침 알림'  창의 '홈 화면에 앱처럼 추가' 항목에 바로 가기 버튼
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

  function start() {
    addButtons();
    if (new URLSearchParams(location.search).get('install') === '1') { open(isIOS ? null : 'ios'); return; }
    // 첫 방문에서는 내용을 먼저 읽고, 다음 방문에서만 안내해요.
    var o = load(), previous = o.lastVisit, now = Date.now();
    o.lastVisit = now; save(o);
    if (previous && now - previous > 30 * 60 * 1000) setTimeout(auto, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
