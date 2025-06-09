// HandCaptureRect.tsx
"use client";
import { useRef, useState, useEffect } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import Link from "next/link";

export default function HandCaptureRect() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [ringWidth, setRingWidth] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [sizeGuidePreview, setSizeGuidePreview] = useState<string | null>(null);
  const [useDefaultGuide, setUseDefaultGuide] = useState(false);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(
    null
  );
  const streamRef = useRef<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showHeightInput, setShowHeightInput] = useState(true);
  const [calculationStep, setCalculationStep] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<{
    recommendedSize: string;
    explanation: string;
    additionalNotes?: string;
  } | null>(null);

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
    } catch (error) {
      console.error("Error initializing hand landmarker:", error);
    }
  };

  const getRingSizeRecommendation = async (fingerWidth: number) => {
    try {
      setCalculationStep(6);
      setStatusMessage("Obteniendo recomendación de talla...");

      let imageBase64 = "";

      if (useDefaultGuide) {
        // Fetch the default image and convert to base64
        const response = await fetch("/Tallas_Wonder.webp");
        const blob = await response.blob();
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/webp;base64,")
            resolve(base64String.split(",")[1]);
          };
          reader.readAsDataURL(blob);
        });
      } else if (sizeGuidePreview) {
        // Remove the data URL prefix from the preview
        imageBase64 = sizeGuidePreview.split(",")[1];
      }

      const response = await fetch("/api/ring-size", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fingerWidth,
          imageBase64,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al obtener la recomendación");
      }

      const data = await response.json();

      // Extract JSON from the response using regex
      const jsonMatch = data.recommendation.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Formato de respuesta inválido");
      }

      const parsedData = JSON.parse(jsonMatch[0]);

      setRecommendation({
        recommendedSize: parsedData.talla,
        explanation: `Probabilidad: ${parsedData.probabilidad}`,
      });

      setCalculationStep(7);
      setStatusMessage("¡Recomendación lista!");
    } catch (error) {
      console.error("Error getting ring size recommendation:", error);
      setStatusMessage(
        "Error al obtener la recomendación. Por favor, intenta de nuevo."
      );
    }
  };

  const processImage = async (
    imageUrl: string,
    handLandmarker: HandLandmarker,
    setRingWidth: (w: number) => void,
    setShowPopup: (b: boolean) => void,
    overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>
  ) => {
    try {
      setCalculationStep(1);
      setStatusMessage("Cargando imagen...");

      const img = document.createElement("img");
      img.src = imageUrl;
      img.width = CAPTURE_SIZE;
      img.height = CAPTURE_SIZE;
      await new Promise<void>((res) => (img.onload = () => res()));

      setCalculationStep(2);
      setStatusMessage("Detectando puntos de la mano...");

      const ctx = overlayCanvasRef.current?.getContext("2d");
      if (!ctx) {
        console.error("No canvas context available");
        return;
      }

      ctx.clearRect(0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
      ctx.drawImage(img, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

      setCalculationStep(3);
      setStatusMessage("Analizando puntos de referencia...");

      const results = handLandmarker.detect(img);

      if (!results.landmarks.length) {
        setStatusMessage("No se detectó la mano. Por favor, intenta de nuevo.");
        return;
      }

      setCalculationStep(4);
      setStatusMessage("Calculando medidas...");
      const landmarks = results.landmarks[0];

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

      setCalculationStep(5);
      setStatusMessage("Finalizando cálculos...");

      setRingWidth(Number((avgWidthMM / 10).toFixed(1)));
      await getRingSizeRecommendation(avgWidthMM / 10);
      setShowPopup(true);
    } catch (err) {
      console.error("Error in processImage:", err);
      setStatusMessage(
        "Error al procesar la imagen. Por favor, intenta de nuevo."
      );
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
        setRingWidth,
        setShowPopup,
        overlayCanvasRef
      );
    }

    setStatusMessage(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUseDefaultGuide(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSizeGuidePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUseDefaultGuide = () => {
    setUseDefaultGuide(true);
    setSizeGuidePreview("/Tallas_Wonder.webp");
  };

  return (
    <div className="relative w-full max-w-[480px] mx-auto">
      {showHeightInput ? (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Configuración Inicial
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Altura
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={userHeight || ""}
                    onChange={(e) => setUserHeight(Number(e.target.value))}
                    placeholder="Ingresa tu altura"
                    className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-gray-50 text-lg"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                  <span className="text-gray-600 font-medium">cm</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Necesitamos tu altura para calcular la medida exacta
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guía de tallas
                </label>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <button
                      onClick={handleUseDefaultGuide}
                      className={`w-full px-4 py-4 rounded-lg border transition-colors ${
                        useDefaultGuide
                          ? "bg-blue-50 border-blue-500 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      Usar guía predeterminada
                    </button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-2 bg-white text-sm text-gray-500">
                          o
                        </span>
                      </div>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                        className="w-full px-4 py-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Sube una imagen o PDF con la guía de tallas para referencia
                  </p>
                  {sizeGuidePreview && (
                    <div className="mt-4">
                      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={sizeGuidePreview}
                          alt="Vista previa de la guía de tallas"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={() => {
                            setUseDefaultGuide(false);
                            setSizeGuidePreview(null);
                          }}
                          className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-gray-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowHeightInput(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={
                  !userHeight || (!sizeGuidePreview && !useDefaultGuide)
                }
                className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200 disabled:bg-gray-400 font-medium text-lg"
              >
                Comenzar Medición
              </button>
              {(!userHeight || (!sizeGuidePreview && !useDefaultGuide)) && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  {!userHeight && !sizeGuidePreview && !useDefaultGuide
                    ? "Por favor, introduce tu altura y selecciona una guía de tallas"
                    : !userHeight
                    ? "Por favor, introduce tu altura"
                    : "Por favor, selecciona una guía de tallas"}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-[100dvh]">
          {statusMessage && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 bg-white rounded-full shadow-lg text-sm text-gray-800 font-medium">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        step <= calculationStep ? "bg-blue-500" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                {statusMessage}
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover scale-x-[-1]"
          />

          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div
              className="absolute border-4 border-white/90 rounded-lg shadow-lg"
              style={{
                width: `${CAPTURE_SIZE}px`,
                height: `${CAPTURE_SIZE}px`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white/80 text-sm font-medium">
                  Coloca tu mano dentro del marco
                </div>
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <button
            onClick={capture}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white text-black px-8 py-4 rounded-full shadow-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200 z-10 font-medium text-lg flex items-center gap-2"
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
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Tomar foto
          </button>
        </div>
      )}

      {capturedImage && !showHeightInput && (
        <div className="mt-8 text-center hidden">
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
          <div className="bg-white rounded-2xl p-8 shadow-xl w-full max-w-sm mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Medida del Anillo
            </h3>
            <div className="bg-blue-50 rounded-xl p-6 mb-6">
              {recommendation && (
                <>
                  <p className="text-5xl font-bold text-blue-600 text-center mb-2">
                    {recommendation.recommendedSize}
                  </p>
                  <p className="text-sm text-gray-600 text-center">
                    {recommendation.explanation}
                  </p>
                </>
              )}
            </div>
            <div className="space-y-3">
              <Link href="https://woonder.es/en/collections/anillos/products/anillo-sayu-magenta">
                <button className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors duration-200 font-medium text-lg">
                  Ver en Woonder
                </button>
              </Link>
              <button
                onClick={() => {
                  setShowPopup(false);
                  setShowHeightInput(true);
                  setRecommendation(null);
                }}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors duration-200 font-medium text-lg"
              >
                Nueva Medición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
