import React from 'react';
import { Text } from 'react-native';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('ErrorBoundary caught render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <Text>Something went wrong.</Text>;
    }
    return this.props.children;
  }
}

