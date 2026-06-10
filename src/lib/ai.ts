/**
 * Custom Gemini API client using standard fetch and Server-Sent Events (SSE).
 * Bypasses the Firebase SDK multiple-credentials issue by calling the Gemini Developer API directly.
 */

export async function* streamGemini(contents: { role: 'user' | 'model'; parts: { text: string }[] }[]) {
  // Use the API key from environment variables (client-safe)
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_FIREBASE_API_KEY is not defined in the environment");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: "Eres el Concierge exclusivo del Método Pame (un servicio élite de curaduría de la casa y limpieza profunda de lujo). Tu tono es SIEMPRE extremadamente cordial, cálido y elegante. NUNCA prometas disponibilidad de agendas sin confirmar y NO hables de precios. Tu objetivo es tomar nota de requerimientos especiales, alergias o protocolos y ser servicial. REGLA DE ORO: No hables mucho. Tus respuestas DEBEN ser de 2 líneas, 3 como máximo. Sé conciso y al grano, pero siempre manteniendo el nivel de lujo." }]
      },
      generationConfig: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 250
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No reader available on response body");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield text;
          }
        } catch (e) {
          // Skip lines that aren't valid JSON
        }
      }
    }
  }

  // Handle remaining text in buffer if any
  if (buffer.trim().startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.trim().slice(6));
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        yield text;
      }
    } catch (e) {}
  }
}
