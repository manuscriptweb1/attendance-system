/**
 * Face engine for Smart Attendance.
 * Runs fully in the browser (face-api / TensorFlow.js). Only the 128-number
 * face descriptor (and an optional small thumbnail) is sent to the server,
 * where it is matched against registered employees.
 *
 * The library and model files (~7 MB) are lazy-loaded the first time a face
 * feature is opened, so normal pages are not affected.
 */

const MODEL_URL = `${process.env.PUBLIC_URL || ''}/models/face-api`;

let faceApiPromise = null;
let modelsPromise = null;

export const loadFaceEngine = async () => {
  if (!faceApiPromise) {
    faceApiPromise = import(/* webpackChunkName: "face-api" */ '@vladmandic/face-api');
  }
  const faceapi = await faceApiPromise;
  if (!modelsPromise) {
    modelsPromise = (async () => {
      try {
        await faceapi.tf.setBackend('webgl');
      } catch (_) {
        await faceapi.tf.setBackend('cpu');
      }
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
    })().catch((err) => {
      modelsPromise = null;
      throw err;
    });
  }
  await modelsPromise;
  return faceapi;
};

/**
 * Detect faces in a video/image/canvas element.
 * Returns { descriptor:number[], box, score, faceCount } for the largest face, or null.
 */
export const detectFace = async (input, { inputSize = 320, scoreThreshold = 0.5 } = {}) => {
  const faceapi = await loadFaceEngine();
  const results = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (!results || results.length === 0) return null;
  const largest = results.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a));
  return {
    descriptor: Array.from(largest.descriptor),
    box: largest.detection.box,
    score: largest.detection.score,
    faceCount: results.length
  };
};

export const descriptorDistance = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

/** Crop the face area (with margin) into a small JPEG data URL for the profile photo */
export const cropFaceThumbnail = (source, box, size = 200) => {
  const srcW = source.videoWidth || source.naturalWidth || source.width;
  const srcH = source.videoHeight || source.naturalHeight || source.height;
  const margin = 0.45;
  const side = Math.max(box.width, box.height) * (1 + margin * 2);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const sx = Math.max(0, Math.min(srcW - side, cx - side / 2));
  const sy = Math.max(0, Math.min(srcH - side, cy - side / 2));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, sx, sy, Math.min(side, srcW), Math.min(side, srcH), 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.82);
};

/**
 * Passport-style portrait (head and shoulders, 3:4) for the printed ID card.
 * Areas outside the source image are filled with white.
 */
export const cropPortrait = (source, box, width = 360, height = 480) => {
  const srcW = source.videoWidth || source.naturalWidth || source.width;
  const srcH = source.videoHeight || source.naturalHeight || source.height;
  const cropH = box.height * 2.6;
  const cropW = cropH * (width / height);
  const cx = box.x + box.width / 2;
  const top = box.y - box.height * 0.75;
  const sx = cx - cropW / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const scale = width / cropW;
  ctx.drawImage(source, 0, 0, srcW, srcH, -sx * scale, -top * scale, srcW * scale, srcH * scale);
  return canvas.toDataURL('image/jpeg', 0.85);
};

/** Load a File (photo upload) into an <img> element */
export const fileToImage = (file) => new Promise((resolve, reject) => {
  if (!file || !/^image\//.test(file.type)) {
    reject(new Error('Please choose an image file (JPG or PNG).'));
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('Could not read this image.'));
  };
  img.src = url;
});

export const cameraErrorMessage = (err) => {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access in your browser settings and reload.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Camera needs a secure (https) connection.';
  }
  return err?.message || 'Could not start the camera.';
};
