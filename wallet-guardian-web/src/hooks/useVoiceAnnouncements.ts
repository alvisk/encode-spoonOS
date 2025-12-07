"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Severity = "info" | "warning" | "critical" | "emergency";

type VoiceConfig = {
  enabled: boolean;
  volume: number;
  rate: number;
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
  rate?: number;
};

const DEFAULT_CONFIG: VoiceConfig = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
  announceAlerts: true,
  announceScanResults: true,
  announceContractScans: true,
};

const STORAGE_KEY = "wallet-guardian-voice-config";

/**
 * Hook for managing voice announcements using browser's Web Speech API.
 * 
 * Features:
 * - Text-to-speech for alerts, scan results, and notifications
 * - Persistent preferences stored in localStorage
 * - Queue management to prevent overlapping audio
 * - Volume and rate control
 * - Works entirely client-side, no backend required
 */
export function useVoiceAnnouncements() {
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<VoiceStatus>({
    available: false,
    loading: true,
    error: null,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRef = useRef<Array<{ message: string; options: SpeakOptions }>>([]);
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

  // Check Web Speech API availability on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setStatus({
        available: false,
        loading: false,
        error: "Not in browser environment",
      });
      return;
    }

    // Check if SpeechSynthesis is available
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      
      // Some browsers need voices to be loaded
      const checkVoices = () => {
        const voices = synthRef.current?.getVoices() ?? [];
        if (voices.length > 0) {
          setStatus({
            available: true,
            loading: false,
            error: null,
          });
        }
      };

      // Check immediately
      checkVoices();

      // Also listen for voiceschanged event (needed for Chrome)
      if (synthRef.current) {
        synthRef.current.addEventListener("voiceschanged", checkVoices);
        
        // Fallback: if voices don't load in 1 second, still mark as available
        // (some browsers don't fire voiceschanged)
        setTimeout(() => {
          setStatus((prev) => {
            if (prev.loading) {
              return {
                available: true,
                loading: false,
                error: null,
              };
            }
            return prev;
          });
        }, 1000);

        return () => {
          synthRef.current?.removeEventListener("voiceschanged", checkVoices);
        };
      }
    } else {
      setStatus({
        available: false,
        loading: false,
        error: "Speech synthesis not supported in this browser",
      });
    }
  }, []);

  // Get the best available voice (prefer English voices)
  const getBestVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!synthRef.current) return null;
    
    const voices = synthRef.current.getVoices();
    
    // Prefer English voices, specifically ones that sound good
    const preferredVoices = [
      "Google US English",
      "Google UK English Female",
      "Google UK English Male", 
      "Samantha",
      "Alex",
      "Microsoft Zira",
      "Microsoft David",
    ];
    
    for (const name of preferredVoices) {
      const voice = voices.find((v) => v.name.includes(name));
      if (voice) return voice;
    }
    
    // Fall back to any English voice
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) return englishVoice;
    
    // Fall back to the default voice
    return voices[0] ?? null;
  }, []);

  // Process the speech queue
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;
    if (!config.enabled || !synthRef.current) {
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
    
    try {
      setIsSpeaking(true);

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(message);
      utteranceRef.current = utterance;

      // Configure voice settings
      utterance.volume = config.volume;
      utterance.rate = options.rate ?? config.rate;
      
      // Adjust rate based on severity (urgent = faster)
      if (options.severity === "critical" || options.severity === "emergency") {
        utterance.rate = Math.min(utterance.rate * 1.1, 1.5);
        utterance.pitch = 1.1; // Slightly higher pitch for urgency
      }

      // Set voice
      const voice = getBestVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        isProcessingRef.current = false;
        utteranceRef.current = null;
        
        // Process next item in queue
        if (queueRef.current.length > 0) {
          // Small delay between messages
          setTimeout(processQueue, 300);
        }
      };

      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        isProcessingRef.current = false;
        utteranceRef.current = null;
        
        // Try next item in queue
        if (queueRef.current.length > 0) {
          setTimeout(processQueue, 300);
        }
      };

      synthRef.current.speak(utterance);
    } catch (e) {
      console.error("Voice announcement failed:", e);
      setIsSpeaking(false);
      isProcessingRef.current = false;
    }
  }, [config.enabled, config.volume, config.rate, getBestVoice]);

  // Main speak function - adds to queue
  const speak = useCallback(
    (message: string, options: SpeakOptions = {}) => {
      if (!config.enabled || !status.available) {
        console.log("Voice not available:", { enabled: config.enabled, available: status.available });
        return;
      }
      
      queueRef.current.push({ message, options });
      processQueue();
    },
    [config.enabled, status.available, processQueue]
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
        riskLevel === "critical" || riskLevel === "high" ? "critical" :
        riskLevel === "medium" || riskLevel === "moderate" ? "warning" : "info";
      
      speak(message, { severity });
    },
    [speak, config.announceScanResults]
  );

  // Stop current playback
  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    queueRef.current = [];
    setIsSpeaking(false);
    isProcessingRef.current = false;
    utteranceRef.current = null;
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
        if (synthRef.current) {
          synthRef.current.cancel();
        }
        queueRef.current = [];
        setIsSpeaking(false);
        isProcessingRef.current = false;
        utteranceRef.current = null;
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
