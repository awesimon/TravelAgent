import { GoogleGenAI, Content, Part } from "@google/genai";
import { Message, Coordinates, GroundingChunk, Place } from "../types";

// Initialize the client
// Using process.env.API_KEY as strictly required
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  userLocation?: Coordinates,
  onStreamUpdate?: (text: string) => void
): Promise<{ text: string; groundingChunks: GroundingChunk[]; places: Place[] }> => {
  try {
    // Convert app history to API content format
    const contents: Content[] = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }] as Part[],
    }));

    // Add the new user message
    contents.push({
      role: "user",
      parts: [{ text: newMessage }] as Part[],
    });

    const modelName = "gemini-2.5-flash"; // Required for Google Maps Grounding

    // Configure tool config with user location if available
    let toolConfig = undefined;
    if (userLocation) {
        toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng
                }
            }
        };
    }

    const result = await ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        tools: [{ googleMaps: {} }], // Enable Maps Grounding
        toolConfig: toolConfig,
        systemInstruction: `You are an elite AI Travel Architect. Your goal is to create comprehensive, executable travel plans and visualize them on a map.

        **CORE RESPONSIBILITIES:**
        1. **Deep Planning**: When a user asks for a plan (e.g., "3 days in Sanya"), do not just list names. Create a logical flow.
           - Select specific **Hotels** for the stay.
           - Select **Restaurants** for lunch/dinner.
           - Organize **Attractions** in a geographical sequence (avoid zigzagging).
           - If **Public Transport** is mentioned, identify key **Bus Stops** or **Train Stations** as part of the route.

        2. **JSON Extraction**: You must output a JSON array of specific locations.
        
        **JSON SCHEMA RULES:**
        Each object in the array must have:
        - \`name\`: Specific name (e.g., "Atlantis Sanya", "Yalong Bay Bus Station").
        - \`lat\`, \`lng\`: Coordinates.
        - \`description\`: Brief context (e.g., "Stop 1: Breakfast", "Take Bus 25 here").
        - \`day\`: The day number (1, 2, 3...). Use 0 for base location/hotel if it applies to all days.
        - \`order\`: The sequence number within that day (1, 2, 3, 4...).
        - \`type\`: One of ['attraction', 'hotel', 'food', 'transit', 'landmark'].

        **SCENARIO: PUBLIC TRANSPORT**
        If the user wants public transport, your JSON should look like a path:
        1. Hotel (Start)
        2. Bus Station A (Transit) -> Description: "Walk to station, take Bus 15"
        3. Attraction X (Attraction) -> Description: "Get off here"
        
        **Output Format:**
        Provide a friendly, formatted text response (Markdown) explaining the plan, followed strictly by the JSON block.

        \`\`\`json
        [
          { 
            "name": "Sunshine Hotel", 
            "lat": 18.2528, 
            "lng": 109.5119, 
            "description": "Your base for the trip.",
            "zoom": 15,
            "day": 1,
            "order": 1,
            "type": "hotel"
          },
          { 
            "name": "Bus Stop A", 
            "lat": 18.2550, 
            "lng": 109.5130, 
            "description": "Take Bus 25 towards Nanshan.",
            "zoom": 16,
            "day": 1,
            "order": 2,
            "type": "transit"
          }
        ]
        \`\`\`
        `
      },
    });

    let fullText = "";
    let groundingChunks: GroundingChunk[] = [];

    // Iterate result directly. The new SDK returns an iterable for generateContentStream.
    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        if (onStreamUpdate) {
            // Check if we have hit the start of the JSON block to hide it from the stream view
            // This prevents the user from seeing raw JSON construction
            const jsonStart = fullText.indexOf("```json");
            if (jsonStart !== -1) {
                onStreamUpdate(fullText.substring(0, jsonStart));
            } else {
                onStreamUpdate(fullText);
            }
        }
      }

      // Extract grounding chunks from the current chunk if available
      const candidate = chunk.candidates?.[0];
      if (candidate?.groundingMetadata?.groundingChunks) {
          groundingChunks = candidate.groundingMetadata.groundingChunks as unknown as GroundingChunk[];
      }
    }

    let text = fullText || "No response generated.";

    // Extract JSON places from the text
    let places: Place[] = [];
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    
    if (jsonMatch) {
      try {
        places = JSON.parse(jsonMatch[1]);
        // Remove the JSON block from the visible text to keep chat clean
        text = text.replace(jsonMatch[0], "").trim();
      } catch (e) {
        console.warn("Failed to parse places JSON from model response", e);
      }
    }

    return { text, groundingChunks, places };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};