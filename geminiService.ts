
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiAnalysisResponse, UserProfile } from "./types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('VITE_GEMINI_API_KEY is not set. Please set it in your environment variables.');
}

const ai = new GoogleGenAI({ apiKey });

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
    // Build profile information string, only including fields that are provided
    const profileFields: string[] = [];
    
    if (profile.name) profileFields.push(`- Name: ${profile.name}`);
    if (profile.email) profileFields.push(`- Email: ${profile.email}`);
    if (profile.phone) profileFields.push(`- Phone: ${profile.phone}`);
    if (profile.portfolio) profileFields.push(`- Portfolio: ${profile.portfolio}`);
    if (profile.linkedin) profileFields.push(`- LinkedIn: ${profile.linkedin}`);
    if (profile.figma) profileFields.push(`- Figma: ${profile.figma}`);
    if (profile.resumeLink) profileFields.push(`- Resume: ${profile.resumeLink}`);
    if (profile.bio) profileFields.push(`- Bio: ${profile.bio}`);
    
    const profileInfo = profileFields.length > 0 
      ? profileFields.join('\n')
      : 'No profile information provided. Use placeholders like [Your Name], [Your Email], etc.';

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze this job description for entry-level suitability.
        
        PROFILE INFORMATION:
        ${profileInfo}

        GUIDELINES:
        - Only include profile fields that are provided above. Do NOT include fields that are not in the profile information.
        - If a profile field is missing, do not mention it in the email at all (not even as a placeholder).
        - The email should be polite, energetic, and professional.
        - Focus on "willingness to learn" and "entry-level passion".
        - Ensure the tone fits the role (e.g., designer vs developer).
        - Include contact information (email, phone, LinkedIn, Figma, Portfolio) only if they are provided in the profile.

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
