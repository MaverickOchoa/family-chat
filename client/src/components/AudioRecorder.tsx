import React, { useState, useRef } from 'react';
import { Mic, Square, Trash2, Send, Check } from 'lucide-react';

interface AudioRecorderProps {
  onSendAudio: (audioBlob: Blob, durationSeconds: number) => void;
  accentColor?: string;
  theme?: 'kid' | 'teen' | 'adult';
}

function getBestAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return '';
  }
  // Try audio/mp4 first for universal compatibility with iOS, iPadOS, Android, and desktop
  const candidates = [
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/aac',
    'audio/ogg;codecs=opus'
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onSendAudio,
  accentColor = 'bg-amber-500',
  theme = 'adult'
}) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoSendRef = useRef<boolean>(false);
  const durationRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      const mimeType = getBestAudioMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      autoSendRef.current = false;
      durationRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        stream.getTracks().forEach((t) => t.stop());

        if (autoSendRef.current) {
          autoSendRef.current = false;
          const finalDuration = Math.max(durationRef.current, 1);
          onSendAudio(blob, finalDuration);
          setAudioBlob(null);
          setDuration(0);
          durationRef.current = 0;
        } else {
          setAudioBlob(blob);
        }
      };

      // Gather audio in 250ms chunks to avoid 0-byte blobs on mobile
      mediaRecorder.start(250);
      setRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);
    } catch (err) {
      console.error('Mic access error:', err);
      alert('Por favor autoriza el permiso de micrófono en tu navegador para enviar notas de voz.');
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current && recording) {
      autoSendRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      autoSendRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      autoSendRef.current = false;
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setAudioBlob(null);
    setDuration(0);
    durationRef.current = 0;
  };

  const handleManualSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob, Math.max(duration, 1));
      cancelRecording();
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  // --- KIDS VIEW ---
  if (theme === 'kid') {
    return (
      <div className="flex items-center gap-2">
        {!recording && !audioBlob && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-full shadow-lg transition-transform flex-shrink-0"
            title="Toca para Grabar Audio"
          >
            <Mic className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {recording && (
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-400 px-3 py-1.5 rounded-full shadow-md">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold text-amber-900 text-sm sm:text-base mr-1">{formatTime(duration)}</span>

            {/* Direct Send button */}
            <button
              type="button"
              onClick={stopAndSend}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full font-bold text-xs shadow"
              title="Terminar y Enviar"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Enviar</span>
            </button>

            {/* Cancel button */}
            <button
              type="button"
              onClick={cancelRecording}
              className="p-1.5 bg-stone-200 hover:bg-stone-300 active:scale-95 text-stone-700 rounded-full"
              title="Cancelar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {audioBlob && !recording && (
          <div className="flex items-center gap-2 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-300">
            <span className="font-semibold text-amber-800 text-xs sm:text-sm">🎵 {formatTime(duration)}</span>
            <button
              type="button"
              onClick={handleManualSend}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full shadow"
              title="Enviar nota de voz"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 bg-stone-300 hover:bg-stone-400 text-stone-700 rounded-full"
              title="Borrar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- ADULT & TEEN VIEW ---
  return (
    <div className="flex items-center gap-2">
      {!recording && !audioBlob && (
        <button
          type="button"
          onClick={startRecording}
          className={`p-2.5 rounded-full transition-all ${
            theme === 'teen'
              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
          title="Grabar Audio Cifrado"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}

      {recording && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            theme === 'teen'
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-xs">{formatTime(duration)}</span>

          {/* Quick Send */}
          <button
            type="button"
            onClick={stopAndSend}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-semibold ml-1 shadow-sm active:scale-95"
            title="Enviar nota de voz"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar</span>
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={cancelRecording}
            className="p-1 hover:text-red-500 transition-colors text-slate-400"
            title="Cancelar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {audioBlob && !recording && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            theme === 'teen'
              ? 'bg-slate-800 text-slate-200 border border-slate-700'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          <span className="font-mono text-xs">🎵 {formatTime(duration)}</span>
          <button
            type="button"
            onClick={handleManualSend}
            className="p-1 text-emerald-500 hover:text-emerald-400 active:scale-95"
            title="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={cancelRecording}
            className="p-1 text-slate-400 hover:text-red-500"
            title="Descartar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
