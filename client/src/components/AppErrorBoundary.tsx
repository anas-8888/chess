import React from 'react';
import ServerError from '@/pages/ServerError';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // keep a minimal console record for troubleshooting
    console.error('Unhandled React error:', error);
    
    // إعادة تعيين الخطأ بعد 5 ثواني لتجنب عرض صفحة 500 بشكل دائم
    setTimeout(() => {
      this.setState({ hasError: false });
    }, 5000);
  }

  render() {
    if (this.state.hasError) {
      return <ServerError />;
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;

