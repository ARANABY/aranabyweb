/* 아라나비 홈페이지 ↔ Firebase(Firestore) 연결. 수정하지 않아도 됩니다. */
(function () {
  if (window.AranabiCloud) return;
  var KEYS = { aranabi_board_v1: 'board', aranabi_popup_v1: 'popup', aranabi_status_v1: 'status' };
  var cfg = window.ARANABI_FIREBASE || {};
  var enabled = !!(cfg.apiKey && cfg.projectId);
  var C = window.AranabiCloud = { enabled: enabled, user: null, loaded: false, images: {} };
  window.__ARANABI_IMG = C.images;
  function fire() {
    try { window.dispatchEvent(new Event('storage')); } catch (e) {}
    try { window.dispatchEvent(new Event('aranabi-sync')); } catch (e) {}
  }
  function err(m) { try { window.dispatchEvent(new CustomEvent('aranabi-error', { detail: m })); } catch (e) {} }
  if (!enabled) { C.ready = Promise.resolve(); return; }

  var origSet = Storage.prototype.setItem, origRemove = Storage.prototype.removeItem;
  var db, auth, B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  function load(src) {
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  C.ready = load(B + 'firebase-app-compat.js')
    .then(function () { return Promise.all([load(B + 'firebase-auth-compat.js'), load(B + 'firebase-firestore-compat.js')]); })
    .then(function () {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      db = firebase.firestore(); auth = firebase.auth();
      auth.onAuthStateChanged(function (u) { C.user = u || null; fire(); });
    });
  C.ready
    .then(function () { return Promise.all([db.collection('site').get(), db.collection('images').get()]); })
    .then(function (r) {
      r[0].forEach(function (d) {
        var v = d.data() && d.data().v;
        for (var k in KEYS) if (KEYS[k] === d.id && typeof v === 'string') { try { origSet.call(localStorage, k, v); } catch (e) {} }
      });
      r[1].forEach(function (d) { C.images[d.id] = d.data(); });
      C.loaded = true; fire();
    })
    .catch(function (e) { console.warn('[aranabi] cloud', e); err('서버에서 내용을 불러오지 못했어요'); });

  // 관리자 화면의 저장(공지·팝업·운영 현황)을 서버에도 저장
  Storage.prototype.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === localStorage && KEYS[k] && C.user) {
      C.ready.then(function () { return db.collection('site').doc(KEYS[k]).set({ v: String(v), t: Date.now() }); })
        .catch(function () { err('서버 저장에 실패했어요. 다시 로그인해 주세요'); });
    }
  };
  Storage.prototype.removeItem = function (k) {
    origRemove.call(this, k);
    if (this === localStorage && KEYS[k] && C.user) {
      C.ready.then(function () { return db.collection('site').doc(KEYS[k]).delete(); })
        .catch(function () { err('서버 저장에 실패했어요. 다시 로그인해 주세요'); });
    }
  };
  C.signIn = function (email, pw) { return C.ready.then(function () { return auth.signInWithEmailAndPassword(email, pw); }).then(function (c) { C.user = c.user; return c.user; }); };
  C.signOut = function () { return C.ready.then(function () { return auth.signOut(); }); };
  C.saveImage = function (id, data) { return C.ready.then(function () { return db.collection('images').doc(id).set(data); }).then(function () { C.images[id] = data; fire(); }); };
  C.removeImage = function (id) { return C.ready.then(function () { return db.collection('images').doc(id).delete(); }).then(function () { delete C.images[id]; fire(); }); };
})();
