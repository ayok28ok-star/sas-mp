import * as faceapi from '@vladmandic/face-api';
import { Student } from '../types/attendance';

export interface DetectedFaceResult {
  box: { x: number; y: number; width: number; height: number };
  landmarks: Array<{ x: number; y: number }>;
  descriptor: number[];
  score: number;
  facePhoto: string;
}

export interface FaceMatchResult {
  student: Student;
  distance: number;
  confidencePct: number;
}

export type LightingQualityLevel = 'dark' | 'dim' | 'good' | 'bright';

export interface LightingQualityResult {
  level: LightingQualityLevel;
  brightness: number;
  centerBrightness: number;
  scorePct: number;
  label: string;
  guidance: string;
}

const MODEL_SOURCES = [
  '/models',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
  'https://unpkg.com/@vladmandic/face-api@1.7.15/model',
];

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;
let cpuFallbackApplied = false;

async function ensureCpuBackendFallback(): Promise<boolean> {
  if (cpuFallbackApplied) return false;
  try {
    const tf = (faceapi as unknown as {
      tf?: { setBackend?: (name: string) => Promise<boolean>; ready?: () => Promise<void> };
    }).tf;
    if (tf && typeof tf.setBackend === 'function') {
      await tf.setBackend('cpu');
      if (typeof tf.ready === 'function') {
        await tf.ready();
      }
      cpuFallbackApplied = true;
      return true;
    }
  } catch (err) {
    console.warn('CPU backend fallback warning:', err);
  }
  return false;
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const tryLoadFrom = async (baseUrl: string) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
      ]);
    };

    let lastError: unknown = null;
    for (const url of MODEL_SOURCES) {
      try {
        await tryLoadFrom(url);
        modelsLoaded = true;
        return;
      } catch (err) {
        lastError = err;
        console.warn(`Gagal memuat model wajah dari ${url}, mencoba sumber berikutnya...`, err);
      }
    }

    loadingPromise = null;
    throw lastError || new Error('Semua sumber model deteksi wajah gagal dimuat.');
  })();

  return loadingPromise;
}

export function areFaceModelsLoaded(): boolean {
  return modelsLoaded;
}

