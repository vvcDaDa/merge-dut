(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusPlatform = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function profile(env) {
    const mobile = !!env.coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(env.ua || '');
    const embedded = mobile && /MQQBrowser|QQ\/|MicroMessenger/i.test(env.ua || '');
    const constrained = mobile && ((env.memory > 0 && env.memory <= 2) || (env.cores > 0 && env.cores <= 4));
    const scale = mobile ? (embedded || constrained ? 1.5 : 2) : Math.min(5, Math.max(3, Math.ceil((env.dpr || 1) * 640 / 440)));
    return { mobile, embedded, scale, maxTexture: mobile ? 512 : 1024, particles: mobile ? 3 : 9 };
  }
  function textureSize(radius, config) {
    return Math.min(config.maxTexture, Math.max(128, 2 ** Math.ceil(Math.log2(radius * 2 * config.scale))));
  }
  // Coordinates come from the current CSS rectangle, independent of DPR and browser bars.
  function bindInput(canvas, root, handlers) {
    let active = null;
    const at = e => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) handlers.aim(Math.max(0, Math.min(440, (e.clientX - rect.left) * 440 / rect.width)));
    };
    const cancel = () => { active = null; };
    if (root.PointerEvent) {
      canvas.addEventListener('pointerdown', e => {
        if (active !== null || e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
        e.preventDefault(); active = e.pointerId; at(e); handlers.start();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      });
      canvas.addEventListener('pointermove', e => { if (active === e.pointerId || (active === null && e.pointerType === 'mouse')) at(e); });
      canvas.addEventListener('pointerup', e => {
        if (active !== e.pointerId) return;
        e.preventDefault(); active = null; at(e); handlers.drop();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      });
      canvas.addEventListener('pointercancel', cancel);
      canvas.addEventListener('lostpointercapture', cancel);
    } else {
      canvas.addEventListener('touchstart', e => {
        if (active !== null || !e.changedTouches.length) return;
        e.preventDefault(); const t = e.changedTouches[0]; active = t.identifier; at(t); handlers.start();
      }, { passive: false });
      canvas.addEventListener('touchmove', e => {
        for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === active) { e.preventDefault(); at(e.changedTouches[i]); break; }
      }, { passive: false });
      canvas.addEventListener('touchend', e => {
        for (let i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === active) { e.preventDefault(); active = null; at(e.changedTouches[i]); handlers.drop(); break; }
      }, { passive: false });
      canvas.addEventListener('touchcancel', cancel);
      canvas.addEventListener('mousedown', e => { if (active === null && e.button === 0) { active = 'mouse'; at(e); handlers.start(); } });
      canvas.addEventListener('mousemove', e => { if (active === null || active === 'mouse') at(e); });
      root.addEventListener('mouseup', e => { if (active === 'mouse') { active = null; at(e); handlers.drop(); } });
    }
    root.addEventListener('blur', cancel);
    return cancel;
  }
  return { profile, textureSize, bindInput };
});
