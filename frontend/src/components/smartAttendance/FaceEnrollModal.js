import React, { useEffect, useRef, useState } from 'react';
import { FiCamera, FiUpload, FiX, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import useCamera from './useCamera';
import { loadFaceEngine, detectFace, cropFaceThumbnail, cropPortrait, fileToImage } from '../../utils/faceEngine';

const SAMPLES_NEEDED = 3;

const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/** Camera capture panel – takes 3 face samples a moment apart */
const CameraCapture = ({ onCaptured, facingMode, setFacingMode }) => {
  const videoRef = useRef(null);
  const { ready, error } = useCamera(videoRef, { facingMode });
  const [engineReady, setEngineReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadFaceEngine().then(() => setEngineReady(true)).catch(() => setMsg('Face engine could not load. Check the internet connection.'));
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    setCapturing(true);
    setMsg('');
    setProgress(0);
    const descriptors = [];
    let photo = null;
    let cardPhoto = null;
    let attempts = 0;
    try {
      while (descriptors.length < SAMPLES_NEEDED && attempts < 15) {
        attempts += 1;
        const face = await detectFace(video, { inputSize: 416, scoreThreshold: 0.6 });
        if (face && face.faceCount === 1 && face.box.width / (video.videoWidth || 1) > 0.18) {
          descriptors.push(face.descriptor);
          if (!photo) {
            photo = cropFaceThumbnail(video, face.box);
            cardPhoto = cropPortrait(video, face.box);
          }
          setProgress(descriptors.length);
          await new Promise((r) => setTimeout(r, 350));
        } else {
          setMsg(face && face.faceCount > 1 ? 'Only one person should be in the frame.' : 'Face not clear – look straight at the camera in good light.');
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (descriptors.length < SAMPLES_NEEDED) {
        setMsg('Could not capture a clear face. Move closer, face the light and try again.');
        return;
      }
      onCaptured({ descriptors, photo, cardPhoto, source: 'camera' });
    } catch (err) {
      setMsg(errorText(err, 'Capture failed'));
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] sm:aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className={`absolute inset-0 h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`} playsInline muted />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[45%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-dashed border-white/60" />
        {(error || !ready) && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90 bg-black/60">
            {error || 'Starting camera…'}
          </div>
        )}
        {capturing && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-center text-sm font-semibold text-white">
            Capturing {progress}/{SAMPLES_NEEDED}… hold still
          </div>
        )}
      </div>
      {msg && <p className="text-xs font-medium text-amber-400">{msg}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
          className="flex items-center justify-center gap-2 rounded-xl border border-admin-border px-4 py-3 text-xs font-bold text-admin-secondary hover:bg-admin-surface"
        >
          <FiRefreshCw /> Flip
        </button>
        <button
          type="button"
          disabled={!ready || !engineReady || capturing}
          onClick={capture}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <FiCamera /> {!engineReady ? 'Loading face engine…' : capturing ? 'Capturing…' : 'Capture face'}
        </button>
      </div>
    </div>
  );
};

/** Photo upload panel – reads the face from a clear photo */
const UploadCapture = ({ onCaptured }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const img = await fileToImage(file);
      setPreview(img.src);
      // Photos vary a lot in size: try a few detector resolutions before giving up
      let face = null;
      for (const inputSize of [416, 608, 320, 224]) {
        face = await detectFace(img, { inputSize, scoreThreshold: 0.45 });
        if (face) break;
      }
      if (!face) throw new Error('No face found in this photo. Use a clear, front-facing photo.');
      if (face.faceCount > 1) throw new Error('This photo has more than one face. Use a photo of only this employee.');
      onCaptured({ descriptors: [face.descriptor], photo: cropFaceThumbnail(img, face.box), cardPhoto: cropPortrait(img, face.box), source: 'upload' });
    } catch (err) {
      setMsg(errorText(err, 'Could not read the photo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-admin-border bg-admin-surface text-admin-secondary hover:border-blue-500">
        {preview ? (
          <img src={preview} alt="Selected" className="h-full w-full object-contain" />
        ) : (
          <>
            <FiUpload size={28} />
            <span className="text-sm font-semibold">{busy ? 'Reading face…' : 'Choose a clear front-facing photo'}</span>
            <span className="text-xs text-admin-muted">JPG / PNG · one person only</span>
          </>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {busy && <p className="text-xs text-admin-muted">Loading face engine and reading the photo…</p>}
      {msg && <p className="text-xs font-medium text-amber-400">{msg}</p>}
    </div>
  );
};

/**
 * Register / replace an employee's face.
 * @param client axios instance (admin api or HR scanner api)
 */
const FaceEnrollModal = ({ client, employee, onClose, onSaved, allowUpload = true, defaultMode = 'camera' }) => {
  const [mode, setMode] = useState(allowUpload ? defaultMode : 'camera');
  const [facingMode, setFacingMode] = useState('user');
  const [captured, setCaptured] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!employee) return null;

  const save = async () => {
    if (!captured) return;
    setSaving(true);
    setError('');
    try {
      const res = await client.post(`/smart-attendance/faces/${encodeURIComponent(employee.employee_id)}`, {
        descriptors: captured.descriptors,
        photo: captured.photo,
        card_photo: captured.cardPhoto,
        source: captured.source
      });
      setDone(true);
      onSaved?.(res.data.profile);
      setTimeout(() => onClose?.(), 900);
    } catch (err) {
      setError(errorText(err, 'Could not save the face'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-admin-border bg-admin-elevated shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-admin-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-admin-text">Register face</h2>
            <p className="text-xs text-admin-muted">{employee.name} · {employee.employee_id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-admin-secondary hover:bg-admin-surface" aria-label="Close"><FiX /></button>
        </div>

        <div className="space-y-4 p-5">
          {allowUpload && !captured && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-admin-surface p-1">
              {[{ id: 'camera', label: 'Use camera', Icon: FiCamera }, { id: 'upload', label: 'Upload photo', Icon: FiUpload }].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold ${mode === id ? 'bg-blue-600 text-white' : 'text-admin-secondary'}`}
                >
                  <Icon /> {label}
                </button>
              ))}
            </div>
          )}

          {!captured && mode === 'camera' && <CameraCapture onCaptured={setCaptured} facingMode={facingMode} setFacingMode={setFacingMode} />}
          {!captured && mode === 'upload' && <UploadCapture onCaptured={setCaptured} />}

          {captured && (
            <div className="space-y-4 text-center">
              <div className="flex items-end justify-center gap-4">
                <div>
                  <img src={captured.photo} alt="Face used for matching" className="h-32 w-32 rounded-2xl object-cover ring-4 ring-emerald-500/40" />
                  <p className="mt-1 text-[10px] text-admin-muted">Face match</p>
                </div>
                {captured.cardPhoto && (
                  <div>
                    <img src={captured.cardPhoto} alt="ID card portrait" className="h-40 w-[120px] rounded-lg border border-admin-border object-cover" />
                    <p className="mt-1 text-[10px] text-admin-muted">ID card photo</p>
                  </div>
                )}
              </div>
              {done ? (
                <p className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-400"><FiCheckCircle /> Face registered</p>
              ) : (
                <p className="text-xs text-admin-muted">Check that this is {employee.name}, then save.</p>
              )}
              {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
              {!done && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setCaptured(null); setError(''); }} className="flex-1 rounded-xl border border-admin-border py-3 text-sm font-bold text-admin-secondary hover:bg-admin-surface">Retake</button>
                  <button type="button" onClick={save} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save face'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollModal;
