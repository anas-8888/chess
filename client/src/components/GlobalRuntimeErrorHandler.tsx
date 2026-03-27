import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GlobalRuntimeErrorHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigatedToErrorRef = useRef(false);

  useEffect(() => {
    const goTo500 = () => {
      // تجنب التنقل المتكرر - إذا وصلنا بالفعل إلى 500 أو على وشك الوصول، لا تفعل شيء
      if (hasNavigatedToErrorRef.current || location.pathname === '/500') {
        return;
      }

      hasNavigatedToErrorRef.current = true;
      navigate('/500', { replace: true });
    };

    const onUnhandledError = (event: ErrorEvent) => {
      // تجاهل الأخطاء غير الحرجة
      if (event.message && 
          (event.message.includes('ResizeObserver') ||
           event.message.includes('Script error') ||
           event.message.includes('NetworkError') ||
           event.message.includes('ChunkLoadError'))) {
        return;
      }
      goTo500();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      // تجاهل الأخطاء البسيطة في الـ promises
      if (event.reason && typeof event.reason === 'object') {
        const reason = event.reason as any;
        if (reason.message && 
            (reason.message.includes('cancelled') ||
             reason.message.includes('aborted'))) {
          return;
        }
      }
      goTo500();
    };

    window.addEventListener('error', onUnhandledError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onUnhandledError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [location.pathname, navigate]);

  return null;
};

export default GlobalRuntimeErrorHandler;

