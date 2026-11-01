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
    window.location.replace(base + '?v=qq-canvas-3&reload=' + Date.now());
  };
})();
