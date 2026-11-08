import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-white">Hubo un detalle al cargar la vista</h2>
            <p className="text-xs text-slate-400">
              Puedes recargar la aplicación o restaurar la sesión para continuar de forma segura.
            </p>
            {this.state.error && (
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/20 text-[11px] font-mono text-red-300 break-words text-left max-h-24 overflow-y-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow"
              >
                🔄 Recargar Aplicación
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-all border border-slate-700"
              >
                Limpiar datos y reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
