"use client";

import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

import { useEffect, useRef } from "react";

export default function HandLandmark() {
  let handLandmarker: HandLandmarker | null = null;
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const initializeHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
        );
        console.log("vision", vision);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/hand_landmarker.task",
            delegate: "GPU",
          },
          numHands: 1,
          runningMode: "IMAGE",
        });
        console.log("handLandmarker", handLandmarker);
      } catch (error) {
        console.error("Error initializing hand landmarker:", error);
      }
    };

    initializeHandLandmarker();
  }, []);

  const handleImageLoad = () => {
    console.log("Image loaded successfully");
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="relative w-[800] h-[600]">
          <img
            title="Hand"
            ref={imageRef}
            src="/mano-1.jpeg"
            alt="hand"
            width={800}
            height={600}
            onLoad={handleImageLoad}
          />
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>
        <button
          className="bg-blue-500 text-white p-2 rounded-md cursor-pointer"
          onClick={async () => {
            if (!imageRef.current || !handLandmarker) {
              console.error("Image or handLandmarker not initialized");
              return;
            }

            try {
              console.log("Starting detection...");
              console.log(
                "Image dimensions:",
                imageRef.current.width,
                imageRef.current.height
              );

              const results = handLandmarker.detect(imageRef.current);
              console.log("Detection results:", results);

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
                for (const landmark of results.landmarks) {
                  drawingUtils.drawConnectors(
                    landmark,
                    GestureRecognizer.HAND_CONNECTIONS,
                    {
                      color: "#00FF00",
                      lineWidth: 5,
                    }
                  );
                  drawingUtils.drawLandmarks(landmark, {
                    color: "#FF0000",
                    lineWidth: 2,
                  });
                }
              } else {
                console.log("No hands detected in the image");
              }
            } catch (error) {
              console.error("Error during detection:", error);
            }
          }}
        >
          Detect
        </button>
      </div>
    </>
  );
}
