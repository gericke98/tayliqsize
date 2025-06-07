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
  const [showPopup, setShowPopup] = useState(false);
  const [ringWidth, setRingWidth] = useState<number | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );
  const streamRef = useRef<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent =
        navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      setIsMobile(mobileRegex.test(userAgent.toLowerCase()));
    };
    checkMobile();

    // Initialize camera with back camera preference for mobile
    const initializeCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );

        // Find back camera on mobile devices
        const backCamera = isMobile
          ? videoDevices.find((device) =>
              device.label.toLowerCase().includes("back")
            ) || videoDevices[videoDevices.length - 1]
          : videoDevices[0];

        const constraints = {
          video: {
            deviceId: backCamera ? { exact: backCamera.deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: isMobile ? "environment" : "user",
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        // Fallback to any available camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      }
    };

    initializeCamera();

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
  }, [isMobile]);

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

      // Create a temporary canvas to flip the image for MediaPipe
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = pixelWidth;
      tempCanvas.height = pixelHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      // Flip the image horizontally for MediaPipe
      tempCtx.translate(pixelWidth, 0);
      tempCtx.scale(-1, 1);
      tempCtx.drawImage(img, 0, 0, pixelWidth, pixelHeight);

      // Get the flipped image data
      const flippedImageData = tempCanvas.toDataURL("image/png");

      // Create a new image from the flipped data
      const flippedImg = document.createElement("img");
      flippedImg.src = flippedImageData;
      flippedImg.width = pixelWidth;
      flippedImg.height = pixelHeight;
      await new Promise<void>((resolve) => {
        flippedImg.onload = () => resolve();
      });

      const results = handLandmarker.detect(flippedImg);

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

        // Calculate ring width as average of PIP joint distances
        const ringWidthMM =
          (measurements.ringToMiddlePIP + measurements.middleToIndexPIP) / 2;
        const ringWidthCM = ringWidthMM / 10; // Convert to centimeters
        setRingWidth(Number(ringWidthCM.toFixed(1)));
        setShowPopup(true);
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

        // Stop the camera stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

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
    <div className="relative w-full max-w-[480px] h-[360px] mx-auto">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover rounded-2xl shadow-lg scale-x-[-1]"
      />

      {/* Blur overlay for outside area */}
      <div className="absolute top-0 left-0 w-full h-full">
        {/* Top blur */}
        <div className="absolute top-0 left-0 w-full h-[30px] backdrop-blur-md"></div>
        {/* Bottom blur */}
        <div className="absolute bottom-0 left-0 w-full h-[30px] backdrop-blur-md"></div>
        {/* Left blur */}
        <div className="absolute top-0 left-0 w-[90px] h-full backdrop-blur-md"></div>
        {/* Right blur */}
        <div className="absolute top-0 right-0 w-[90px] h-full backdrop-blur-md"></div>
      </div>

      {/* Clear capture area */}
      <div
        className="absolute border-4 border-white/80 rounded-lg"
        style={{
          width: `${pixelWidth}px`,
          height: `${pixelHeight}px`,
          top: "30px",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {/* Corner markers */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Improved capture button */}
      <button
        onClick={capture}
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-200 flex items-center gap-2 z-10"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
        Tomar foto
      </button>

      {capturedImage && (
        <div className="mt-8 text-center">
          <div className="relative w-48 h-48 mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
            <Image
              src={capturedImage}
              alt="Captura"
              width={pixelWidth}
              height={pixelHeight}
              className="w-full h-full object-contain scale-x-[-1]"
            />
            <canvas
              ref={canvasRef}
              width={pixelWidth}
              height={pixelHeight}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Las medidas se mostrarán en la consola
          </p>
        </div>
      )}

      {showPopup && ringWidth !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Medida del Anillo
            </h3>
            <p className="text-4xl font-bold text-blue-600 text-center mb-6">
              {ringWidth} cm
            </p>
            <button
              onClick={() => setShowPopup(false)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
