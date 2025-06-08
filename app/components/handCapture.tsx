// HandCaptureRect.tsx
"use client";
import { useRef, useState, useEffect } from "react";
import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import cvReadyPromise from "@techstark/opencv-js";

interface OpenCVMat {
  delete: () => void;
  data32F: Float32Array;
  rows: number;
  cols: number;
  clone: () => OpenCVMat;
}

interface OpenCV {
  cv: {
    imread: (canvas: HTMLCanvasElement) => OpenCVMat;
    Mat: new () => OpenCVMat;
    MatVector: new () => {
      size: () => number;
      get: (i: number) => OpenCVMat;
      delete: () => void;
    };
    Size: new (width: number, height: number) => {
      width: number;
      height: number;
    };
    COLOR_RGBA2GRAY: number;
    RETR_EXTERNAL: number;
    CHAIN_APPROX_SIMPLE: number;
    CV_32FC2: number;
    cvtColor: (
      src: OpenCVMat,
      dst: OpenCVMat,
      code: number,
      dstCn: number
    ) => void;
    GaussianBlur: (
      src: OpenCVMat,
      dst: OpenCVMat,
      ksize: { width: number; height: number },
      sigmaX: number
    ) => void;
    Canny: (
      src: OpenCVMat,
      dst: OpenCVMat,
      threshold1: number,
      threshold2: number
    ) => void;
    findContours: (
      image: OpenCVMat,
      contours: { size: () => number; get: (i: number) => OpenCVMat },
      hierarchy: OpenCVMat,
      mode: number,
      method: number
    ) => void;
    approxPolyDP: (
      curve: OpenCVMat,
      approxCurve: OpenCVMat,
      epsilon: number,
      closed: boolean
    ) => void;
    boundingRect: (points: OpenCVMat) => { width: number; height: number };
    arcLength: (curve: OpenCVMat, closed: boolean) => number;
    matFromArray: (
      rows: number,
      cols: number,
      type: number,
      array: number[]
    ) => OpenCVMat;
    getPerspectiveTransform: (src: OpenCVMat, dst: OpenCVMat) => OpenCVMat;
    warpPerspective: (
      src: OpenCVMat,
      dst: OpenCVMat,
      M: OpenCVMat,
      dsize: { width: number; height: number }
    ) => void;
    imshow: (canvas: HTMLCanvasElement, mat: OpenCVMat) => void;
  };
}

declare global {
  interface Window {
    cv: OpenCV["cv"];
  }
}

