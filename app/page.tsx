"use client";

import HandCaptureRect from "./components/handCapture";
// import HandLandmark from "./components/handLandmark";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Tayliq Size</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Descubre tu talla de anillo perfecta con nuestra tecnología de
            medición precisa. Solo necesitamos tu altura y una foto de tu mano.
          </p>
        </div>

        {/* Main Content */}

        <div className="flex flex-col items-center p-8 mb-8">
          <HandCaptureRect />
        </div>

        {/* Instructions Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Cómo Funciona
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">1</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Ingresa tu altura
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Proporciona tu altura en centímetros para una medición
                    precisa
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">2</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Coloca tu mano
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Asegúrate de que tu mano esté bien iluminada y visible
                    dentro del marco
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Toma la foto
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Presiona el botón para capturar la imagen de tu mano
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">4</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Obtén tu medida
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Recibe tu medida exacta y la confianza del cálculo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Consejos para una mejor medición
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-blue-600 mb-2">
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
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">
                  Asegúrate de tener buena iluminación para una medición precisa
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-blue-600 mb-2">
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
                      d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">
                  Mantén los dedos juntos y la mano relajada
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-blue-600 mb-2">
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">
                  Verifica que tu altura sea correcta para mayor precisión
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Para obtener ayuda o reportar problemas, contacta a soporte
          </p>
        </footer>
      </div>
    </main>
  );
}
