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

export default function HandCaptureRect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [ringWidth, setRingWidth] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );
  const streamRef = useRef<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showHeightInput, setShowHeightInput] = useState(true);

  const CAPTURE_SIZE = 300;
  // const CARD_WIDTH_MM = 85.6;

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

    if (!showHeightInput) {
      initializeCamera();
    }

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [isMobile, showHeightInput]);

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

  const processImage = async (
    imageUrl: string,
    handLandmarker: HandLandmarker,
    setConfidence: (c: number) => void,
    setRingWidth: (w: number) => void,
    setShowPopup: (b: boolean) => void,
    overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>
  ) => {
    console.log("processImage", imageUrl);
    try {
      console.log("Starting processImage with:", {
        imageUrl: imageUrl.substring(0, 50) + "...",
        userHeight,
        hasOverlayCanvas: !!overlayCanvasRef.current,
      });

      const img = document.createElement("img");
      img.src = imageUrl;
      img.width = CAPTURE_SIZE;
      img.height = CAPTURE_SIZE;
      await new Promise<void>((res) => (img.onload = () => res()));

      console.log("Image loaded, dimensions:", {
        width: img.width,
        height: img.height,
      });

      const ctx = overlayCanvasRef.current?.getContext("2d");
      if (!ctx) {
        console.error("No canvas context available");
        return;
      }

      ctx.clearRect(0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
      ctx.drawImage(img, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

      console.log("Running hand landmarker detection...");
      const results = handLandmarker.detect(img);

      if (!results.landmarks.length) {
        console.log("No hand landmarks detected");
        return;
      }

      const landmarks = results.landmarks[0];

      const avgConfidence = results.handedness[0][0].score;
      console.log("Average confidence:", avgConfidence);
      setConfidence(Number((avgConfidence * 100).toFixed(1)));

      const px = (l: NormalizedLandmark) => l.x * CAPTURE_SIZE;
      const py = (l: NormalizedLandmark) => l.y * CAPTURE_SIZE;

      // Calculate hand length in pixels (from base of palm to middle finger tip)
      const handLengthPx = Math.hypot(
        px(landmarks[0]) - px(landmarks[12]),
        py(landmarks[0]) - py(landmarks[12])
      );

      // Calculate mm per pixel ratio based on height
      // Hand length is approximately 10% of body height (* 0.1 (conversion) * 10 (cm to mm))
      const expectedHandLengthMM = userHeight || 0;
      const mmPerPixel = expectedHandLengthMM / handLengthPx;

      const dist = (p: NormalizedLandmark, q: NormalizedLandmark) =>
        Math.hypot(px(p) - px(q), py(p) - py(q)) * mmPerPixel;

      const pipRingToMiddle = dist(landmarks[14], landmarks[10]);
      const pipMiddleToIndex = dist(landmarks[10], landmarks[6]);
      const avgWidthMM = (pipRingToMiddle + pipMiddleToIndex) / 2;

      console.log("Measurements:", {
        handLengthPx,
        expectedHandLengthMM,
        mmPerPixel,
        pipRingToMiddle,
        pipMiddleToIndex,
        avgWidthMM,
      });

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

      console.log("Process completed successfully");
    } catch (err) {
      console.error("Error in processImage:", err);
    }
  };

  const capture = async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !handLandmarker ||
      !userHeight
    )
      return;

    // Reset states for new capture
    setCapturedImage(null);
    setConfidence(null);
    setRingWidth(null);
    setShowPopup(false);

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

    const imageData = canvas.toDataURL("image/jpeg");
    setCapturedImage(imageData);
    setStatusMessage("✋ Midiendo dedo...");

    if (imageData && handLandmarker) {
      await processImage(
        imageData,
        handLandmarker,
        setConfidence,
        setRingWidth,
        setShowPopup,
        overlayCanvasRef
      );
    }

    setStatusMessage(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  return (
    <div className="relative w-full max-w-[480px] h-[360px] mx-auto">
      {showHeightInput ? (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Ingresa tu altura
            </h3>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={userHeight || ""}
                onChange={(e) => setUserHeight(Number(e.target.value))}
                placeholder="Altura en cm"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <span className="text-gray-600">cm</span>
            </div>
            <button
              onClick={() => setShowHeightInput(false)}
              disabled={!userHeight}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200 disabled:bg-gray-400"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}

      {capturedImage && !showHeightInput && (
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
              Medida del Dedo Anular
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
