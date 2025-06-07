"use client";
import { useEffect, useRef, useState } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

export default function Home() {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImgUrl(url);
    }
  };

  useEffect(() => {
    if (!imgUrl) return;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      selfieMode: false,
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !img) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, img.width, img.height);
      if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 2,
        });
        drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1 });
        const pip = landmarks[14];
        const dip = landmarks[15];
        const dx = (dip.x - pip.x) * img.width;
        const dy = (dip.y - pip.y) * img.height;
        const length = Math.sqrt(dx * dx + dy * dy);
        setWidth(length);
      }
    });

    img.onload = () => {
      hands.send({ image: img });
    };
  }, [imgUrl]);

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Detector de ancho de dedo</h1>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {imgUrl && (
        <div className="space-y-2">
          <img ref={imageRef} src={imgUrl} alt="mano" className="hidden" />
          <canvas ref={canvasRef} />
          {width && (
            <p>Ancho aproximado de la falange: {width.toFixed(2)} px</p>
          )}
        </div>
      )}
    </div>
  );
}
