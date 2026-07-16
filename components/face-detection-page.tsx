"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Users, AlertTriangle, CheckCircle2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  initFaceDetector,
  detectFaces,
  detectFacesFromUrl,
  isFaceDetectorSupported,
  type DetectedFace,
  type FaceDetectorStatus,
} from "@/lib/face-detect";

type DetectionMode = "camera" | "upload" | null;

export default function FaceDetectionPage() {
  const [mode, setMode] = useState<DetectionMode>(null);
  const [detectorStatus, setDetectorStatus] = useState<FaceDetectorStatus>({
    type: "loading",
  });
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize detector on mount
  useEffect(() => {
    const init = async () => {
      const status = await initFaceDetector();
      setDetectorStatus(status);
    };
    init();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    setError(null);
    setMode("camera");
    setUploadedImage(null);
    setFaces([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setError(
        err?.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions."
          : "Failed to access camera: " + (err?.message || "Unknown error")
      );
      setMode(null);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setMode(null);
    setFaces([]);
  }, []);

  // Detect faces from video frame
  const detectFromVideo = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detect faces
    setIsDetecting(true);
    const detected = await detectFaces(canvas);
    setFaces(detected);
    setIsDetecting(false);

    // Draw bounding boxes
    drawBoundingBoxes(ctx, detected, canvas.width, canvas.height);

    // Continue loop
    animFrameRef.current = requestAnimationFrame(detectFromVideo);
  }, []);

  // Start detection loop when camera starts
  useEffect(() => {
    if (mode === "camera" && streamRef.current && videoRef.current) {
      // Wait for video to be ready
      const onReady = () => {
        detectFromVideo();
      };
      videoRef.current.addEventListener("loadeddata", onReady, { once: true });
      return () => {
        videoRef.current?.removeEventListener("loadeddata", onReady);
      };
    }
  }, [mode, detectFromVideo]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null);
      setFaces([]);

      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPEG, PNG, etc.)");
        return;
      }

      const url = URL.createObjectURL(file);
      setUploadedImage(url);
      setMode("upload");

      // Wait for image to load then detect
      const img = new Image();
      img.onload = async () => {
        setIsDetecting(true);
        try {
          const detected = await detectFaces(img);
          setFaces(detected);
        } catch (err: any) {
          setError("Detection failed: " + (err?.message || "Unknown error"));
        }
        setIsDetecting(false);
      };
      img.src = url;
    },
    []
  );

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  // Handle file input
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  // Draw bounding boxes on canvas
  const drawBoundingBoxes = (
    ctx: CanvasRenderingContext2D,
    detectedFaces: DetectedFace[],
    width: number,
    height: number
  ) => {
    // Clear previous drawings (but keep the video frame)
    ctx.clearRect(0, 0, width, height);

    // If we're in camera mode, redraw the video frame first
    if (mode === "camera" && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    }

    // Draw boxes
    detectedFaces.forEach((face, i) => {
      const { x, y, width: fw, height: fh } = face.box;

      // Bounding box
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, fw, fh);

      // Corner accents
      const accentLen = 12;
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 4;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x, y + accentLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + accentLen, y);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + fw - accentLen, y);
      ctx.lineTo(x + fw, y);
      ctx.lineTo(x + fw, y + accentLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + fh - accentLen);
      ctx.lineTo(x, y + fh);
      ctx.lineTo(x + accentLen, y + fh);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + fw - accentLen, y + fh);
      ctx.lineTo(x + fw, y + fh);
      ctx.lineTo(x + fw, y + fh - accentLen);
      ctx.stroke();

      // Face count label
      ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(`Face #${i + 1}`, x + 6, y - 8);
    });
  };

  // Draw overlay on upload image
  useEffect(() => {
    if (mode === "upload" && canvasRef.current && imageRef.current && faces.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = imageRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw boxes
      drawBoundingBoxes(ctx, faces, canvas.width, canvas.height);
    }
  }, [faces, mode]);

  // Reset
  const resetAll = useCallback(() => {
    stopCamera();
    setMode(null);
    setFaces([]);
    setUploadedImage(null);
    setError(null);
  }, [stopCamera]);

  // Render status badge
  const renderStatusBadge = () => {
    switch (detectorStatus.type) {
      case "loading":
        return (
          <Badge variant="outline" className="gap-1.5">
            <Spinner className="h-3 w-3" />
            Loading detector...
          </Badge>
        );
      case "ready":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Detector ready
          </Badge>
        );
      case "unsupported":
        return (
          <Badge
            variant="destructive"
            className="gap-1.5"
          >
            <AlertTriangle className="h-3 w-3" />
            Unsupported browser
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Error
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Facely</h1>
              <p className="text-xs text-slate-400">Real-time face detection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {renderStatusBadge()}
            {mode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAll}
                className="text-slate-400 hover:text-white"
              >
                <X className="mr-1.5 h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Mode selector or detection view */}
        {!mode ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Camera mode */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card
                className={cn(
                  "group cursor-pointer border-white/5 bg-white/[0.03] transition-all hover:border-emerald-500/30 hover:bg-white/[0.06]",
                  detectorStatus.type === "unsupported" && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => {
                  if (detectorStatus.type !== "unsupported") startCamera();
                }}
              >
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                    <Camera className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <CardTitle className="mb-1 text-white">Live Camera</CardTitle>
                    <p className="text-sm text-slate-400">
                      Detect faces in real-time from your webcam
                    </p>
                  </div>
                  {detectorStatus.type === "unsupported" && (
                    <p className="text-xs text-red-400">
                      FaceDetector API not supported in this browser
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Upload mode */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card
                className={cn(
                  "border border-dashed border-white/10 bg-white/[0.02] transition-all",
                  dragOver && "border-emerald-500/50 bg-emerald-500/5"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <CardContent
                  className="flex cursor-pointer flex-col items-center gap-4 py-12"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <Upload className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <CardTitle className="mb-1 text-white">Upload Image</CardTitle>
                    <p className="text-sm text-slate-400">
                      Drag & drop or click to upload a photo
                    </p>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        ) : (
          /* Detection view */
          <div className="space-y-6">
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video / Image area */}
            <div className="relative mx-auto max-w-2xl">
              {/* Video (camera mode) */}
              {mode === "camera" && (
                <video
                  ref={videoRef}
                  className="w-full rounded-xl border border-white/5"
                  muted
                  playsInline
                />
              )}

              {/* Uploaded image */}
              {mode === "upload" && uploadedImage && (
                <div className="relative">
                  <img
                    ref={imageRef}
                    src={uploadedImage}
                    alt="Uploaded"
                    className="w-full rounded-xl border border-white/5"
                    onLoad={() => {
                      // Canvas overlay will be drawn by the useEffect
                    }}
                  />
                </div>
              )}

              {/* Detection canvas overlay */}
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-xl"
              />

              {/* Detection overlay info */}
              <AnimatePresence>
                {isDetecting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40"
                  >
                    <div className="flex items-center gap-2 text-white">
                      <Spinner className="h-5 w-5" />
                      <span className="text-sm">Detecting faces...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Results bar */}
            <div className="mx-auto max-w-2xl">
              <Card className="border-white/5 bg-white/[0.03]">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm text-slate-300">
                      Faces detected:
                    </span>
                    <span className="text-2xl font-bold text-white">
                      {faces.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAll}
                      className="border-white/10 text-slate-400 hover:text-white"
                    >
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      New detection
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Face details */}
              {faces.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {faces.map((face, i) => (
                    <Card
                      key={i}
                      className="border-white/5 bg-white/[0.03]"
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-400">
                            {i + 1}
                          </span>
                          Face #{i + 1}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>
                            <span className="text-slate-500">X:</span>{" "}
                            {Math.round(face.box.x)}px
                          </div>
                          <div>
                            <span className="text-slate-500">Y:</span>{" "}
                            {Math.round(face.box.y)}px
                          </div>
                          <div>
                            <span className="text-slate-500">Width:</span>{" "}
                            {Math.round(face.box.width)}px
                          </div>
                          <div>
                            <span className="text-slate-500">Height:</span>{" "}
                            {Math.round(face.box.height)}px
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
