import { GoogleGenAI } from "@google/genai";

// Initialize the SDK with the API key from environment variables
// Note: In a real production app, you shouldn't expose this to the client,
// but for this hackathon/UNIPOD demo, it's fine.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const aiConfigured = Boolean(apiKey);

export async function generateDriverResponse(driverName: string, passengerMessage: string): Promise<string> {
  if (!ai) {
    return "Sorry, my AI brain (Gemini API Key) isn't connected right now!";
  }

  const prompt = `
    You are a ride-sharing driver in Kigali named ${driverName}. You are currently driving around looking for passengers.
    A passenger just messaged you in the app.
    
    Rules for your response:
    - Keep it short (1-2 sentences max, like a quick text message).
    - Be polite and professional.
    - If they ask for a ride, negotiate fare (in RWF) if they offer too low, or accept enthusiastically if it's fair.
    - If they just say hi, ask where they are heading.
    - Always stay in character as a real human driver in Rwanda (e.g., mention traffic, weather, or local landmarks casually if relevant).
    
    Passenger says: "${passengerMessage}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text || "I am on my way!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Having some network issues, but I'm nearby!";
  }
}
