/* Keep the loading/error path usable even if a later script cannot start. */
(function () {
  var done = false;
  var status = document.getElementById('boot-status');
  var message = document.getElementById('boot-message');
  var retry = document.getElementById('boot-retry');
  function fail(text) {
    if (done || !status) return;
    status.hidden = false;
    message.textContent = text;
    retry.hidden = false;
  }
  window.campusBootFailed = fail;
  window.campusBootReady = function () {
    done = true;
    if (status) status.hidden = true;
  };
  window.addEventListener('error', function (event) {
    window.campusBootError = String(event.message || '资源加载失败');
    fail('游戏未能启动，请重新加载。');
  });
  window.addEventListener('unhandledrejection', function (event) {
    window.campusBootError = String(event.reason || '资源加载失败');
    fail('游戏未能启动，请重新加载。');
  });
  window.setTimeout(function () { fail('加载时间较长，请检查网络后重试。'); }, 18000);
  if (retry) retry.onclick = function () {
    var base = window.location.href.split('#')[0].split('?')[0];
    window.location.replace(base + '?v=mobile-safe-4&reload=' + Date.now());
  };
  var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var files = mobile ? ['matter-core.js','mobile-game.js'] : ['assets/phaser.min.js','platform.js','game.js'];
  var position = 0;
  function loadNext() {
    if (position >= files.length) return;
    var script = document.createElement('script');
    script.src = files[position++] + '?v=mobile-safe-4';
    script.async = false;
    script.onload = loadNext;
    script.onerror = function () { fail('游戏资源加载失败，请重新加载。'); };
    document.body.appendChild(script);
  }
  loadNext();
})();
