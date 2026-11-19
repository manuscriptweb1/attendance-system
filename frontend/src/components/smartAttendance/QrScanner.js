import React, { useEffect, useRef, useState, useId } from 'react';
import { cameraErrorMessage } from '../../utils/faceEngine';

/**
 * Camera QR / barcode scanner (ID card QR, Code128, Code39, EAN).
 * Calls onScan(text, formatName). While onScan's promise is pending the
 * scanner is paused, and the same code is ignored for `repeatDelayMs`.
 */
const QrScanner = ({ onScan, facingMode = 'environment', paused = false, repeatDelayMs = 4000, className = '' }) => {
  const reactId = useId();
  const elementId = `qr-reader-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const lastRef = useRef({ text: '', at: 0 });
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  onScanRef.current = onScan;
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    let instance = null;

    const start = async () => {
      setStarting(true);
      setError('');
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(/* webpackChunkName: "qr-scanner" */ 'html5-qrcode');
        if (cancelled) return;
        instance = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        });
        scannerRef.current = instance;
        await instance.start(
          { facingMode },
          {
            fps: 10,
            qrbox: (w, h) => {
              const side = Math.floor(Math.min(w, h) * 0.75);
              return { width: Math.max(side, 150), height: Math.max(Math.floor(side * 0.8), 120) };
            },
            aspectRatio: 1.0
          },
          async (text, result) => {
            if (busyRef.current || pausedRef.current) return;
            const now = Date.now();
            if (text === lastRef.current.text && now - lastRef.current.at < repeatDelayMs) return;
            lastRef.current = { text, at: now };
            busyRef.current = true;
            try {
              if (navigator.vibrate) navigator.vibrate(60);
              await onScanRef.current?.(text, result?.result?.format?.formatName || '');
            } finally {
              lastRef.current = { text, at: Date.now() };
              busyRef.current = false;
            }
          },
          () => {}
        );
        if (cancelled) {
          await instance.stop().catch(() => {});
          return;
        }
        setStarting(false);
      } catch (err) {
        if (!cancelled) {
          setError(cameraErrorMessage(err));
          setStarting(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        Promise.resolve()
          .then(() => (s.isScanning ? s.stop() : null))
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [elementId, facingMode, repeatDelayMs]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      <div id={elementId} className="w-full [&_video]:w-full [&_video]:object-cover" />
      {starting && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting camera…</div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-200 bg-black/80">{error}</div>
      )}
      {paused && !error && (
        <div className="absolute inset-0 bg-black/40" />
      )}
    </div>
  );
};

export default QrScanner;
