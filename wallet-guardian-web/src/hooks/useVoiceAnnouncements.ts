"use client";

import { Howl } from "howler";
import { useCallback, useEffect, useRef, useState } from "react";

type Severity = "info" | "warning" | "critical" | "emergency";

type VoiceConfig = {
  enabled: boolean;
  volume: number;
  announceAlerts: boolean;
  announceScanResults: boolean;
  announceContractScans: boolean;
};

type VoiceStatus = {
  available: boolean;
  loading: boolean;
  error: string | null;
};

type SpeakOptions = {
  severity?: Severity;
};

type QueueItem = {
  message: string;
  options: SpeakOptions;
};

const DEFAULT_CONFIG: VoiceConfig = {
  enabled: true,
  volume: 1.0,
  announceAlerts: true,
  announceScanResults: true,
  announceContractScans: true,
};

const STORAGE_KEY = "assertion-os-voice-config";

/**
 * Hook for managing voice announcements using Howler.js + backend TTS.
 *
 * Features:
 * - Text-to-speech via ElevenLabs backend API
 * - Persistent preferences stored in localStorage
 * - Queue management to prevent overlapping audio
 * - Volume control
 * - Falls back to Web Speech API if backend fails
 */
export function useVoiceAnnouncements() {
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<VoiceStatus>({
    available: false,
    loading: true,
    error: null,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  const currentHowlRef = useRef<Howl | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef(false);

  // Load config from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<VoiceConfig>;
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn("Failed to load voice config:", e);
    }
  }, []);

  // Save config to localStorage when it changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("Failed to save voice config:", e);
    }
  }, [config]);

  // Check voice API availability on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setStatus({
        available: false,
        loading: false,
        error: "Not in browser environment",
      });
      return;
    }

    // Check backend voice API status
    const checkVoiceAPI = async () => {
      try {
        const res = await fetch("/api/voice", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = (await res.json()) as { enabled?: boolean };
          setStatus({
            available: data.enabled === true,
            loading: false,
            error: data.enabled ? null : "Voice API not enabled on backend",
          });
        } else {
          // Fall back to checking if Howler works at all
          setStatus({
            available: true, // Assume available, will fail gracefully
            loading: false,
            error: null,
          });
        }
      } catch {
        // Backend check failed, but we can still try
        setStatus({
          available: true,
          loading: false,
          error: null,
        });
      }
    };

    void checkVoiceAPI();
  }, []);

  // Fetch audio from backend and play with Howler
  const playAudioFromBackend = useCallback(
    async (message: string, severity: Severity): Promise<boolean> => {
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "alert",
            message,
            severity,
          }),
        });

        if (!res.ok) {
          console.warn("Voice API returned error:", res.status);
          return false;
        }

        const data = (await res.json()) as {
          success?: boolean;
          audio_data?: string;
          audio_format?: string;
        };

        if (!data.success || !data.audio_data) {
          console.warn("Voice API response missing audio data");
          return false;
        }

        // Create audio URL from base64
        const audioUrl = `data:audio/${data.audio_format ?? "mp3"};base64,${data.audio_data}`;

        return new Promise((resolve) => {
          // Stop any current playback
          if (currentHowlRef.current) {
            currentHowlRef.current.stop();
            currentHowlRef.current.unload();
          }

          const howl = new Howl({
            src: [audioUrl],
            format: [data.audio_format ?? "mp3"],
            volume: config.volume,
            html5: true, // Better for streaming/large files
            onplay: () => {
              setIsSpeaking(true);
            },
            onend: () => {
              setIsSpeaking(false);
              currentHowlRef.current = null;
              resolve(true);
            },
            onloaderror: (_id, error) => {
              console.error("Howler load error:", error);
              setIsSpeaking(false);
              currentHowlRef.current = null;
              resolve(false);
            },
            onplayerror: (_id, error) => {
              console.error("Howler play error:", error);
              setIsSpeaking(false);
              currentHowlRef.current = null;
              resolve(false);
            },
          });

          currentHowlRef.current = howl;
          howl.play();
        });
      } catch (error) {
        console.error("Failed to fetch audio from backend:", error);
        return false;
      }
    },
    [config.volume]
  );

  // Fallback to Web Speech API
  const speakWithWebSpeech = useCallback(
    (message: string, severity: Severity): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
          resolve(false);
          return;
        }

        const synth = window.speechSynthesis;
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.volume = config.volume;
        utterance.rate = severity === "critical" || severity === "emergency" ? 1.1 : 1.0;

        // Try to get a good English voice
        const voices = synth.getVoices();
        const englishVoice = voices.find((v) => v.lang.startsWith("en"));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve(true);
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve(false);
        };

        synth.speak(utterance);
      });
    },
    [config.volume]
  );

  // Process the speech queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;
    if (!config.enabled) {
      queueRef.current = [];
      return;
    }

    isProcessingRef.current = true;
    const item = queueRef.current.shift();

    if (!item) {
      isProcessingRef.current = false;
      return;
    }

    const { message, options } = item;
    const severity = options.severity ?? "info";

    try {
      // Try backend first
      let success = await playAudioFromBackend(message, severity);

      // Fall back to Web Speech if backend fails
      if (!success) {
        console.log("Falling back to Web Speech API");
        success = await speakWithWebSpeech(message, severity);
      }

      if (!success) {
        console.warn("All speech methods failed for message:", message);
      }
    } catch (e) {
      console.error("Voice announcement failed:", e);
    } finally {
      isProcessingRef.current = false;

      // Process next item in queue after a short delay
      if (queueRef.current.length > 0) {
        setTimeout(() => void processQueue(), 300);
      }
    }
  }, [config.enabled, playAudioFromBackend, speakWithWebSpeech]);

  // Main speak function - adds to queue
  const speak = useCallback(
    (message: string, options: SpeakOptions = {}) => {
      if (!config.enabled) {
        console.log("Voice disabled");
        return;
      }

      queueRef.current.push({ message, options });
      void processQueue();
    },
    [config.enabled, processQueue]
  );

  // Convenience methods for specific announcement types
  const speakAlert = useCallback(
    (message: string, severity: Severity = "warning", _address?: string) => {
      if (!config.announceAlerts) return;
      speak(message, { severity });
    },
    [speak, config.announceAlerts]
  );

  const speakScanResult = useCallback(
    (message: string, severity: Severity = "info", _address?: string) => {
      if (!config.announceScanResults) return;
      speak(message, { severity });
    },
    [speak, config.announceScanResults]
  );

  const speakContractVerdict = useCallback(
    (isMalicious: boolean, contractAddress: string, riskScore: number) => {
      if (!config.announceContractScans) return;

      const shortAddr = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;
      const message = isMalicious
        ? `Warning! Contract ${shortAddr} has been flagged as malicious with a risk score of ${riskScore} out of 100. Exercise extreme caution.`
        : `Contract ${shortAddr} appears safe with a risk score of ${riskScore} out of 100.`;

      speak(message, {
        severity: isMalicious ? "critical" : "info",
      });
    },
    [speak, config.announceContractScans]
  );

  const speakAIAnalysis = useCallback(
    (address: string, riskLevel: string, keyFindings?: string) => {
      if (!config.announceScanResults) return;

      const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
      let message = `Analysis complete for wallet ${shortAddr}. Risk level: ${riskLevel}.`;
      if (keyFindings) {
        message += ` ${keyFindings}`;
      }

      const severity: Severity =
        riskLevel === "critical" || riskLevel === "high"
          ? "critical"
          : riskLevel === "medium" || riskLevel === "moderate"
            ? "warning"
            : "info";

      speak(message, { severity });
    },
    [speak, config.announceScanResults]
  );

  // Stop current playback
  const stop = useCallback(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.stop();
      currentHowlRef.current.unload();
      currentHowlRef.current = null;
    }

    // Also stop Web Speech if it's playing
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    queueRef.current = [];
    setIsSpeaking(false);
    isProcessingRef.current = false;
  }, []);

  // Update config
  const updateConfig = useCallback((updates: Partial<VoiceConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Toggle enabled state
  const toggleEnabled = useCallback(() => {
    setConfig((prev) => {
      const newEnabled = !prev.enabled;
      if (!newEnabled) {
        // Stop any current playback when disabling
        if (currentHowlRef.current) {
          currentHowlRef.current.stop();
          currentHowlRef.current.unload();
          currentHowlRef.current = null;
        }
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        queueRef.current = [];
        setIsSpeaking(false);
        isProcessingRef.current = false;
      }
      return { ...prev, enabled: newEnabled };
    });
  }, []);

  return {
    // State
    config,
    status,
    isSpeaking,

    // Actions
    speak,
    speakAlert,
    speakScanResult,
    speakContractVerdict,
    speakAIAnalysis,
    stop,

    // Config
    updateConfig,
    toggleEnabled,
  };
}

export type { VoiceConfig, VoiceStatus, SpeakOptions, Severity };
