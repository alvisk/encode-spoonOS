"""
Voice Guardian - ElevenLabs-Powered Voice AI for Wallet Guardian.

Game-changing features:
1. Real-time voice alerts for suspicious activity
2. Audio wallet summaries and risk briefings
3. Conversational voice interface for wallet queries
4. Multi-language support for global users
5. Customizable voice personas (professional, friendly, urgent)

This transforms the text-based guardian into an accessible, 
attention-grabbing audio experience.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, AsyncIterator, Union
import aiohttp

from .config import get_config


# =============================================================================
# CONFIGURATION
# =============================================================================

class VoicePersona(Enum):
    """Voice personas for different contexts."""
    PROFESSIONAL = "professional"  # Calm, authoritative - for reports
    FRIENDLY = "friendly"          # Warm, approachable - for summaries
    URGENT = "urgent"              # Alert, attention-grabbing - for warnings
    CONCISE = "concise"           # Brief, efficient - for quick updates


class AlertSeverity(Enum):
    """Severity levels with corresponding voice treatment."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class VoiceConfig:
    """Configuration for voice synthesis."""
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel - clear, professional
    model_id: str = "eleven_turbo_v2_5"      # Fast, high quality
    stability: float = 0.5                   # Voice consistency
    similarity_boost: float = 0.75          # Voice clarity
    style: float = 0.0                      # Style exaggeration
    use_speaker_boost: bool = True          # Enhanced clarity
    
    # Persona-specific voice IDs (ElevenLabs voices)
    PERSONA_VOICES: Dict[VoicePersona, str] = field(default_factory=lambda: {
        VoicePersona.PROFESSIONAL: "21m00Tcm4TlvDq8ikWAM",  # Rachel
        VoicePersona.FRIENDLY: "EXAVITQu4vr4xnSDxMaL",      # Bella
        VoicePersona.URGENT: "VR6AewLTigWG4xSOukaG",        # Arnold
        VoicePersona.CONCISE: "pNInz6obpgDQGcFmaJgB",       # Adam
    })


# =============================================================================
# ELEVENLABS CLIENT
# =============================================================================