export default function HandCaptureRect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [ringWidth, setRingWidth] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );
  const streamRef = useRef<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [cv, setCv] = useState<typeof import("@techstark/opencv-js") | null>(
    null
  );

  const CAPTURE_SIZE = 300;
  const CARD_WIDTH_MM = 85.6;

  useEffect(() => {
    const checkMobile = () => {
      const userAgent =
        typeof window !== "undefined" ? window.navigator.userAgent : "";
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        userAgent
      );
    };
    setIsMobile(checkMobile());
  }, []);

  useEffect(() => {
    const initOpenCV = async () => {
      try {
        const cv = await cvReadyPromise;
        console.log("OpenCV.js is ready!");
        console.log(cv.getBuildInformation());
        setCv(cv);
      } catch (error) {
        console.error("Error initializing OpenCV:", error);
      }
    };
    initOpenCV();
  }, []);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        if (!videoRef.current) return;

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: isMobile ? "environment" : "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        await initializeHandLandmarker();
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    initializeCamera();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [isMobile]);

  const initializeHandLandmarker = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/hand_landmarker.task",
          delegate: "GPU",
        },
        numHands: 1,
        runningMode: "IMAGE",
      });
      setHandLandmarker(landmarker);
      console.log("Hand landmarker initialized");
    } catch (error) {
      console.error("Error initializing hand landmarker:", error);
    }
  };

  const warpImageByCard = async (
    canvas: HTMLCanvasElement
  ): Promise<{ canvas: HTMLCanvasElement; mmPerPixel: number } | null> => {
    if (!cv) {
      console.error("OpenCV not initialized");
      return null;
    }

    setStatusMessage("🃏 Detectando tarjeta...");

    const src = cv.imread(canvas);
    const dst = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    // Convert to grayscale and apply blur
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(src, src, new cv.Size(5, 5), 0);
    cv.Canny(src, dst, 50, 150);

    // Find contours
    cv.findContours(
      dst,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    console.log("Número de contornos encontrados:", contours.size());

    let bestQuad = null;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const approx = new cv.Mat();
      cv.approxPolyDP(
        contour,
        approx,
        0.02 * cv.arcLength(contour, true),
        true
      );

      console.log(`Contorno ${i}:`, {
        puntos: approx.rows,
        area: cv.contourArea(contour),
      });

      if (approx.rows === 4) {
        const rect = cv.boundingRect(approx);
        const aspectRatio = rect.width / rect.height;
        console.log(`Contorno ${i} - Aspect ratio:`, aspectRatio);

        if (aspectRatio > 1.4 && aspectRatio < 1.8) {
          bestQuad = approx.clone();
          console.log("¡Tarjeta encontrada! Aspect ratio:", aspectRatio);
          approx.delete();
          break;
        }
      }
      contour.delete();
    }

    if (!bestQuad) {
      console.log("No se encontró ningún contorno con forma de tarjeta");
      src.delete();
      dst.delete();
      contours.delete();
      hierarchy.delete();
      return null;
    }

    setStatusMessage("📐 Corrigiendo perspectiva...");

    const sorted = [];
    for (let i = 0; i < 4; i++) {
      sorted.push({
        x: bestQuad.data32F[i * 2],
        y: bestQuad.data32F[i * 2 + 1],
      });
    }

    sorted.sort((a, b) => a.y - b.y);
    const [tl, tr] =
      sorted[0].x < sorted[1].x
        ? [sorted[0], sorted[1]]
        : [sorted[1], sorted[0]];
    const [bl, br] =
      sorted[2].x < sorted[3].x
        ? [sorted[2], sorted[3]]
        : [sorted[3], sorted[2]];

    const width = Math.max(
      Math.hypot(tr.x - tl.x, tr.y - tl.y),
      Math.hypot(br.x - bl.x, br.y - bl.y)
    );
    const height = Math.max(
      Math.hypot(bl.x - tl.x, bl.y - tl.y),
      Math.hypot(br.x - tr.x, br.y - tr.y)
    );

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x,
      tl.y,
      tr.x,
      tr.y,
      br.x,
      br.y,
      bl.x,
      bl.y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      width,
      0,
      width,
      height,
      0,
      height,
    ]);

    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(width, height));

    const warpedCanvas = document.createElement("canvas");
    warpedCanvas.width = width;
    warpedCanvas.height = height;
    cv.imshow(warpedCanvas, warped);

    src.delete();
    dst.delete();
    contours.delete();
    hierarchy.delete();
    bestQuad.delete();
    M.delete();
    srcTri.delete();
    dstTri.delete();
    warped.delete();

    const mmPerPixel = CARD_WIDTH_MM / width;

    return { canvas: warpedCanvas, mmPerPixel };
  };

  const processImage = async (
    imageUrl: string,
    handLandmarker: HandLandmarker,
    setConfidence: (c: number) => void,
    setRingWidth: (w: number) => void,
    setShowPopup: (b: boolean) => void,
    overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>,
    mmPerPixel: number
  ) => {
    try {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.width = CAPTURE_SIZE;
      img.height = CAPTURE_SIZE;
      await new Promise<void>((res) => (img.onload = () => res()));

      const ctx = overlayCanvasRef.current?.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
      ctx.drawImage(img, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

      const results = handLandmarker.detect(img);
      if (!results.landmarks.length) return;

      const landmarks = results.landmarks[0];
      const worldLandmarks = results.worldLandmarks[0];

      const avgConfidence =
        worldLandmarks.reduce((sum, l) => sum + l.z, 0) / worldLandmarks.length;
      setConfidence(Number((avgConfidence * 100).toFixed(1)));

      const px = (l: NormalizedLandmark) => l.x * CAPTURE_SIZE;
      const py = (l: NormalizedLandmark) => l.y * CAPTURE_SIZE;

      const dist = (p: NormalizedLandmark, q: NormalizedLandmark) =>
        Math.hypot(px(p) - px(q), py(p) - py(q)) * mmPerPixel;

      const pipRingToMiddle = dist(landmarks[14], landmarks[10]);
      const pipMiddleToIndex = dist(landmarks[10], landmarks[6]);
      const avgWidthMM = (pipRingToMiddle + pipMiddleToIndex) / 2;

      setRingWidth(Number((avgWidthMM / 10).toFixed(1)));
      setShowPopup(true);

      const drawingUtils = new DrawingUtils(ctx);
      drawingUtils.drawConnectors(
        landmarks,
        GestureRecognizer.HAND_CONNECTIONS,
        {
          color: "#00FF00",
          lineWidth: 1,
        }
      );
      drawingUtils.drawLandmarks(landmarks, {
        color: "#FF0000",
        lineWidth: 1,
      });
    } catch (err) {
      console.error("Error processing image:", err);
    }
  };
  const capture = async () => {
    if (!videoRef.current || !canvasRef.current || !handLandmarker) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { videoWidth, videoHeight } = video;
    const side = Math.min(videoWidth, videoHeight);
    const sx = (videoWidth - side) / 2;
    const sy = (videoHeight - side) / 2;

    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;

    context.drawImage(
      video,
      sx,
      sy,
      side,
      side,
      0,
      0,
      CAPTURE_SIZE,
      CAPTURE_SIZE
    );

    const warped = await warpImageByCard(canvas);
    if (!warped) {
      alert(
        "No se pudo corregir la perspectiva de la tarjeta. Asegúrate de que esté visible y bien encuadrada."
      );
      return;
    }

    setStatusMessage("✋ Midiendo dedo...");

    const imageData = warped.canvas.toDataURL("image/jpeg", 1.0);
    setCapturedImage(imageData);

    await processImage(
      imageData,
      handLandmarker,
      setConfidence,
      setRingWidth,
      setShowPopup,
      overlayCanvasRef,
      warped.mmPerPixel
    );

    setStatusMessage(null);

    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  return (
    <div className="relative w-full max-w-[480px] h-[360px] mx-auto">
      {statusMessage && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-white rounded-full shadow-md text-sm text-gray-800">
          {statusMessage}
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover rounded-2xl shadow-lg scale-x-[-1]"
      />

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div
          className="absolute border-4 border-white/90 rounded-lg shadow-lg"
          style={{
            width: `${CAPTURE_SIZE}px`,
            height: `${CAPTURE_SIZE}px`,
            top: "30px",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        ></div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <button
        onClick={capture}
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200 z-10"
      >
        Tomar foto
      </button>

      {capturedImage && (
        <div className="mt-8 text-center">
          <div
            className="relative mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
            style={{
              width: `${CAPTURE_SIZE}px`,
              height: `${CAPTURE_SIZE}px`,
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <img
              src={capturedImage}
              alt="Captura"
              width={CAPTURE_SIZE}
              height={CAPTURE_SIZE}
              className="w-full h-full object-contain scale-x-[-1]"
            />
            <canvas
              ref={overlayCanvasRef}
              width={CAPTURE_SIZE}
              height={CAPTURE_SIZE}
              className="absolute top-0 left-0 w-full h-full"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Las medidas se mostrarán en la consola
          </p>
        </div>
      )}

      {showPopup && ringWidth !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Medida del Anillo
            </h3>
            <p className="text-4xl font-bold text-blue-600 text-center mb-2">
              {ringWidth} cm
            </p>
            {confidence !== null && (
              <p className="text-sm text-gray-600 text-center mb-6">
                Confianza: {confidence}%
              </p>
            )}
            <button
              onClick={() => setShowPopup(false)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
