"use client";

import HandCapture from "./components/handCapture";
// import HandLandmark from "./components/handLandmark";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Medición de Talla de Anillo
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Coloca tu mano dentro del marco y alinea la base con la línea
            inferior y tu dedo más alto con la línea superior. Mantén los dedos
            juntos para una medición precisa.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <HandCapture />
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Para obtener la mejor medición:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Asegúrate de tener buena iluminación</li>
            <li>Mantén la mano plana y los dedos juntos</li>
            <li>No muevas la mano durante la captura</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
