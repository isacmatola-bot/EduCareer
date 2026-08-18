import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientEvent } from '../services/monitoring';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientEvent({
      kind: 'react_error',
      message: error.message,
      stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`
    });
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-error-page" role="alert">
          <h1>EduCareer</h1>
          <p>Ocorreu um erro inesperado. A equipa técnica foi notificada.</p>
          <button type="button" onClick={() => window.location.reload()}>Recarregar</button>
        </main>
      );
    }

    return this.props.children;
  }
}
