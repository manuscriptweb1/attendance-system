import { useEffect, useRef, useState } from 'react';
import { cameraErrorMessage } from '../../utils/faceEngine';

/** Starts a camera stream on the given <video> ref and stops it on unmount. */
const useCamera = (videoRef, { facingMode = 'user', enabled = true, width = 640, height = 480 } = {}) => {
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setReady(false);
    setError('');

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error('This browser does not support camera access.'), { name: 'NotSupported' });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: width }, height: { ideal: height } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          await video.play().catch(() => {});
          const markReady = () => !cancelled && setReady(true);
          if (video.readyState >= 2) markReady();
          else video.onloadeddata = markReady;
        }
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err));
      }
    };
    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
    };
  }, [videoRef, facingMode, enabled, width, height]);

  return { ready, error };
};

export default useCamera;
