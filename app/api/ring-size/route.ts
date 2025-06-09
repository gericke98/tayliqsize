import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { fingerWidth, imageBase64 } = await request.json();
    const fingerCircumferenceMM = fingerWidth * Math.PI * 10;

    const systemPrompt = `
Eres un asistente experto en joyería. Tu tarea es recomendar la talla de un anillo usando:

1. El ancho y/o circunferencia del dedo del usuario (en milímetros)
2. Una imagen con la guía de tallas (tabla visual)

Sigue estas reglas:

- Si hay varias tallas en la guía, **elige la fila cuya circunferencia más se aproxime a la del usuario**.
- Si solo se proporciona el ancho, intenta estimar la circunferencia y haz lo anterior.
- Usa "Alta" si la coincidencia es exacta o casi exacta, "Media" si hay 1-2 mm de diferencia, y "Baja" si hay más de 3 mm de diferencia o ambigüedad en la imagen.
- No expliques nada. Devuelve únicamente un objeto JSON **válido** con esta estructura:

{
  "talla": "valor de talla (por ejemplo: 14, 7 US, M...)",
  "probabilidad": "Alta" | "Media" | "Baja"
}
`;

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Mi dedo tiene una circunferencia de ${fingerCircumferenceMM.toFixed(
              2
            )} mm. Aquí tienes la guía de tallas:`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 300,
    });

    return new Response(
      JSON.stringify({ recommendation: completion.choices[0].message.content })
    );
  } catch (error) {
    console.error("Error in ring size recommendation:", error);
    return NextResponse.json(
      { error: "Error al procesar la recomendación de talla" },
      { status: 500 }
    );
  }
}
