/**
 * Face detection using the native FaceDetector API (Chromium built-in).
 * No model downloads, no TensorFlow.js, no external dependencies.
 * Falls back gracefully if the API isn't available.
 *
 * The FaceDetector API is supported in Chrome/Edge/Opera and
 * Chromium-based browsers. It uses the OS-level face detection
 * (CoreImage on macOS, Google Play Services on Android, etc.).
 */

export interface DetectedFace {
  /** Bounding box of the face */
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Landmarks (eyes, nose, mouth) if available */
  landmarks: Array<{ x: number; y: number }>;
  /** Confidence score (0-1) — FaceDetector doesn't provide this natively */
  confidence: number;
}

export type DetectionMode = "camera" | "upload";

export type FaceDetectorStatus =
  | { type: "loading" }
  | { type: "ready" }
  | { type: "unsupported"; message: string }
  | { type: "error"; message: string };

let detectorInstance: any = null;
let detectorStatus: FaceDetectorStatus = { type: "loading" };

/**
 * Check if the FaceDetector API is available in this browser.
 */
export function isFaceDetectorSupported(): boolean {
  return typeof window !== "undefined" && "FaceDetector" in window;
}

/**
 * Initialize the face detector.
 * Returns the current status after initialization attempt.
 */
export async function initFaceDetector(): Promise<FaceDetectorStatus> {
  if (detectorStatus.type === "ready" && detectorInstance) {
    return detectorStatus;
  }

  detectorStatus = { type: "loading" };

  try {
    if (!isFaceDetectorSupported()) {
      detectorStatus = {
        type: "unsupported",
        message:
          "FaceDetector API is not available in this browser. Please use Chrome, Edge, or another Chromium-based browser.",
      };
      return detectorStatus;
    }

    // @ts-ignore — FaceDetector is not in all TypeScript libs yet
    detectorInstance = new FaceDetector({
      maxDetectedFaces: 10,
      fastMode: true,
    });

    // Quick test to verify it works
    await detectorInstance.detect(
      new OffscreenCanvas(100, 100) as any
    );

    detectorStatus = { type: "ready" };
    return detectorStatus;
  } catch (err: any) {
    detectorStatus = {
      type: "error",
      message: err?.message || "Failed to initialize face detector",
    };
    return detectorStatus;
  }
}

/**
 * Detect faces in an HTML image or video element.
 * Returns an array of detected face bounding boxes.
 */
export async function detectFaces(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas
): Promise<DetectedFace[]> {
  if (!detectorInstance) {
    const status = await initFaceDetector();
    if (status.type !== "ready") {
      return [];
    }
  }

  try {
    // @ts-ignore
    const rawDetections: Array<{
      boundingBox: DOMRectReadOnly;
      landmarks?: Array<{ locations: Array<{ x: number; y: number }> }>;
    }> = await detectorInstance.detect(input);

    return rawDetections.map((d) => ({
      box: {
        x: d.boundingBox.x,
        y: d.boundingBox.y,
        width: d.boundingBox.width,
        height: d.boundingBox.height,
      },
      landmarks: d.landmarks
        ? d.landmarks.flatMap((l) =>
            l.locations.map((loc) => ({ x: loc.x, y: loc.y }))
          )
        : [],
      confidence: 1.0,
    }));
  } catch (err: any) {
    console.error("Face detection error:", err);
    return [];
  }
}

/**
 * Detect faces from a canvas (e.g. captured from webcam).
 */
export async function detectFacesFromCanvas(
  canvas: HTMLCanvasElement
): Promise<DetectedFace[]> {
  return detectFaces(canvas);
}

/**
 * Detect faces from an image URL by loading it into an Image element first.
 */
export async function detectFacesFromUrl(
  imageUrl: string
): Promise<DetectedFace[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const faces = await detectFaces(img);
        resolve(faces);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

/**
 * Get the current detector status without re-initializing.
 */
export function getDetectorStatus(): FaceDetectorStatus {
  return detectorStatus;
}

/**
 * Reset the detector (e.g. on page unmount).
 */
export function resetDetector(): void {
  detectorInstance = null;
  detectorStatus = { type: "loading" };
}
