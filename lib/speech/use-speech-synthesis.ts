'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeechState {
  supported: boolean;
  hasVoices: boolean;
  speaking: boolean;
  error: string | null;
  speak: (text: string) => void;
  stop: () => void;
}

export function useSpeechSynthesis(): SpeechState {
  const [supported, setSupported] = useState(false);
  const [hasVoices, setHasVoices] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    requestIdRef.current += 1;

    if (activeAudio.current) {
      activeAudio.current.pause();
      activeAudio.current.currentTime = 0;
      activeAudio.current = null;
    }

    if (fallbackTimeoutRef.current !== null) {
      window.clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }

    if (!supported) {
      setSpeaking(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore errors
    }

    setSpeaking(false);
  }, [supported]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }

    setSupported(true);

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setHasVoices(voices.length > 0);
    };

    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      if (activeAudio.current) {
        activeAudio.current.pause();
        activeAudio.current.currentTime = 0;
        activeAudio.current = null;
      }
      if (fallbackTimeoutRef.current !== null) {
        window.clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      requestIdRef.current += 1;
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      stop();
      setError(null);

      const requestId = requestIdRef.current;

      const fallbackToSpeechSynthesis = () => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!supported) {
          setError('Speech synthesis is not available in this browser.');
          return;
        }

        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'));

        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.rate = 0.9;
        utterance.onstart = () => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSpeaking(true);
        };
        utterance.onend = () => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSpeaking(false);
        };
        utterance.onerror = (event) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSpeaking(false);
          if (event.error !== 'canceled' && event.error !== 'interrupted') {
            setError('The browser could not play pronunciation for this word.');
          }
        };

        fallbackTimeoutRef.current = window.setTimeout(() => {
          fallbackTimeoutRef.current = null;
          if (requestId !== requestIdRef.current || !supported) {
            return;
          }
          try {
            window.speechSynthesis.speak(utterance);
          } catch {
            // ignore
          }
        }, 50);
      };

      setSpeaking(true);
      const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`);
      activeAudio.current = audio;

      audio.onended = () => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSpeaking(false);
        activeAudio.current = null;
      };

      audio.onerror = () => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        activeAudio.current = null;
        fallbackToSpeechSynthesis();
      };

      audio.play().catch(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        activeAudio.current = null;
        fallbackToSpeechSynthesis();
      });
    },
    [stop, supported],
  );

  return useMemo(
    () => ({ supported, hasVoices, speaking, error, speak, stop }),
    [error, hasVoices, speak, speaking, stop, supported],
  );
}
