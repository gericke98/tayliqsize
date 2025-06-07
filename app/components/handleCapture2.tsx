// HandCaptureRect.tsx
"use client";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

export default function HandCaptureRect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const REAL_CARD_WIDTH_MM = 85.6; // ancho estándar de tarjeta bancaria/DNI

  useEffect(() => {
    // Initialize camera with better constraints for iPhone
    const initializeCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: isFrontCamera ? "user" : "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // iPhone specific constraints
            frameRate: { ideal: 30 },
            aspectRatio: { ideal: 1.333333 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    initializeCamera();

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

    initializeHandLandmarker();

    // Cleanup function
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isFrontCamera]); // Re-initialize when camera changes

  const switchCamera = async () => {
    // Stop current stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    // Switch camera
    setIsFrontCamera(!isFrontCamera);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/png");
        setCapturedImage(dataUrl);
        processImage(dataUrl);
      }
    }
  };

  const processImage = async (imageUrl: string) => {
    if (!handLandmarker) {
      console.error("Hand landmarker not initialized");
      return;
    }

    try {
      const img = document.createElement("img");
      img.src = imageUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const results = handLandmarker.detect(img);

      if (results.landmarks.length > 0) {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        const drawingUtils = new DrawingUtils(ctx);
        const landmarks = results.landmarks[0];

        drawingUtils.drawConnectors(
          landmarks,
          GestureRecognizer.HAND_CONNECTIONS,
          {
            color: "#00FF00",
            lineWidth: 2,
          }
        );
        drawingUtils.drawLandmarks(landmarks, {
          color: "#FF0000",
          lineWidth: 1,
        });

        // 🧠 SUPONEMOS QUE EL USUARIO HA COLOCADO UNA TARJETA VERTICAL JUSTO A LA IZQUIERDA DE LA MANO
        // Pide que el usuario la coloque alineada con el borde del vídeo

        const cardLeftPx = 20;
        const cardRightPx = 20 + 85; // supondremos 85px de ancho en imagen aprox
        const cardWidthPx = cardRightPx - cardLeftPx;
        const scaleMMperPx = REAL_CARD_WIDTH_MM / cardWidthPx;

        const pip = landmarks[14];
        const mcp = landmarks[13];
        const pixelWidth = Math.abs((pip.x - mcp.x) * img.width);
        const fingerWidthMM = pixelWidth * scaleMMperPx;

        console.log(
          "🧠 Ring finger width (at PIP):",
          fingerWidthMM.toFixed(2),
          "mm"
        );
      } else {
        console.log("No hands detected");
      }
    } catch (err) {
      console.error("Image processing error:", err);
    }
  };

  return (
    <div className="relative w-[480px] h-[360px] mx-auto">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover rounded-2xl shadow-lg"
      />

      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
        <button
          onClick={capture}
          className="bg-black text-white px-4 py-2 rounded-lg shadow-md"
        >
          Tomar foto
        </button>
        <button
          onClick={switchCamera}
          className="bg-black text-white px-4 py-2 rounded-lg shadow-md"
        >
          {isFrontCamera ? "Cámara trasera" : "Cámara frontal"}
        </button>
      </div>

      {capturedImage && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Foto tomada:</p>
          <div className="relative w-36 h-36 mx-auto">
            <Image
              src={capturedImage}
              alt="Captura"
              width={300}
              height={300}
              className="mt-2 rounded-lg w-full h-full object-contain"
            />
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
