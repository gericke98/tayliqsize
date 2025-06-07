"use client";

import HandCaptureRect from "./components/handCapture";
// import HandLandmark from "./components/handLandmark";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Medición de Dedos
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Coloca tu mano dentro del marco y asegúrate de que los dedos estén
            juntos. Las medidas se mostrarán en la consola del navegador.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
          <div className="flex flex-col items-center">
            <HandCaptureRect />
          </div>
        </div>

        {/* Instructions Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Instrucciones
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">1</span>
                </div>
                <p className="text-gray-600">
                  Coloca tu mano dentro del marco blanco con los dedos juntos
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">2</span>
                </div>
                <p className="text-gray-600">
                  Asegúrate de que la mano esté bien iluminada y visible
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">3</span>
                </div>
                <p className="text-gray-600">
                  Presiona el botón Tomar foto para capturar la imagen
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">4</span>
                </div>
                <p className="text-gray-600">
                  Revisa la consola del navegador para ver las medidas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Para ver las medidas, abre la consola del navegador (F12)</p>
        </footer>
      </div>
    </main>
  );
}