class ElevenLabsClient:
    """
    Async client for ElevenLabs Text-to-Speech API.
    
    Features:
    - Streaming audio for real-time playback
    - Voice cloning support
    - Multi-language synthesis
    - Audio caching for repeated messages
    """
    
    BASE_URL = "https://api.elevenlabs.io/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ELEVENLABS_API_KEY", "")
        if not self.api_key:
            config = get_config()
            self.api_key = getattr(config, 'elevenlabs_api_key', '')
        
        self._session: Optional[aiohttp.ClientSession] = None
        self._audio_cache: Dict[str, bytes] = {}
        self._cache_max_size = 100  # Max cached audio clips
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers={
                    "xi-api-key": self.api_key,
                    "Content-Type": "application/json",
                }
            )
        return self._session
    
    async def close(self):
        """Close the client session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    def _cache_key(self, text: str, voice_id: str, model_id: str) -> str:
        """Generate cache key for audio."""
        content = f"{text}:{voice_id}:{model_id}"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def synthesize(
        self,
        text: str,
        voice_config: Optional[VoiceConfig] = None,
        output_format: str = "mp3_44100_128",
    ) -> bytes:
        """
        Synthesize text to speech.
        
        Args:
            text: Text to convert to speech
            voice_config: Voice configuration
            output_format: Audio format (mp3_44100_128, pcm_16000, etc.)
            
        Returns:
            Audio data as bytes
        """
        config = voice_config or VoiceConfig()
        
        # Check cache
        cache_key = self._cache_key(text, config.voice_id, config.model_id)
        if cache_key in self._audio_cache:
            return self._audio_cache[cache_key]
        
        session = await self._get_session()
        url = f"{self.BASE_URL}/text-to-speech/{config.voice_id}"
        
        payload = {
            "text": text,
            "model_id": config.model_id,
            "voice_settings": {
                "stability": config.stability,
                "similarity_boost": config.similarity_boost,
                "style": config.style,
                "use_speaker_boost": config.use_speaker_boost,
            }
        }
        
        params = {"output_format": output_format}
        
        async with session.post(url, json=payload, params=params) as resp:
            if resp.status != 200:
                error = await resp.text()
                raise ElevenLabsError(f"Synthesis failed: {resp.status} - {error}")
            
            audio_data = await resp.read()
        
        # Cache the result
        if len(self._audio_cache) >= self._cache_max_size:
            # Remove oldest entry
            oldest_key = next(iter(self._audio_cache))
            del self._audio_cache[oldest_key]
        self._audio_cache[cache_key] = audio_data
        
        return audio_data
    
    async def synthesize_stream(
        self,
        text: str,
        voice_config: Optional[VoiceConfig] = None,
    ) -> AsyncIterator[bytes]:
        """
        Stream synthesized audio in chunks for real-time playback.
        
        Yields audio chunks as they're generated.
        """
        config = voice_config or VoiceConfig()
        session = await self._get_session()
        
        url = f"{self.BASE_URL}/text-to-speech/{config.voice_id}/stream"
        
        payload = {
            "text": text,
            "model_id": config.model_id,
            "voice_settings": {
                "stability": config.stability,
                "similarity_boost": config.similarity_boost,
                "style": config.style,
                "use_speaker_boost": config.use_speaker_boost,
            }
        }
        
        async with session.post(url, json=payload) as resp:
            if resp.status != 200:
                error = await resp.text()
                raise ElevenLabsError(f"Stream synthesis failed: {resp.status} - {error}")
            
            async for chunk in resp.content.iter_chunked(1024):
                yield chunk
    
    async def get_voices(self) -> List[Dict[str, Any]]:
        """Get available voices."""
        session = await self._get_session()
        
        async with session.get(f"{self.BASE_URL}/voices") as resp:
            if resp.status != 200:
                raise ElevenLabsError(f"Failed to get voices: {resp.status}")
            data = await resp.json()
            return data.get("voices", [])
    
    async def get_user_info(self) -> Dict[str, Any]:
        """Get user subscription info including character usage."""
        session = await self._get_session()
        
        async with session.get(f"{self.BASE_URL}/user") as resp:
            if resp.status != 200:
                raise ElevenLabsError(f"Failed to get user info: {resp.status}")
            return await resp.json()


class ElevenLabsError(Exception):
    """ElevenLabs API error."""
    pass


# =============================================================================
# VOICE GUARDIAN - MAIN FEATURE
# =============================================================================

class VoiceGuardian:
    """
    Voice-powered wallet guardian with real-time audio alerts.
    
    Game-changing features:
    1. Speaks wallet alerts in real-time
    2. Reads suspicious activity reports
    3. Provides audio market briefings
    4. Supports conversational queries
    5. Multi-persona voice for different contexts
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        default_persona: VoicePersona = VoicePersona.PROFESSIONAL,
    ):
        self.client = ElevenLabsClient(api_key)
        self.default_persona = default_persona
        self.voice_config = VoiceConfig()
        self._listeners: List[Callable[[bytes, str], None]] = []
    
    def _get_voice_for_persona(self, persona: VoicePersona) -> str:
        """Get voice ID for persona."""
        return self.voice_config.PERSONA_VOICES.get(
            persona, 
            self.voice_config.voice_id
        )
    
    def _get_voice_for_severity(self, severity: AlertSeverity) -> VoicePersona:
        """Map severity to appropriate voice persona."""
        severity_to_persona = {
            AlertSeverity.INFO: VoicePersona.FRIENDLY,
            AlertSeverity.WARNING: VoicePersona.PROFESSIONAL,
            AlertSeverity.CRITICAL: VoicePersona.URGENT,
            AlertSeverity.EMERGENCY: VoicePersona.URGENT,
        }
        return severity_to_persona.get(severity, self.default_persona)
    
    def add_audio_listener(self, callback: Callable[[bytes, str], None]):
        """Add listener for audio output (for streaming to clients)."""
        self._listeners.append(callback)
    
    def _emit_audio(self, audio: bytes, message_type: str):
        """Emit audio to all listeners."""
        for listener in self._listeners:
            try:
                listener(audio, message_type)
            except Exception as e:
                print(f"Audio listener error: {e}")
    
    # =========================================================================
    # ALERT VOICE FEATURES
    # =========================================================================
    
    async def speak_alert(
        self,
        message: str,
        severity: AlertSeverity = AlertSeverity.INFO,
        address: Optional[str] = None,
    ) -> bytes:
        """
        Speak an alert message with appropriate urgency.
        
        Args:
            message: Alert message to speak
            severity: Severity level (affects voice persona)
            address: Wallet address (will be partially spoken for privacy)
            
        Returns:
            Audio bytes (MP3)
        """
        # Prepare message with privacy
        if address:
            short_addr = f"{address[:6]}...{address[-4:]}"
            message = f"Alert for wallet {short_addr}. {message}"
        
        # Add urgency prefix for critical alerts
        if severity == AlertSeverity.CRITICAL:
            message = f"Attention! Critical alert. {message}"
        elif severity == AlertSeverity.EMERGENCY:
            message = f"Emergency! Immediate action required. {message}"
        
        # Get appropriate voice
        persona = self._get_voice_for_severity(severity)
        config = VoiceConfig(voice_id=self._get_voice_for_persona(persona))
        
        # Adjust voice settings for urgency
        if severity in (AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY):
            config.stability = 0.3  # More dramatic
            config.style = 0.2     # More expressive
        
        audio = await self.client.synthesize(message, config)
        self._emit_audio(audio, f"alert_{severity.value}")
        return audio
    
    async def speak_suspicious_activity(
        self,
        inspection_result: Dict[str, Any],
    ) -> bytes:
        """
        Speak a summary of suspicious activity inspection.
        
        Args:
            inspection_result: Result from SusInspector.inspect_wallet()
            
        Returns:
            Audio bytes (MP3)
        """
        address = inspection_result.get("address", "unknown")
        short_addr = f"{address[:6]}...{address[-4:]}" if len(address) > 10 else address
        
        risk_score = inspection_result.get("risk_score", 0)
        risk_level = inspection_result.get("risk_level", "unknown")
        suspicious_txs = inspection_result.get("suspicious_transactions", [])
        suspicious_contracts = inspection_result.get("suspicious_contracts", [])
        
        # Build spoken message
        parts = [f"Wallet security report for {short_addr}."]
        
        # Risk assessment
        if risk_score == 0:
            parts.append("Good news! No suspicious activity detected. This wallet appears clean.")
        else:
            parts.append(f"Risk score: {risk_score} out of 100. Risk level: {risk_level}.")
            
            if suspicious_txs:
                critical = sum(1 for tx in suspicious_txs if tx.get("level") == "critical")
                high = sum(1 for tx in suspicious_txs if tx.get("level") == "high")
                
                parts.append(f"Found {len(suspicious_txs)} suspicious transactions.")
                if critical:
                    parts.append(f"Warning: {critical} critical severity issues detected.")
                if high:
                    parts.append(f"{high} high severity issues found.")
            
            if suspicious_contracts:
                parts.append(f"Detected {len(suspicious_contracts)} suspicious smart contracts.")
        
        # Determine severity for voice
        if risk_score >= 80:
            severity = AlertSeverity.EMERGENCY
        elif risk_score >= 50:
            severity = AlertSeverity.CRITICAL
        elif risk_score >= 20:
            severity = AlertSeverity.WARNING
        else:
            severity = AlertSeverity.INFO
        
        message = " ".join(parts)
        return await self.speak_alert(message, severity)
    
    # =========================================================================
    # WALLET SUMMARY VOICE
    # =========================================================================
    
    async def speak_wallet_summary(
        self,
        summary: Dict[str, Any],
        include_balances: bool = True,
        include_activity: bool = True,
    ) -> bytes:
        """
        Speak a wallet summary.
        
        Args:
            summary: Result from GetWalletSummaryTool
            include_balances: Whether to speak balance details
            include_activity: Whether to speak recent activity
            
        Returns:
            Audio bytes (MP3)
        """
        address = summary.get("address", "unknown")
        short_addr = f"{address[:6]}...{address[-4:]}" if len(address) > 10 else address
        
        parts = [f"Wallet summary for {short_addr}."]
        
        # Balances
        if include_balances:
            balances = summary.get("balances", [])
            if balances:
                parts.append(f"This wallet holds {len(balances)} different assets.")
                
                # Speak top 3 holdings
                sorted_balances = sorted(
                    balances, 
                    key=lambda b: float(b.get("amount", 0)), 
                    reverse=True
                )[:3]
                
                for bal in sorted_balances:
                    symbol = bal.get("symbol", "unknown")
                    amount = float(bal.get("amount", 0))
                    if amount >= 1:
                        parts.append(f"{amount:.2f} {symbol}.")
            else:
                parts.append("No token balances found.")
        
        # Metrics
        metrics = summary.get("metrics", {})
        if metrics:
            concentration = metrics.get("concentration", 0)
            if concentration > 0.8:
                parts.append("Warning: Portfolio is highly concentrated in one asset.")
            
            counterparty_count = metrics.get("counterparty_count", 0)
            parts.append(f"Wallet has interacted with {counterparty_count} unique addresses.")
        
        # Risk flags
        risk_flags = summary.get("risk_flags", [])
        if risk_flags:
            parts.append(f"Risk indicators: {', '.join(risk_flags).replace('_', ' ')}.")
        
        message = " ".join(parts)
        config = VoiceConfig(voice_id=self._get_voice_for_persona(VoicePersona.FRIENDLY))
        
        audio = await self.client.synthesize(message, config)
        self._emit_audio(audio, "wallet_summary")
        return audio
    
    # =========================================================================
    # MARKET BRIEFING VOICE
    # =========================================================================
    
    async def speak_portfolio_briefing(
        self,
        portfolio_analysis: Dict[str, Any],
    ) -> bytes:
        """
        Speak a portfolio analysis briefing.
        
        Args:
            portfolio_analysis: Result from PortfolioAnalyzer
            
        Returns:
            Audio bytes (MP3)
        """
        parts = ["Portfolio briefing."]
        
        wallet_count = portfolio_analysis.get("wallet_count", 0)
        parts.append(f"Analyzing {wallet_count} wallets.")
        
        risk_score = portfolio_analysis.get("weighted_risk_score", 0)
        risk_level = portfolio_analysis.get("risk_level", "unknown")
        parts.append(f"Overall portfolio risk: {risk_level}. Score: {risk_score} out of 100.")
        
        div_score = portfolio_analysis.get("diversification_score", 0)
        if div_score >= 0.7:
            parts.append("Portfolio diversification is good.")
        elif div_score >= 0.4:
            parts.append("Consider improving portfolio diversification.")
        else:
            parts.append("Warning: Portfolio has low diversification.")
        
        highest_risk = portfolio_analysis.get("highest_risk_wallet")
        if highest_risk:
            short_addr = f"{highest_risk[:6]}...{highest_risk[-4:]}"
            parts.append(f"Highest risk wallet: {short_addr}.")
        
        message = " ".join(parts)
        config = VoiceConfig(voice_id=self._get_voice_for_persona(VoicePersona.PROFESSIONAL))
        
        audio = await self.client.synthesize(message, config)
        self._emit_audio(audio, "portfolio_briefing")
        return audio
    
    # =========================================================================
    # REAL-TIME STREAMING
    # =========================================================================
    
    async def stream_alert(
        self,
        message: str,
        severity: AlertSeverity = AlertSeverity.INFO,
    ) -> AsyncIterator[bytes]:
        """
        Stream an alert for real-time playback.
        
        Yields audio chunks as they're generated.
        """
        persona = self._get_voice_for_severity(severity)
        config = VoiceConfig(voice_id=self._get_voice_for_persona(persona))
        
        async for chunk in self.client.synthesize_stream(message, config):
            yield chunk
    
    # =========================================================================
    # CONVERSATIONAL FEATURES
    # =========================================================================
    
    async def speak_query_response(
        self,
        query: str,
        response: str,
        persona: Optional[VoicePersona] = None,
    ) -> bytes:
        """
        Speak a response to a user query.
        
        Args:
            query: Original user query (for context)
            response: Response text to speak
            persona: Voice persona to use
            
        Returns:
            Audio bytes (MP3)
        """
        config = VoiceConfig(
            voice_id=self._get_voice_for_persona(persona or self.default_persona)
        )
        
        audio = await self.client.synthesize(response, config)
        self._emit_audio(audio, "query_response")
        return audio
    
    async def close(self):
        """Close the voice guardian client."""
        await self.client.close()


