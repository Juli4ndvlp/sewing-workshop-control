import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Error inesperado' };
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafaf8] text-stone-800">
          <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-stone-800">
              Ocurrió un error en la aplicación
            </h1>
            <p className="text-sm text-stone-600 mt-2">
              Recarga la página. Si el problema continúa, revisa la consola o restaura un respaldo.
            </p>
            {this.state.message && (
              <p className="text-xs text-stone-500 mt-3 font-mono break-words">
                {this.state.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 glass-btn-primary"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
