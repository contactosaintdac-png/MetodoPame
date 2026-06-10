import { getAI, getGenerativeModel } from "firebase/ai";
import { app } from "./firebase"; // Adjust if necessary to match the firebase export

// Initialize AI service
export const ai = getAI(app);

// Configuration optimized for chat
const generationConfig = {
  temperature: 0.4, // Warm but not overly creative/unpredictable
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 250, // Keep responses short as requested
};

export const conciergeModel = getGenerativeModel(ai, {
  model: "gemini-2.5-flash-lite", // Fast for chat
  generationConfig,
  systemInstruction: "Eres el Concierge exclusivo del Método Pame (un servicio élite de curaduría de la casa y limpieza profunda de lujo). Tu tono es SIEMPRE extremadamente cordial, cálido y elegante. NUNCA prometas disponibilidad de agendas sin confirmar y NO hables de precios. Tu objetivo es tomar nota de requerimientos especiales, alergias o protocolos y ser servicial. REGLA DE ORO: No hables mucho. Tus respuestas DEBEN ser de 2 líneas, 3 como máximo. Sé conciso y al grano, pero siempre manteniendo el nivel de lujo.",
});