# =============================================================================
# VOICE-ENABLED ALERT SYSTEM
# =============================================================================

class VoiceAlertSystem:
    """
    Integrates voice with the smart alert system.
    
    Automatically speaks alerts when triggered.
    """
    
    def __init__(
        self,
        voice_guardian: Optional[VoiceGuardian] = None,
        enabled: bool = True,
    ):
        self.voice = voice_guardian or VoiceGuardian()
        self.enabled = enabled
        self._alert_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
    
    async def start(self):
        """Start the voice alert processor."""
        self._running = True
        asyncio.create_task(self._process_alerts())
    
    async def stop(self):
        """Stop the voice alert processor."""
        self._running = False
        await self.voice.close()
    
    async def queue_alert(
        self,
        message: str,
        severity: AlertSeverity = AlertSeverity.INFO,
        address: Optional[str] = None,
    ):
        """Queue an alert to be spoken."""
        if self.enabled:
            await self._alert_queue.put({
                "message": message,
                "severity": severity,
                "address": address,
            })
    
    async def _process_alerts(self):
        """Process queued alerts."""
        while self._running:
            try:
                alert = await asyncio.wait_for(
                    self._alert_queue.get(), 
                    timeout=1.0
                )
                await self.voice.speak_alert(
                    alert["message"],
                    alert["severity"],
                    alert["address"],
                )
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Voice alert error: {e}")


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

