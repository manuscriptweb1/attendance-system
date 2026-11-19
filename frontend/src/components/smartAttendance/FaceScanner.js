import React, { useEffect, useRef, useState } from 'react';
import useCamera from './useCamera';
import { loadFaceEngine, detectFace, descriptorDistance } from '../../utils/faceEngine';

/**
 * Continuous face recognition from the camera.
 * When a clear, steady face is seen it calls onFace(descriptor) and waits for
 * the returned promise; then it pauses for `cooldownMs` before looking again.
 */
const FaceScanner = ({
  onFace,
  paused = false,
  facingMode = 'user',
  cooldownMs = 3500,
  minFaceRatio = 0.2,
  className = '',
  large = false
}) => {
  const videoRef = useRef(null);
  const { ready, error } = useCamera(videoRef, { facingMode });
  const [engineState, setEngineState] = useState('loading'); // loading | ready | error
  const [hint, setHint] = useState('Loading face engine…');
  const [box, setBox] = useState(null);
  const onFaceRef = useRef(onFace);
  const pausedRef = useRef(paused);
  onFaceRef.current = onFace;
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    loadFaceEngine()
      .then(() => { if (!cancelled) setEngineState('ready'); })
      .catch(() => { if (!cancelled) setEngineState('error'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || engineState !== 'ready') return undefined;
    let cancelled = false;
    let timer = null;
    let previous = null;
    let busy = false;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || busy || pausedRef.current || video.readyState < 2) {
        timer = setTimeout(tick, 400);
        return;
      }
      busy = true;
      try {
        const face = await detectFace(video, { inputSize: 320, scoreThreshold: 0.5 });
        if (cancelled) return;
        if (!face) {
          previous = null;
          setBox(null);
          setHint('Look straight at the camera');
        } else {
          const vw = video.videoWidth || 1;
          const vh = video.videoHeight || 1;
          setBox({ x: face.box.x / vw, y: face.box.y / vh, w: face.box.width / vw, h: face.box.height / vh });
          if (face.box.width / vw < minFaceRatio) {
            previous = null;
            setHint('Come a little closer');
          } else if (face.faceCount > 1) {
            previous = null;
            setHint('Only one person in front of the camera, please');
          } else if (!previous || descriptorDistance(previous, face.descriptor) > 0.35) {
            previous = face.descriptor;
            setHint('Hold still…');
          } else {
            // Two steady frames → average them and submit
            const descriptor = face.descriptor.map((v, i) => (v + previous[i]) / 2);
            previous = null;
            setHint('Checking…');
            try {
              await onFaceRef.current?.(descriptor);
            } catch (_) { /* parent shows the error */ }
            if (cancelled) return;
            setHint('Next person, please');
            setBox(null);
            await new Promise((r) => { timer = setTimeout(r, cooldownMs); });
          }
        }
      } catch (_) {
        setHint('Face engine error, retrying…');
      } finally {
        busy = false;
      }
      if (!cancelled) timer = setTimeout(tick, 250);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ready, engineState, cooldownMs, minFaceRatio]);

  const mirrored = facingMode === 'user';
  const message = error
    || (engineState === 'error' ? 'Face engine could not load. Check the internet connection and reload.' : null);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${large ? 'aspect-video' : 'aspect-[3/4] sm:aspect-video'} ${className}`}>
      <video ref={videoRef} className={`absolute inset-0 h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`} playsInline muted />
      {box && !message && (
        <div
          className="absolute rounded-xl border-4 border-emerald-400/90 shadow-[0_0_20px_rgba(52,211,153,0.6)] transition-all duration-150"
          style={{
            left: `${(mirrored ? 1 - box.x - box.w : box.x) * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`
          }}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
        <span className={`font-semibold text-white ${large ? 'text-2xl' : 'text-sm'}`}>
          {message || (!ready ? 'Starting camera…' : engineState === 'loading' ? 'Loading face engine…' : (paused ? 'Paused' : hint))}
        </span>
      </div>
      {message && <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-red-200">{message}</div>}
    </div>
  );
};

export default FaceScanner;
