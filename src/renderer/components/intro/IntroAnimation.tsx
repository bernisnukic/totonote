import React, { useEffect, useState } from 'react';
import introGif from '../../assets/intro.gif';
import './IntroAnimation.css';

/**
 * Full-screen intro animation, shown once per install.
 * Renders the GIF at `src/renderer/assets/intro.gif`, then fades to the app.
 *
 * GIFs loop and emit no "ended" event, so INTRO_DURATION_MS controls when we
 * cut away — set it to the length of one play-through of your GIF. FADE_MS must
 * match the opacity transition duration in IntroAnimation.css.
 */
// The GIF is ~3.3s and loops with no "ended" event, so we cut away ourselves. Cutting
// slightly *before* the wrap point means the animation never visibly restarts — the
// fade covers the last sliver.
const INTRO_DURATION_MS = 3150;
const FADE_MS = 450;

/** Set once the intro has played; keeps it from replaying on every launch. */
export const INTRO_SEEN_KEY = 'totonote-intro-seen';

/** True when the intro should play: never seen, and not under test automation. */
export function shouldPlayIntro(): boolean {
  if (navigator.webdriver) return false;
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [closing, setClosing] = useState(false);

  // Remember it played, so the next launch goes straight to the app.
  useEffect(() => {
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* private mode / storage disabled — worst case it plays again */
    }
  }, []);

  // Auto-dismiss after the GIF has had time to play through once.
  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), INTRO_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // Let the user skip the intro with a click or any key.
  useEffect(() => {
    const skip = () => setClosing(true);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  // Fallback: if the fade transition never fires (e.g. reduced motion), still finish.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onDone, FADE_MS + 50);
    return () => clearTimeout(timer);
  }, [closing, onDone]);

  return (
    <div
      className={`intro-overlay${closing ? ' intro-overlay--closing' : ''}`}
      onTransitionEnd={() => { if (closing) onDone(); }}
      role="presentation"
    >
      <img src={introGif} alt="TotoNote" className="intro-gif" draggable={false} />
    </div>
  );
}
