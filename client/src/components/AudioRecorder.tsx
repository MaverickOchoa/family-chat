import React, { useState, useRef } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';

interface AudioRecorderProps {
  onSendAudio: (audioBlob: Blob, durationSeconds: number) => void;
  accentColor?: string;
  theme?: 'kid' | 'teen' | 'adult';
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      alert('Por favor autoriza el permiso de micrófono en tu navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setDuration(0);
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendAudio(audioBlob, duration);
      cancelRecording();
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  if (theme === 'kid') {
    return (
      <div className="flex items-center gap-2">
        {!recording && !audioBlob && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-full shadow-lg transition-transform flex-shrink-0"
            title="Grabar Nota de Voz"
          >
            <Mic className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {recording && (
          <div className="flex items-center gap-3 bg-amber-100 border-2 border-amber-400 px-4 py-2 rounded-full animate-pulse shadow-md">
            <span className="w-4 h-4 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold text-amber-900 text-lg">{formatTime(duration)}</span>
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}

        {audioBlob && (
          <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 rounded-full border border-amber-300">
            <span className="font-semibold text-amber-800 text-sm">🎵 {formatTime(duration)}</span>
            <button type="button" onClick={handleSend} className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600">
              <Send className="w-5 h-5" />
            </button>
            <button type="button" onClick={cancelRecording} className="p-2 bg-stone-300 text-stone-700 rounded-full hover:bg-stone-400">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

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
        <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full ${
          theme === 'teen' ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40' : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-xs">{formatTime(duration)}</span>
          <button type="button" onClick={stopRecording} className="p-1 hover:opacity-80">
            <Square className="w-4 h-4 fill-current" />
          </button>
        </div>
      )}

      {audioBlob && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
          theme === 'teen' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-700'
        }`}>
          <span className="font-mono text-xs">{formatTime(duration)}</span>
          <button type="button" onClick={handleSend} className="p-1 text-emerald-500 hover:text-emerald-400">
            <Send className="w-4 h-4" />
          </button>
          <button type="button" onClick={cancelRecording} className="p-1 text-slate-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