export function normalizeFaceInputSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): HTMLVideoElement | HTMLCanvasElement {
  if (source instanceof HTMLVideoElement) {
    return source;
  }

  const srcW =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const srcH =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;

  const maxDim = 960;
  if (!srcW || !srcH) {
    return source as HTMLCanvasElement;
  }

  if (source instanceof HTMLCanvasElement && srcW <= maxDim && srcH <= maxDim) {
    return source;
  }

  const ratio = srcW > maxDim || srcH > maxDim ? Math.min(maxDim / srcW, maxDim / srcH) : 1;
  const targetW = Math.max(1, Math.round(srcW * ratio));
  const targetH = Math.max(1, Math.round(srcH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return source as HTMLCanvasElement;
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas;
}

export function captureVideoFrameCanvas(video: HTMLVideoElement): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const maxDim = 960;
  const ratio = vw > maxDim || vh > maxDim ? Math.min(maxDim / vw, maxDim / vh) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(vw * ratio));
  canvas.height = Math.max(1, Math.round(vh * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function compressFaceThumbnail(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  box?: { x: number; y: number; width: number; height: number },
  targetSize = 160
): string {
  const srcW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const srcH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;

  if (!srcW || !srcH) return '';

  let sx = 0;
  let sy = 0;
  let sSize = Math.min(srcW, srcH);

  if (box && box.width > 10 && box.height > 10) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const padded = Math.max(box.width, box.height) * 1.45;
    sSize = Math.min(Math.max(padded, 64), Math.min(srcW, srcH));
    sx = Math.max(0, Math.min(srcW - sSize, cx - sSize / 2));
    sy = Math.max(0, Math.min(srcH - sSize, cy - sSize / 2));
  } else {
    sx = (srcW - sSize) / 2;
    sy = (srcH - sSize) / 2;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(source, sx, sy, sSize, sSize, 0, 0, targetSize, targetSize);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export async function detectSingleFaceWithDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<DetectedFaceResult | null> {
  await loadFaceModels();

  const isLiveVideo = input instanceof HTMLVideoElement;
  const normalized = normalizeFaceInputSource(input);

  const runDetection = async (inputSize: number, scoreThreshold: number) => {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize,
      scoreThreshold,
    });
    return faceapi
      .detectAllFaces(normalized, options)
      .withFaceLandmarks(true)
      .withFaceDescriptors();
  };

  let detections;
  try {
    detections = await runDetection(320, 0.42);
    // For static phone photos or snapshots, retry once with higher input resolution & softer threshold
    if ((!detections || detections.length === 0) && !isLiveVideo) {
      detections = await runDetection(416, 0.28);
    }
  } catch (err) {
    // Fallback to CPU backend if WebGL shader fails on mobile WebView / iframe
    const switched = await ensureCpuBackendFallback();
    if (!switched) throw err;
    detections = await runDetection(320, 0.4);
    if ((!detections || detections.length === 0) && !isLiveVideo) {
      detections = await runDetection(416, 0.28);
    }
  }

  if (!detections || detections.length === 0) {
    return null;
  }

  const primary = detections.reduce((best, cur) => {
    const bestArea = best.detection.box.width * best.detection.box.height;
    const curArea = cur.detection.box.width * cur.detection.box.height;
    return curArea > bestArea ? cur : best;
  });

  const rawBox = primary.detection.box;
  const box = {
    x: rawBox.x,
    y: rawBox.y,
    width: rawBox.width,
    height: rawBox.height,
  };

  const landmarks = primary.landmarks.positions.map((pt) => ({ x: pt.x, y: pt.y }));
  const descriptor = Array.from(primary.descriptor).map((v) => Number(v.toFixed(4)));
  const facePhoto = compressFaceThumbnail(normalized, box, 160);

  return {
    box,
    landmarks,
    descriptor,
    score: primary.detection.score,
    facePhoto,
  };
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function findBestFaceMatch(
  descriptor: number[],
  students: Student[],
  threshold = 0.52
): FaceMatchResult | null {
  let bestStudent: Student | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const s of students) {
    if (!Array.isArray(s.faceDescriptor) || s.faceDescriptor.length !== 128) continue;
    const dist = euclideanDistance(descriptor, s.faceDescriptor);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestStudent = s;
    }
  }

  if (!bestStudent || bestDistance > threshold) {
    return null;
  }

  const confidencePct = Math.max(55, Math.min(99, Math.round((1 - bestDistance / 0.85) * 100)));
  return {
    student: bestStudent,
    distance: Number(bestDistance.toFixed(4)),
    confidencePct,
  };
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat berkas foto wajah.'));
    };
    img.src = url;
  });
}

export function drawFaceOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detected: DetectedFaceResult | null,
  label?: string,
  matched?: boolean
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, vw, vh);

  if (!detected) return;

  const { x, y, width, height } = detected.box;
  const strokeColor = matched ? '#10b981' : '#f59e0b';

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, Math.round(vw / 240));
  ctx.strokeRect(x, y, width, height);

  const corner = Math.min(22, width * 0.22, height * 0.22);
  ctx.lineWidth = Math.max(4, Math.round(vw / 150));
  ctx.beginPath();
  ctx.moveTo(x, y + corner);
  ctx.lineTo(x, y);
  ctx.lineTo(x + corner, y);
  ctx.moveTo(x + width - corner, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + corner);
  ctx.moveTo(x, y + height - corner);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.moveTo(x + width - corner, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - corner);
  ctx.stroke();

  ctx.fillStyle = matched ? 'rgba(52, 211, 153, 0.85)' : 'rgba(251, 191, 36, 0.85)';
  for (const pt of detected.landmarks) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (label) {
    const fontSize = Math.max(13, Math.round(vw / 32));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const padX = 10;
    const textW = ctx.measureText(label).width;
    const boxW = textW + padX * 2;
    const boxH = fontSize + 12;
    const lx = Math.max(4, Math.min(vw - boxW - 4, x));
    const ly = Math.max(4, y - boxH - 6);

    ctx.fillStyle = matched ? 'rgba(5, 150, 105, 0.92)' : 'rgba(217, 119, 6, 0.92)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(lx, ly, boxW, boxH, 8);
    } else {
      ctx.rect(lx, ly, boxW, boxH);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, lx + padX, ly + fontSize + 4);
  }
}

