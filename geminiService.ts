
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiAnalysisResponse, UserProfile } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isEntryLevel: {
      type: Type.BOOLEAN,
      description: "True if the job description is for an entry-level, fresher, or junior role (0-2 years exp), or if no experience is mentioned.",
    },
    emailSubject: {
      type: Type.STRING,
      description: "A professional, catchy email subject line for the job application.",
    },
    emailBody: {
      type: Type.STRING,
      description: "A personalized, concise, and enthusiastic job application email body.",
    },
    reason: {
      type: Type.STRING,
      description: "A short reason for the classification.",
    }
  },
  required: ["isEntryLevel", "emailSubject", "emailBody", "reason"],
};

export async function analyzeJobDescription(description: string, profile: UserProfile): Promise<GeminiAnalysisResponse> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze this job description for entry-level suitability.
        
        PROFILE INFORMATION:
        - Name: ${profile.name || '[Your Name]'}
        - Email: ${profile.email || '[Your Email]'}
        - Phone: ${profile.phone || '[Your Phone]'}
        - Portfolio: ${profile.portfolio || '[Your Portfolio]'}
        - Resume: ${profile.resumeLink || '[Resume Link]'}
        - Bio: ${profile.bio || 'Aspiring professional.'}

        GUIDELINES:
        - If a profile field is shown as "[Placeholder]", use that exact placeholder in the email body so the user can fill it later.
        - The email should be polite, energetic, and professional.
        - Focus on "willingness to learn" and "entry-level passion".
        - Ensure the tone fits the role (e.g., designer vs developer).

        REJECTION:
        - reject if >2 years exp is hard-required.

        JOB:
        ${description}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    return JSON.parse(response.text || "{}") as GeminiAnalysisResponse;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw error;
  }
}
