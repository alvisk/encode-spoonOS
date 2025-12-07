"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceType = "alert" | "summary" | "query";
type Severity = "info" | "warning" | "critical" | "emergency";
type Persona = "professional" | "friendly" | "urgent" | "concise";

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
  type?: VoiceType;
  severity?: Severity;
  address?: string;
  persona?: Persona;
};

const DEFAULT_CONFIG: VoiceConfig = {
  enabled: true,
  volume: 0.8,
  announceAlerts: true,
  announceScanResults: true,
  announceContractScans: true,
};

const STORAGE_KEY = "wallet-guardian-voice-config";

/**
 * Hook for managing voice announcements in the Wallet Guardian app.
 * 
 * Features:
 * - Text-to-speech for alerts, scan results, and notifications
 * - Persistent preferences stored in localStorage
 * - Queue management to prevent overlapping audio
 * - Volume control
 */
export function useVoiceAnnouncements() {
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<VoiceStatus>({
    available: false,
    loading: true,
    error: null,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Check voice API status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/voice");
        if (res.ok) {
          const data = await res.json() as { enabled?: boolean };
          setStatus({
            available: data.enabled ?? false,
            loading: false,
            error: null,
          });
        } else {
          setStatus({
            available: false,
            loading: false,
            error: "Voice API not available",
          });
        }
      } catch (e) {
        setStatus({
          available: false,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to check voice status",
        });
      }
    };

    void checkStatus();
  }, []);

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
    
    try {
      setIsSpeaking(true);

      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: options.type ?? "alert",
          message,
          severity: options.severity ?? "info",
          address: options.address,
          persona: options.persona ?? "professional",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate voice");
      }

      const data = await res.json() as { audio_data?: string; audio_format?: string };
      
      if (data.audio_data) {
        // Create audio element and play
        const audio = new Audio(`data:audio/${data.audio_format ?? "mp3"};base64,${data.audio_data}`);
        audio.volume = config.volume;
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          void audio.play().catch(reject);
        });
      }
    } catch (e) {
      console.error("Voice announcement failed:", e);
    } finally {
      setIsSpeaking(false);
      isProcessingRef.current = false;
      
      // Process next item in queue
      if (queueRef.current.length > 0) {
        void processQueue();
      }
    }
  }, [config.enabled, config.volume]);

  // Main speak function - adds to queue
  const speak = useCallback(
    (message: string, options: SpeakOptions = {}) => {
      if (!config.enabled || !status.available) return;
      
      queueRef.current.push({ message, options });
      void processQueue();
    },
    [config.enabled, status.available, processQueue]
  );

  // Convenience methods for specific announcement types
  const speakAlert = useCallback(
    (message: string, severity: Severity = "warning", address?: string) => {
      if (!config.announceAlerts) return;
      speak(message, { type: "alert", severity, address });
    },
    [speak, config.announceAlerts]
  );

  const speakScanResult = useCallback(
    (message: string, severity: Severity = "info", address?: string) => {
      if (!config.announceScanResults) return;
      speak(message, { type: "alert", severity, address, persona: "professional" });
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
        type: "alert",
        severity: isMalicious ? "critical" : "info",
        persona: isMalicious ? "urgent" : "professional",
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
      
      speak(message, {
        type: "alert",
        severity,
        address,
        persona: severity === "critical" ? "urgent" : "professional",
      });
    },
    [speak, config.announceScanResults]
  );

  // Stop current playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
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
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
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

export type { VoiceConfig, VoiceStatus, SpeakOptions, Severity, Persona };
