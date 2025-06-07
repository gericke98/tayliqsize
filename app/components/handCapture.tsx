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

// Add Popup component with improved styling and close button
const Popup = ({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md mx-4 border border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <p className="text-lg text-center text-gray-800 pr-6">{message}</p>
      </div>
    </div>
  );
};

export default function HandCaptureRect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );
  const [showInstructions, setShowInstructions] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [ringWidth, setRingWidth] = useState<number | null>(null);

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
        // Use same scale for both axes to maintain proportions

        // Calculate the line equation (ax + by + c = 0) for a finger
        const calculateFingerLine = (
          mcp: NormalizedLandmark,
          pip: NormalizedLandmark
        ) => {
          // Convert to pixel coordinates
          const x1 = mcp.x * img.width;
          const y1 = mcp.y * img.height;
          const x2 = pip.x * img.width;
          const y2 = pip.y * img.height;

          // Calculate line equation coefficients
          const a = y2 - y1;
          const b = x1 - x2;
          const c = x2 * y1 - x1 * y2;

          return { a, b, c };
        };

        // Calculate perpendicular distance from a point to a line
        const calculatePerpendicularDistance = (
          point: NormalizedLandmark,
          line: { a: number; b: number; c: number }
        ) => {
          const x = point.x * img.width;
          const y = point.y * img.height;

          // Distance formula: |ax + by + c| / sqrt(a² + b²)
          const distance =
            Math.abs(line.a * x + line.b * y + line.c) /
            Math.sqrt(line.a * line.a + line.b * line.b);

          return distance * mmPerPixelX;
        };

        // Log distances
        console.log("📏 Perpendicular Finger Spacing Measurements:");
        console.log("----------------");

        // Calculate finger lines
        const fingerLines = {
          pinky: calculateFingerLine(landmarks[17], landmarks[18]), // Pinky MCP to PIP
          ring: calculateFingerLine(landmarks[13], landmarks[14]), // Ring MCP to PIP
          middle: calculateFingerLine(landmarks[9], landmarks[10]), // Middle MCP to PIP
          index: calculateFingerLine(landmarks[5], landmarks[6]), // Index MCP to PIP
        };

        // Measure perpendicular distances between fingers
        const measurements = {
          // Pinky to Ring measurements
          pinkyToRingPIP: calculatePerpendicularDistance(
            landmarks[14],
            fingerLines.pinky
          ),
          pinkyToRingMCP: calculatePerpendicularDistance(
            landmarks[13],
            fingerLines.pinky
          ),
          pinkyToRingDIP: calculatePerpendicularDistance(
            landmarks[15],
            fingerLines.pinky
          ),

          // Ring to Middle measurements
          ringToMiddlePIP: calculatePerpendicularDistance(
            landmarks[10],
            fingerLines.ring
          ),
          ringToMiddleMCP: calculatePerpendicularDistance(
            landmarks[9],
            fingerLines.ring
          ),
          ringToMiddleDIP: calculatePerpendicularDistance(
            landmarks[11],
            fingerLines.ring
          ),

          // Middle to Index measurements
          middleToIndexPIP: calculatePerpendicularDistance(
            landmarks[6],
            fingerLines.middle
          ),
          middleToIndexMCP: calculatePerpendicularDistance(
            landmarks[5],
            fingerLines.middle
          ),
          middleToIndexDIP: calculatePerpendicularDistance(
            landmarks[7],
            fingerLines.middle
          ),
        };

        // Log all measurements
        console.log("PIP Joint Spacing (middle knuckles):");
        console.log(
          `Pinky to Ring: ${measurements.pinkyToRingPIP.toFixed(1)}mm`
        );
        console.log(
          `Ring to Middle: ${measurements.ringToMiddlePIP.toFixed(1)}mm`
        );
        console.log(
          `Middle to Index: ${measurements.middleToIndexPIP.toFixed(1)}mm`
        );
        console.log("----------------");

        console.log("MCP Joint Spacing (base knuckles):");
        console.log(
          `Pinky to Ring: ${measurements.pinkyToRingMCP.toFixed(1)}mm`
        );
        console.log(
          `Ring to Middle: ${measurements.ringToMiddleMCP.toFixed(1)}mm`
        );
        console.log(
          `Middle to Index: ${measurements.middleToIndexMCP.toFixed(1)}mm`
        );
        console.log("----------------");

        console.log("DIP Joint Spacing (near tips):");
        console.log(
          `Pinky to Ring: ${measurements.pinkyToRingDIP.toFixed(1)}mm`
        );
        console.log(
          `Ring to Middle: ${measurements.ringToMiddleDIP.toFixed(1)}mm`
        );
        console.log(
          `Middle to Index: ${measurements.middleToIndexDIP.toFixed(1)}mm`
        );
        console.log("----------------");

        // Calculate ring width (average of PIP distances)
        const ringWidthMM =
          (measurements.ringToMiddlePIP + measurements.middleToIndexPIP) / 2;
        setRingWidth(ringWidthMM);
        setShowResults(true);

        // Draw measurement lines and perpendiculars
        const drawPerpendicularLine = (
          point: NormalizedLandmark,
          line: { a: number; b: number; c: number },
          color: string
        ) => {
          const x = point.x * img.width;
          const y = point.y * img.height;

          // Calculate the foot of the perpendicular
          const denominator = line.a * line.a + line.b * line.b;
          const footX =
            (line.b * (line.b * x - line.a * y) - line.a * line.c) /
            denominator;
          const footY =
            (line.a * (-line.b * x + line.a * y) - line.b * line.c) /
            denominator;

          // Draw the perpendicular line
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(footX, footY);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw points
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(footX, footY, 3, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        };

        // Draw finger lines
        const drawFingerLine = (
          mcp: NormalizedLandmark,
          pip: NormalizedLandmark,
          color: string
        ) => {
          ctx.beginPath();
          ctx.moveTo(mcp.x * img.width, mcp.y * img.height);
          ctx.lineTo(pip.x * img.width, pip.y * img.height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
        };

        // Draw finger lines
        drawFingerLine(landmarks[17], landmarks[18], "#FF0000"); // Pinky
        drawFingerLine(landmarks[13], landmarks[14], "#00FF00"); // Ring
        drawFingerLine(landmarks[9], landmarks[10], "#0000FF"); // Middle
        drawFingerLine(landmarks[5], landmarks[6], "#FF00FF"); // Index

        // Draw perpendicular measurements
        // Pinky to Ring
        drawPerpendicularLine(landmarks[14], fingerLines.pinky, "#FF0000"); // PIP
        drawPerpendicularLine(landmarks[13], fingerLines.pinky, "#FF0000"); // MCP
        drawPerpendicularLine(landmarks[15], fingerLines.pinky, "#FF0000"); // DIP

        // Ring to Middle
        drawPerpendicularLine(landmarks[10], fingerLines.ring, "#00FF00"); // PIP
        drawPerpendicularLine(landmarks[9], fingerLines.ring, "#00FF00"); // MCP
        drawPerpendicularLine(landmarks[11], fingerLines.ring, "#00FF00"); // DIP

        // Middle to Index
        drawPerpendicularLine(landmarks[6], fingerLines.middle, "#0000FF"); // PIP
        drawPerpendicularLine(landmarks[5], fingerLines.middle, "#0000FF"); // MCP
        drawPerpendicularLine(landmarks[7], fingerLines.middle, "#0000FF"); // DIP

        // Draw the hand landmarks
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
      {showInstructions && (
        <Popup
          message="Alinea la base de la mano con la línea inferior y el dedo más alto con la línea superior. Haz la foto con los dedos juntos."
          onClose={() => setShowInstructions(false)}
        />
      )}

      {showResults && ringWidth !== null && (
        <Popup
          message={`Ancho del dedo anular: ${ringWidth.toFixed(1)}mm`}
          onClose={() => setShowResults(false)}
        />
      )}

      {!capturedImage ? (
        <div className="relative w-full h-full rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover"
          />

          <div
            className="absolute border-4 border-dashed border-white rounded-lg shadow-lg"
            style={{
              width: `${pixelWidth}px`,
              height: `${pixelHeight}px`,
              top: "30px",
              left: "90px",
            }}
          ></div>

          <button
            onClick={capture}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-colors duration-200"
          >
            Tomar foto
          </button>
        </div>
      ) : (
        <div className="w-full h-full">
          <div className="relative w-full h-full rounded-2xl overflow-hidden">
            <Image
              src={capturedImage}
              alt="Captura"
              width={pixelWidth}
              height={pixelHeight}
              className="w-full h-full object-contain"
            />
            <canvas
              ref={canvasRef}
              width={pixelWidth}
              height={pixelHeight}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>
          <button
            onClick={() => {
              setCapturedImage(null);
              setShowResults(false);
              setRingWidth(null);
            }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white px-6 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-colors duration-200"
          >
            Volver a tomar foto
          </button>
        </div>
      )}
    </div>
  );
}
