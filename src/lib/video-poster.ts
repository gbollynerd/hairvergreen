// Client-only helper: grab a frame from a video to use as its thumbnail (poster).

export type PosterResult = { blob: Blob; width: number; height: number; duration: number };

/** Loads the video (a File or a CORS-enabled URL), seeks a little way in and draws that frame to a JPEG. */
export function captureVideoPoster(source: File | string, atSeconds = 0.5, maxWidth = 1200): Promise<PosterResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl ?? (source as string);
    const cleanup = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); video.removeAttribute('src'); video.load(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out reading the video')); }, 20000);
    video.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('This video format cannot be read in the browser')); };
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(atSeconds, d > 0 ? d / 3 : 0);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
        const w = Math.round((video.videoWidth || 800) * scale);
        const h = Math.round((video.videoHeight || 1000) * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const vw = video.videoWidth; const vh = video.videoHeight;
        canvas.toBlob((blob) => {
          cleanup();
          if (blob) resolve({ blob, width: vw, height: vh, duration });
          else reject(new Error('Could not create a thumbnail'));
        }, 'image/jpeg', 0.82);
      } catch (e) { cleanup(); reject(e instanceof Error ? e : new Error('Could not create a thumbnail')); }
    };
  });
}
