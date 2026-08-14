"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WakeLockSentinel = { released: boolean; release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function nextStationRefresh(now = new Date()) {
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function displaySource(url: string, refreshKey: number) {
  if (typeof window === "undefined") return url;
  const source = new URL(url, window.location.origin);
  source.searchParams.set("display_refresh", String(refreshKey));
  return `${source.pathname}${source.search}${source.hash}`;
}

export default function StationDisplayButton({ displayUrl, label = "24/7 display" }: { displayUrl: string; label?: string }) {
  const overlayRef = useRef<HTMLElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const takeoverUntilRef = useRef(0);
  const [active, setActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const src = useMemo(() => displaySource(displayUrl, refreshKey), [displayUrl, refreshKey]);

  const audioContext = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const Context = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!Context) return null;
    audioRef.current = new Context();
    return audioRef.current;
  }, []);

  const playTone = useCallback(() => {
    const context = audioContext();
    if (!context) return;
    void context.resume();
    const start = context.currentTime + 0.04;
    const sequence = [650, 950, 650, 950, 650, 950];
    sequence.forEach((frequency, index) => {
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
  }, [audioContext]);

  const holdScreenAwake = useCallback(async () => {
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      wakeLockRef.current = await (navigator as WakeLockNavigator).wakeLock?.request("screen") || null;
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  function startDisplay() {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.hidden = false;
    setActive(true);
    sessionStorage.setItem("preplan360.stationDisplay.active", "1");
    const context = audioContext();
    if (context) void context.resume();
    const fullscreenRequest = overlay.requestFullscreen?.();
    if (fullscreenRequest) void fullscreenRequest.catch(() => setFullscreen(false));
    void holdScreenAwake();
  }

  function stopDisplay() {
    setActive(false);
    sessionStorage.removeItem("preplan360.stationDisplay.active");
    if (document.fullscreenElement) void document.exitFullscreen();
    if (overlayRef.current) overlayRef.current.hidden = true;
    if (wakeLockRef.current && !wakeLockRef.current.released) void wakeLockRef.current.release();
    wakeLockRef.current = null;
  }

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === overlayRef.current);
    const onVisibility = () => { if (active && document.visibilityState === "visible") void holdScreenAwake(); };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data || event.data.type !== "preplan360:station-incident") return;
      takeoverUntilRef.current = Math.max(takeoverUntilRef.current, Number(event.data.endsAt) || 0);
      playTone();
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("message", onMessage);
    };
  }, [active, holdScreenAwake, playTone]);

  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const schedule = () => {
      const target = nextStationRefresh();
      setNextRefresh(target);
      timer = window.setTimeout(() => {
        const refresh = () => {
          if (Date.now() < takeoverUntilRef.current) {
            timer = window.setTimeout(refresh, takeoverUntilRef.current - Date.now() + 1000);
            return;
          }
          setRefreshKey(Date.now());
          schedule();
        };
        refresh();
      }, Math.max(1000, target.getTime() - Date.now()));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <>
      <button className="station-display-launch" type="button" onClick={startDisplay}>{label}</button>
      <section className="station-display-overlay" ref={overlayRef} hidden aria-label="24/7 station display">
        <header>
          <div><b>24/7 station display</b><span>{fullscreen ? "Full screen · wake lock requested" : "App full screen · use installed app or kiosk for no browser chrome"}</span></div>
          <div><span>Next app refresh: {nextRefresh ? nextRefresh.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "3:00 AM"}</span><button type="button" onClick={stopDisplay}>Exit display</button></div>
        </header>
        {active ? <iframe key={refreshKey} src={src} title="24/7 station operations display" allow="autoplay; fullscreen; screen-wake-lock" allowFullScreen /> : null}
      </section>
    </>
  );
}
