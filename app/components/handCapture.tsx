// HandCaptureRect.tsx
"use client";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );

  // Medidas reales del rectángulo (en mm)
  const realWidthMM = 200;
  const pixelWidth = 300; // Reduced from 400
  const pixelHeight = 300; // Reduced from 400

  // Add calibration constants
  const CALIBRATION_POINTS = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomLeft: { x: 0, y: 1 },
    bottomRight: { x: 1, y: 1 },
  };

  useEffect(() => {
    // Initialize camera
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });

    // Initialize hand landmarker
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
  }, []);

  const processImage = async (imageUrl: string) => {
    if (!handLandmarker) {
      console.error("Hand landmarker not initialized");
      return;
    }

    try {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.width = pixelWidth;
      img.height = pixelHeight;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const results = handLandmarker.detect(img);

      if (results.landmarks.length > 0) {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        const drawingUtils = new DrawingUtils(ctx);
        const landmarks = results.landmarks[0];

        // Calculate scale factors (mm per pixel) first
        const mmPerPixelX = realWidthMM / pixelWidth;
        const mmPerPixelY = mmPerPixelX; // Use same scale for both axes to maintain proportions

        // Log all hand landmarks
        console.log("🖐️ Hand Landmarks (1-21):");
        console.log("----------------");
        landmarks.forEach((landmark, index) => {
          const landmarkNames: Record<number, string> = {
            0: "WRIST",
            1: "THUMB_CMC",
            2: "THUMB_MCP",
            3: "THUMB_IP",
            4: "THUMB_TIP",
            5: "INDEX_FINGER_MCP",
            6: "INDEX_FINGER_PIP",
            7: "INDEX_FINGER_DIP",
            8: "INDEX_FINGER_TIP",
            9: "MIDDLE_FINGER_MCP",
            10: "MIDDLE_FINGER_PIP",
            11: "MIDDLE_FINGER_DIP",
            12: "MIDDLE_FINGER_TIP",
            13: "RING_FINGER_MCP",
            14: "RING_FINGER_PIP",
            15: "RING_FINGER_DIP",
            16: "RING_FINGER_TIP",
            17: "PINKY_MCP",
            18: "PINKY_PIP",
            19: "PINKY_DIP",
            20: "PINKY_TIP",
          };

          // Convert normalized coordinates to pixels
          const xPx = landmark.x * img.width;
          const yPx = landmark.y * img.height;

          // Convert to millimeters using the scale
          const xMM = xPx * mmPerPixelX;
          const yMM = yPx * mmPerPixelY;

          console.log(`${index + 1}. ${landmarkNames[index]}:`);
          console.log(
            `   Normalized: (${landmark.x.toFixed(3)}, ${landmark.y.toFixed(
              3
            )})`
          );
          console.log(`   Pixels: (${xPx.toFixed(1)}, ${yPx.toFixed(1)})`);
          console.log(`   Millimeters: (${xMM.toFixed(1)}, ${yMM.toFixed(1)})`);
          console.log("----------------");
        });

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

        // Calculate and log real distances for key points
        const keyPoints = {
          wrist: landmarks[0],
          indexTip: landmarks[8],
          middleTip: landmarks[12],
          ringTip: landmarks[16],
          pinkyTip: landmarks[20],
          indexMCP: landmarks[5],
          middleMCP: landmarks[9],
          ringMCP: landmarks[13],
          pinkyMCP: landmarks[17],
          indexPIP: landmarks[6],
          middlePIP: landmarks[10],
          ringPIP: landmarks[14],
          pinkyPIP: landmarks[18],
        };

        // Calculate distances between key points
        const calculateDistance = (
          point1: NormalizedLandmark,
          point2: NormalizedLandmark
        ) => {
          const dx = (point1.x - point2.x) * img.width;
          const dy = (point1.y - point2.y) * img.height;
          const distancePx = Math.sqrt(dx * dx + dy * dy);
          return distancePx * mmPerPixelX;
        };

        // Log distances
        console.log("📏 Finger Measurements:");
        console.log("----------------");

        // Index finger
        console.log("Index Finger:");
        console.log(
          `MCP to Tip: ${calculateDistance(
            keyPoints.indexMCP,
            keyPoints.indexTip
          ).toFixed(1)}mm`
        );
        console.log(
          `MCP to PIP: ${calculateDistance(
            keyPoints.indexMCP,
            keyPoints.indexPIP
          ).toFixed(1)}mm`
        );
        console.log(
          `PIP to Tip: ${calculateDistance(
            keyPoints.indexPIP,
            keyPoints.indexTip
          ).toFixed(1)}mm`
        );

        // Middle finger
        console.log("Middle Finger:");
        console.log(
          `MCP to Tip: ${calculateDistance(
            keyPoints.middleMCP,
            keyPoints.middleTip
          ).toFixed(1)}mm`
        );
        console.log(
          `MCP to PIP: ${calculateDistance(
            keyPoints.middleMCP,
            keyPoints.middlePIP
          ).toFixed(1)}mm`
        );
        console.log(
          `PIP to Tip: ${calculateDistance(
            keyPoints.middlePIP,
            keyPoints.middleTip
          ).toFixed(1)}mm`
        );

        // Ring finger
        console.log("Ring Finger:");
        console.log(
          `MCP to Tip: ${calculateDistance(
            keyPoints.ringMCP,
            keyPoints.ringTip
          ).toFixed(1)}mm`
        );
        console.log(
          `MCP to PIP: ${calculateDistance(
            keyPoints.ringMCP,
            keyPoints.ringPIP
          ).toFixed(1)}mm`
        );
        console.log(
          `PIP to Tip: ${calculateDistance(
            keyPoints.ringPIP,
            keyPoints.ringTip
          ).toFixed(1)}mm`
        );

        // Pinky
        console.log("Pinky:");
        console.log(
          `MCP to Tip: ${calculateDistance(
            keyPoints.pinkyMCP,
            keyPoints.pinkyTip
          ).toFixed(1)}mm`
        );
        console.log(
          `MCP to PIP: ${calculateDistance(
            keyPoints.pinkyMCP,
            keyPoints.pinkyPIP
          ).toFixed(1)}mm`
        );
        console.log(
          `PIP to Tip: ${calculateDistance(
            keyPoints.pinkyPIP,
            keyPoints.pinkyTip
          ).toFixed(1)}mm`
        );

        console.log("----------------");

        // Draw measurement lines
        const drawMeasurementLine = (
          point1: NormalizedLandmark,
          point2: NormalizedLandmark,
          color: string
        ) => {
          ctx.beginPath();
          ctx.moveTo(point1.x * img.width, point1.y * img.height);
          ctx.lineTo(point2.x * img.width, point2.y * img.height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        };

        // Draw finger measurements
        drawMeasurementLine(keyPoints.indexMCP, keyPoints.indexTip, "#FF0000");
        drawMeasurementLine(
          keyPoints.middleMCP,
          keyPoints.middleTip,
          "#00FF00"
        );
        drawMeasurementLine(keyPoints.ringMCP, keyPoints.ringTip, "#0000FF");
        drawMeasurementLine(keyPoints.pinkyMCP, keyPoints.pinkyTip, "#FF00FF");

        // Add measurement labels
        ctx.fillStyle = "#000000";
        ctx.font = "12px Arial";
        ctx.fillText(
          `${calculateDistance(keyPoints.ringMCP, keyPoints.ringTip).toFixed(
            1
          )}mm`,
          keyPoints.ringTip.x * img.width,
          keyPoints.ringTip.y * img.height - 10
        );
      } else {
        console.log("No hands detected in the image");
      }
    } catch (err) {
      console.error("Error processing image:", err);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Get actual video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        console.log("Video dimensions:", videoWidth, videoHeight);

        // Calculate the actual position of the guide rectangle in video coordinates
        const videoRect = video.getBoundingClientRect();
        const guideRect = {
          left: (90 / videoRect.width) * videoWidth,
          top: (30 / videoRect.height) * videoHeight,
          width: (pixelWidth / videoRect.width) * videoWidth,
          height: (pixelHeight / videoRect.height) * videoHeight,
        };

        console.log("Guide rectangle in video coordinates:", guideRect);

        // Set canvas size to match the guide rectangle size
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;

        // Draw only the portion of the video that's within the guide rectangle
        ctx.drawImage(
          video,
          guideRect.left,
          guideRect.top,
          guideRect.width,
          guideRect.height,
          0,
          0,
          pixelWidth,
          pixelHeight
        );

        // Draw calibration points
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        Object.values(CALIBRATION_POINTS).forEach((point) => {
          ctx.beginPath();
          ctx.arc(
            point.x * pixelWidth,
            point.y * pixelHeight,
            5,
            0,
            2 * Math.PI
          );
          ctx.stroke();
        });

        const dataUrl = canvas.toDataURL("image/png");
        setCapturedImage(dataUrl);

        // Process the captured image
        processImage(dataUrl);

        // Calculate and log the actual scale
        const scaleMMPerPx = realWidthMM / pixelWidth;
        console.log("Scale (mm/px):", scaleMMPerPx);
        console.log("Actual captured area dimensions (mm):", {
          width: pixelWidth * scaleMMPerPx,
          height: pixelHeight * scaleMMPerPx,
        });
      }
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

      {/* Marco guía con medidas reales - Vertical */}
      <div
        className="absolute border-4 border-dashed border-black rounded"
        style={{
          width: `${pixelWidth}px`,
          height: `${pixelHeight}px`,
          top: "30px",
          left: "90px",
        }}
      >
        {/* Guide text */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-sm text-black bg-white/50 px-2 rounded">
          Alinear la base de la mano con la línea inferior
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <button
        onClick={capture}
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg shadow-md"
      >
        Tomar foto
      </button>

      {capturedImage && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Foto tomada:</p>
          <div className="relative w-36 h-36 mx-auto">
            <Image
              src={capturedImage}
              alt="Captura"
              width={pixelWidth}
              height={pixelHeight}
              className="mt-2 rounded-lg w-full h-full object-contain"
            />
            <canvas
              ref={canvasRef}
              width={pixelWidth}
              height={pixelHeight}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
