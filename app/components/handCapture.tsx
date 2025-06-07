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
        if (!ctx) {
          console.error("Could not get canvas context");
          return;
        }

        // Clear previous drawings
        if (canvasRef.current) {
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }

        const drawingUtils = new DrawingUtils(ctx);

        // Calculate scale factors (mm per pixel)
        const mmPerPixelX = realWidthMM / pixelWidth;
        const mmPerPixelY = mmPerPixelX; // Use same scale for both axes to maintain proportions

        for (const landmark of results.landmarks) {
          // Draw the landmarks
          drawingUtils.drawConnectors(
            landmark,
            GestureRecognizer.HAND_CONNECTIONS,
            {
              color: "#00FF00",
              lineWidth: 2,
            }
          );
          drawingUtils.drawLandmarks(landmark, {
            color: "#FF0000",
            lineWidth: 1,
          });

          // Calculate and log real distances for key points
          const keyPoints = {
            // Finger tips
            indexFingerTip: landmark[8],
            middleFingerTip: landmark[12],
            ringFingerTip: landmark[16],
            pinkyTip: landmark[20],
            // Knuckles (MCP - Metacarpophalangeal joints)
            indexFingerMCP: landmark[5],
            middleFingerMCP: landmark[9],
            ringFingerMCP: landmark[13],
            pinkyMCP: landmark[17],
            // PIP joints (Proximal Interphalangeal)
            indexFingerPIP: landmark[6],
            middleFingerPIP: landmark[10],
            ringFingerPIP: landmark[14],
            pinkyPIP: landmark[18],
          };

          // Calculate distances in mm
          const distances = {
            // Finger lengths from MCP to tip
            indexFingerLength: calculateDistance(
              keyPoints.indexFingerMCP,
              keyPoints.indexFingerTip,
              mmPerPixelX,
              mmPerPixelY
            ),
            middleFingerLength: calculateDistance(
              keyPoints.middleFingerMCP,
              keyPoints.middleFingerTip,
              mmPerPixelX,
              mmPerPixelY
            ),
            ringFingerLength: calculateDistance(
              keyPoints.ringFingerMCP,
              keyPoints.ringFingerTip,
              mmPerPixelX,
              mmPerPixelY
            ),
            pinkyLength: calculateDistance(
              keyPoints.pinkyMCP,
              keyPoints.pinkyTip,
              mmPerPixelX,
              mmPerPixelY
            ),

            // Ring finger measurements using MediaPipe landmarks
            ringFinger: {
              // Measure at the PIP joint (middle knuckle) where rings are typically worn
              width: calculateFingerWidth(
                landmark,
                13,
                14,
                mmPerPixelX,
                mmPerPixelY
              ),
              // Measure at the MCP joint (base knuckle)
              baseWidth: calculateFingerWidth(
                landmark,
                5,
                6,
                mmPerPixelX,
                mmPerPixelY
              ),
            },
          };

          // Log only the final measurements
          console.log("Measurements (all in millimeters):", {
            fingers: {
              index: `${distances.indexFingerLength.toFixed(1)}mm`,
              middle: `${distances.middleFingerLength.toFixed(1)}mm`,
              ring: `${distances.ringFingerLength.toFixed(1)}mm`,
              pinky: `${distances.pinkyLength.toFixed(1)}mm`,
            },
            ringFinger: {
              width: `${distances.ringFinger.width.toFixed(
                1
              )}mm (at middle knuckle)`,
              baseWidth: `${distances.ringFinger.baseWidth.toFixed(
                1
              )}mm (at base knuckle)`,
              // Calculate ring size (US standard)
              ringSize: (
                (distances.ringFinger.width * Math.PI) /
                3.14159
              ).toFixed(1),
            },
          });
        }
      } else {
        console.log("No hands detected in the image");
      }
    } catch (error) {
      console.error("Error processing image:", error);
    }
  };

  // Helper function to calculate finger width using MediaPipe landmarks
  const calculateFingerWidth = (
    landmark: { x: number; y: number }[],
    startIndex: number,
    endIndex: number,
    mmPerPixelX: number,
    mmPerPixelY: number
  ) => {
    // Get all points between the start and end indices
    const points = landmark.slice(startIndex, endIndex + 1);

    // Find the leftmost and rightmost points
    let leftmost = points[0];
    let rightmost = points[0];

    for (const point of points) {
      if (point.x < leftmost.x) leftmost = point;
      if (point.x > rightmost.x) rightmost = point;
    }

    // Calculate the width using these points
    return calculateDistance(leftmost, rightmost, mmPerPixelX, mmPerPixelY);
  };

  // Helper function to calculate real distance between two points
  const calculateDistance = (
    point1: { x: number; y: number },
    point2: { x: number; y: number },
    mmPerPixelX: number,
    mmPerPixelY: number
  ) => {
    const dx = (point2.x - point1.x) * pixelWidth;
    const dy = (point2.y - point1.y) * pixelHeight;

    const dxMM = dx * mmPerPixelX;
    const dyMM = dy * mmPerPixelY;

    return Math.sqrt(dxMM * dxMM + dyMM * dyMM);
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
