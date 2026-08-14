/* global boardCfg, buildNav, current: writable, render, toneOn, toggleTone: writable */
(function () {
  const params = new URLSearchParams(window.location.search);
  const stationMode = params.get("station") === "1";
  let returnTimer = 0;

  if (stationMode) document.body.classList.add("station-display-mode");

  function localTone() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const start = context.currentTime + 0.03;
    [650, 950, 650, 950, 650, 950].forEach(function (frequency, index) {
      const begins = start + index * 0.72;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, begins);
      gain.gain.setValueAtTime(0.0001, begins);
      gain.gain.exponentialRampToValueAtTime(0.28, begins + 0.04);
      gain.gain.setValueAtTime(0.28, begins + 0.58);
      gain.gain.exponentialRampToValueAtTime(0.0001, begins + 0.68);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(begins);
      oscillator.stop(begins + 0.7);
    });
  }

  function incidentSignal(endsAt) {
    if (stationMode && window.parent !== window) {
      window.parent.postMessage({ type: "preplan360:station-incident", incidentId: "fictional-demo", title: "Demo dispatch", endsAt: endsAt }, window.location.origin);
    } else {
      localTone();
    }
  }

  const previousToggle = toggleTone;
  toggleTone = function () {
    const starting = !toneOn;
    previousToggle();
    window.clearTimeout(returnTimer);
    if (!starting) return;
    const duration = Math.max(5, Number(boardCfg && boardCfg.responseSec) || 90);
    const endsAt = Date.now() + duration * 1000;
    incidentSignal(endsAt);
    returnTimer = window.setTimeout(function () {
      if (current !== "board") current = "board";
      buildNav();
      render();
    }, duration * 1000);
  };

  window.fireflowStationDisplay = { stationMode: stationMode, responseSeconds: function () { return Math.max(5, Number(boardCfg && boardCfg.responseSec) || 90); } };
})();