let lightingSampleCanvas: HTMLCanvasElement | null = null;
let lightingSampleCtx: CanvasRenderingContext2D | null = null;

/**
 * Menganalisis kualitas pencahayaan frame video/foto secara ringan (~48x48px)
 * dengan bobot lebih besar di area tengah tempat wajah siswa berada.
 */
export function analyzeFrameLighting(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): LightingQualityResult | null {
  if (typeof document === 'undefined') return null;

  if (source instanceof HTMLVideoElement) {
    if (source.readyState < 2 || !source.videoWidth || !source.videoHeight) return null;
  } else if (source instanceof HTMLImageElement) {
    if (!source.naturalWidth && !source.width) return null;
  } else if (!source.width || !source.height) {
    return null;
  }

  const size = 48;
  if (!lightingSampleCanvas) {
    lightingSampleCanvas = document.createElement('canvas');
    lightingSampleCanvas.width = size;
    lightingSampleCanvas.height = size;
    lightingSampleCtx = lightingSampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  const ctx = lightingSampleCtx;
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let totalLuma = 0;
    let centerLuma = 0;
    let centerCount = 0;
    const totalPixels = size * size;
    const minC = Math.floor(size * 0.25);
    const maxC = Math.ceil(size * 0.75);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        totalLuma += luma;
        if (x >= minC && x < maxC && y >= minC && y < maxC) {
          centerLuma += luma;
          centerCount++;
        }
      }
    }

    const overallBrightness = totalLuma / totalPixels;
    const centerBrightness = centerCount > 0 ? centerLuma / centerCount : overallBrightness;
    const brightness = Math.round(centerBrightness * 0.65 + overallBrightness * 0.35);

    if (brightness < 55 || (centerBrightness < 50 && overallBrightness < 70)) {
      const scorePct = Math.max(5, Math.min(34, Math.round((brightness / 55) * 34)));
      return {
        level: 'dark',
        brightness,
        centerBrightness: Math.round(centerBrightness),
        scorePct,
        label: 'Terlalu Gelap',
        guidance:
          'Kondisi pencahayaan terlalu gelap. Pindah ke tempat lebih terang atau hadapkan wajah ke sumber cahaya.',
      };
    }

    if (brightness < 90) {
      const scorePct = Math.max(35, Math.min(68, Math.round(35 + ((brightness - 55) / 35) * 33)));
      return {
        level: 'dim',
        brightness,
        centerBrightness: Math.round(centerBrightness),
        scorePct,
        label: 'Agak Redup',
        guidance:
          'Cahaya agak redup — tambahkan pencahayaan agar deteksi wajah lebih cepat dan akurat.',
      };
    }

    if (brightness <= 215) {
      const scorePct = Math.max(
        72,
        Math.min(100, Math.round(100 - Math.min(28, Math.abs(brightness - 145) * 0.35)))
      );
      return {
        level: 'good',
        brightness,
        centerBrightness: Math.round(centerBrightness),
        scorePct,
        label: 'Cahaya Baik',
        guidance: 'Pencahayaan ideal dan merata untuk pemindaian wajah.',
      };
    }

    const scorePct = Math.max(40, Math.min(72, Math.round(72 - ((brightness - 215) / 40) * 32)));
    return {
      level: 'bright',
      brightness,
      centerBrightness: Math.round(centerBrightness),
      scorePct,
      label: 'Terlalu Silau',
      guidance:
        'Cahaya terlalu terang atau silau. Hindari sorotan lampu langsung di belakang/depan kamera.',
    };
  } catch {
    return null;
  }
}

