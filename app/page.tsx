"use client";

import HandCaptureRect from "./components/handCapture";
// import HandLandmark from "./components/handLandmark";

export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Medidor de Tallas de Anillos
          </h1>
          <p className="text-gray-600 text-lg">
            Mide tu talla de anillo de forma precisa usando tu cámara
          </p>
        </div>
        <HandCaptureRect />
        <div className="max-w-2xl mx-auto mt-8 text-center text-sm text-gray-500">
          <p>
            Coloca tu mano dentro del marco y toma una foto para obtener tu
            talla exacta
          </p>
        </div>
      </div>
    </main>
  );
}
