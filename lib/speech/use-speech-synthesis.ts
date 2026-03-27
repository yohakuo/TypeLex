'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function normalizeAudioUrl(audioUrl: string): string | null {
  const trimmedAudioUrl = audioUrl.trim();

  if (!trimmedAudioUrl) {
    return null;
  }

  if (trimmedAudioUrl.startsWith('//')) {
    return `https:${trimmedAudioUrl}`;
  }

  if (trimmedAudioUrl.startsWith('https://') || trimmedAudioUrl.startsWith('http://')) {
    return trimmedAudioUrl;
  }

  return null;
}

function isUsAudioUrl(audioUrl: string): boolean {
  const lowerCasedAudioUrl = audioUrl.toLowerCase();
  return lowerCasedAudioUrl.includes('-us.') || lowerCasedAudioUrl.includes('/us/');
}

function isUkAudioUrl(audioUrl: string): boolean {
  const lowerCasedAudioUrl = audioUrl.toLowerCase();
  return lowerCasedAudioUrl.includes('-uk.') || lowerCasedAudioUrl.includes('/uk/');
}

function getAudioCandidates(entries: unknown): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .flatMap((entry) => (Array.isArray((entry as { phonetics?: unknown }).phonetics) ? (entry as { phonetics: unknown[] }).phonetics : []))
    .map((phonetic) => normalizeAudioUrl(typeof (phonetic as { audio?: unknown }).audio === 'string' ? (phonetic as { audio: string }).audio : ''))
    .filter((audioUrl): audioUrl is string => Boolean(audioUrl));
}

function getPreferredAudioUrl(entries: unknown): string | null {
  const audioCandidates = getAudioCandidates(entries);

  const usAudioUrl = audioCandidates.find((audioUrl) => isUsAudioUrl(audioUrl));
  if (usAudioUrl) {
    return usAudioUrl;
  }

  const nonUkAudioUrl = audioCandidates.find((audioUrl) => !isUkAudioUrl(audioUrl));
  if (nonUkAudioUrl) {
    return nonUkAudioUrl;
  }

  return audioCandidates[0] ?? null;
}

function getPreferredEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const usVoice = voices.find((voice) => voice.lang.toLowerCase() === 'en-us');
  if (usVoice) {
    return usVoice;
  }

  const usPrefixVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en-us'));
  if (usPrefixVoice) {
    return usPrefixVoice;
  }

  const englishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'));
  return englishVoice ?? null;
}

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
  const activeFetchController = useRef<AbortController | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    requestIdRef.current += 1;

    if (activeAudio.current) {
      activeAudio.current.pause();
      activeAudio.current.currentTime = 0;
      activeAudio.current = null;
    }

    if (activeFetchController.current) {
      activeFetchController.current.abort();
      activeFetchController.current = null;
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
      if (activeFetchController.current) {
        activeFetchController.current.abort();
        activeFetchController.current = null;
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
        const preferredVoice = getPreferredEnglishVoice(voices);

        if (preferredVoice) {
          utterance.voice = preferredVoice;
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
      const controller = new AbortController();
      activeFetchController.current = controller;

      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch pronunciation audio.');
          }

          return response.json();
        })
        .then((entries) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          activeFetchController.current = null;

          const audioUrl = getPreferredAudioUrl(entries);

          if (!audioUrl) {
            fallbackToSpeechSynthesis();
            return;
          }

          const audio = new Audio(audioUrl);
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
        })
        .catch((error: unknown) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          activeFetchController.current = null;

          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }

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