_voice_guardian: Optional[VoiceGuardian] = None


def get_voice_guardian() -> VoiceGuardian:
    """Get or create the global voice guardian instance."""
    global _voice_guardian
    if _voice_guardian is None:
        _voice_guardian = VoiceGuardian()
    return _voice_guardian


async def speak_alert(
    message: str,
    severity: str = "info",
    address: Optional[str] = None,
) -> bytes:
    """Quick function to speak an alert."""
    guardian = get_voice_guardian()
    sev = AlertSeverity(severity) if severity in [s.value for s in AlertSeverity] else AlertSeverity.INFO
    return await guardian.speak_alert(message, sev, address)


async def speak_inspection_result(result: Dict[str, Any]) -> bytes:
    """Quick function to speak a suspicious activity inspection result."""
    guardian = get_voice_guardian()
    return await guardian.speak_suspicious_activity(result)


async def speak_wallet_summary(summary: Dict[str, Any]) -> bytes:
    """Quick function to speak a wallet summary."""
    guardian = get_voice_guardian()
    return await guardian.speak_wallet_summary(summary)


# =============================================================================
# WEBSOCKET INTEGRATION HELPERS
# =============================================================================

def audio_to_base64(audio_bytes: bytes) -> str:
    """Convert audio bytes to base64 for WebSocket transmission."""
    return base64.b64encode(audio_bytes).decode('utf-8')


def create_audio_message(
    audio_bytes: bytes,
    message_type: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a WebSocket message with audio data."""
    return {
        "type": "voice_audio",
        "audio_type": message_type,
        "audio_format": "mp3",
        "audio_data": audio_to_base64(audio_bytes),
        "metadata": metadata or {},
        "timestamp": datetime.now().isoformat(),
    }
