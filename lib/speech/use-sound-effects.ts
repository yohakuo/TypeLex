'use client';

import { useCallback, useRef } from 'react';

function replayAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;

  audio.currentTime = 0;
  audio.play().catch(() => {
    // Ignore audio playback errors
  });
}

export function useSoundEffects() {
  const typeAudio = useRef<HTMLAudioElement | null>(null);
  const correctAudio = useRef<HTMLAudioElement | null>(null);
  const incorrectAudio = useRef<HTMLAudioElement | null>(null);

  const initSounds = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!typeAudio.current) {
      typeAudio.current = new Audio('/sounds/mouse-click.mp3');
      typeAudio.current.preload = 'auto';
      typeAudio.current.volume = 0.16;
    }

    if (!correctAudio.current) {
      correctAudio.current = new Audio('/sounds/universfield-game-bonus.mp3');
      correctAudio.current.preload = 'auto';
      correctAudio.current.volume = 0.2;
    }

    if (!incorrectAudio.current) {
      incorrectAudio.current = new Audio('/sounds/universfield-error.mp3');
      incorrectAudio.current.preload = 'auto';
      incorrectAudio.current.volume = 0.25;
    }
  }, []);

  const playTypeSound = useCallback(() => {
    initSounds();
    replayAudio(typeAudio.current);
  }, [initSounds]);

  const playCorrectSound = useCallback(() => {
    initSounds();
    replayAudio(correctAudio.current);
  }, [initSounds]);

  const playIncorrectSound = useCallback(() => {
    initSounds();
    replayAudio(incorrectAudio.current);
  }, [initSounds]);

  return { playTypeSound, playCorrectSound, playIncorrectSound, initSounds };
}
