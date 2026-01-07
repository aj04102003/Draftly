/**
 * Local Job Analyzer - No API Required
 * Uses keyword matching and pattern recognition to identify entry-level jobs
 */

import { GeminiAnalysisResponse, UserProfile } from "../types";

// Keywords that indicate entry-level positions
const ENTRY_LEVEL_KEYWORDS = [
  "entry level",
  "entry-level",
  "junior",
  "jr",
  "fresher",
  "graduate",
  "recent graduate",
  "new grad",
  "associate",
  "trainee",
  "intern",
  "internship",
  "0-",
  "0-1 year",
  "0-2 year",
  "2+",
  "1+",
  "1-2 year",
  "no experience",
  "little experience",
  "beginner",
  "starting position",
  "career starter",
];

// Keywords that indicate senior/experienced positions (rejections)
const SENIOR_KEYWORDS = [
  "senior",
  "lead",
  "principal",
  "architect",
  "manager",
  "director",
  "head of",
  "chief",
  "expert",
  "specialist",
  "3+ year",
  "4+ year",
  "5+ year",
  "6+ year",
  "7+ year",
  "8+ year",
  "9+ year",
  "10+ year",
  "minimum 3 year",
  "minimum 4 year",
  "minimum 5 year",
  "at least 3 year",
  "at least 4 year",
  "at least 5 year",
];

// Experience requirement patterns
const EXPERIENCE_PATTERNS = [
  /at least\s+(\d+)\s+years?/gi,
];

/**
 * Analyze job description locally without API calls
 */
export function analyzeJobDescriptionLocal(
  description: string,
  profile: UserProfile
): GeminiAnalysisResponse {
  const lowerDesc = description.toLowerCase();

  // 1. Check for explicit entry-level keywords
  const hasEntryKeyword = ENTRY_LEVEL_KEYWORDS.some((keyword) =>
    lowerDesc.includes(keyword.toLowerCase())
  );

  // 2. Check for senior/experienced keywords
  const hasSeniorKeyword = SENIOR_KEYWORDS.some((keyword) =>
    lowerDesc.includes(keyword.toLowerCase())
  );

  // 3. Extract years of experience required
  let maxYearsRequired = 0;
  let minYearsRequired = 0;

  for (const pattern of EXPERIENCE_PATTERNS) {
    const matches = [...description.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        const years = parseInt(match[1]);
        maxYearsRequired = Math.max(maxYearsRequired, years);
        minYearsRequired = minYearsRequired === 0 ? years : Math.min(minYearsRequired, years);
      }
      if (match[2]) {
        const years = parseInt(match[2]);
        maxYearsRequired = Math.max(maxYearsRequired, years);
      }
    }
  }

  // 4. Decision logic
  let isEntryLevel = false;
  let reason = "";

  if (hasEntryKeyword && !hasSeniorKeyword) {
    isEntryLevel = true;
    reason = "Contains entry-level keywords and no senior requirements";
  } else if (hasSeniorKeyword) {
    isEntryLevel = false;
    reason = "Contains senior/experienced position keywords";
  } else if (maxYearsRequired > 2) {
    isEntryLevel = false;
    reason = `Requires ${maxYearsRequired}+ years of experience`;
  } else if (maxYearsRequired <= 2 && maxYearsRequired > 0) {
    isEntryLevel = true;
    reason = `Requires ${maxYearsRequired} years or less - entry-level acceptable`;
  } else {
    // No clear indicators, assume entry-level if no experience mentioned
    isEntryLevel = true;
    reason = "No specific experience requirements mentioned - likely entry-level";
  }

  // 5. Generate email if entry-level
  if (isEntryLevel) {
    const { emailSubject, emailBody } = generateEmail(description, profile);
    return {
      isEntryLevel: true,
      emailSubject,
      emailBody,
      reason,
    };
  }

  return {
    isEntryLevel: false,
    emailSubject: "",
    emailBody: "",
    reason,
  };
}

/**
 * Generate personalized email based on job description and profile
 */
function generateEmail(
  description: string,
  profile: UserProfile
): { emailSubject: string; emailBody: string } {
  // Extract job role if possible
  const roleMatch = description.match(
    /(?:position|role|job|opening)[\s:]+(.{10,50}?)(?:\.|,|at|in|\n)/i
  );
  const role = roleMatch ? roleMatch[1].trim() : "UI/UX Designer";

  // Detect industry/field
  let field = "your organization";
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes("software") || lowerDesc.includes("developer") || lowerDesc.includes("engineer")) {
    field = "software development";
  } else if (lowerDesc.includes("design") || lowerDesc.includes("ui") || lowerDesc.includes("ux")) {
    field = "design";
  } else if (lowerDesc.includes("marketing") || lowerDesc.includes("digital marketing")) {
    field = "marketing";
  } else if (lowerDesc.includes("data") || lowerDesc.includes("analyst")) {
    field = "data analytics";
  } else if (lowerDesc.includes("sales")) {
    field = "sales";
  }

  // Generate subject line
  const emailSubject = generateSubjectLine(role, profile);

  // Generate email body
  const emailBody = generateEmailBody(role, field, profile);

  return { emailSubject, emailBody };
}

/**
 * Generate catchy subject line
 */
function generateSubjectLine(role: string, profile: UserProfile): string {
  // Clean up role for subject line
  const cleanRole = role.replace(/position|role|job|opening/gi, "").trim();
  
  if (profile.name) {
    return `Application for ${cleanRole} Position - ${profile.name}`;
  }
  
  return `Application for ${cleanRole} Position`;
}

/**
 * Generate email body with profile information
 * Matches user's preferred format and style
 */
function generateEmailBody(
  role: string,
  field: string,
  profile: UserProfile
): string {
  const greeting = "Dear Hiring Team,";

  // Opening paragraph - enthusiastic and specific
  const opening = `I am writing to express my interest in the ${role} position. As a ${
    profile.bio || 
    `creative professional with a passion for building intuitive, user-friendly solutions`
  }, I am eager to contribute my skills to your team and grow within your fast-paced environment.`;

  // Skills/experience paragraph
  let skillsParagraph = "";
  if (field.includes("design") || field.includes("ui") || field.includes("ux")) {
    skillsParagraph = "I have a strong foundation in creating wireframes, prototypes, and mockups, and I am highly proficient in design tools like figma, framer, visily. I am particularly excited about bringing my experience and creativity to this role and the opportunity to iterate quickly while collaborating with your team to ship high-quality work. My focus is on continuous learning and applying a user-centered approach to every project I undertake.";
  } else if (field.includes("software") || field.includes("developer") || field.includes("engineer")) {
    skillsParagraph = "I have a strong foundation in software development and problem-solving, and I am proficient in modern development tools and frameworks. I am particularly excited about bringing my technical skills and creativity to this role and the opportunity to collaborate with your team to build high-quality products. My focus is on continuous learning and writing clean, maintainable code.";
  } else if (field.includes("data") || field.includes("analyst")) {
    skillsParagraph = "I have a strong foundation in data analysis, visualization, and deriving actionable insights. I am proficient in analytical tools and methodologies. I am particularly excited about bringing my analytical mindset to this role and the opportunity to work with your team on data-driven decision making. My focus is on continuous learning and applying best practices in data analysis.";
  } else {
    skillsParagraph = "I have a strong foundation in my field and am eager to apply my skills and knowledge to real-world challenges. I am particularly excited about bringing my dedication and fresh perspective to this role and the opportunity to collaborate with your team. My focus is on continuous learning and delivering high-quality results.";
  }

  // Portfolio and resume links
  const links: string[] = [];
  
  if (profile.portfolio) {
    links.push(`You can explore my work through my portfolio here: ${profile.portfolio}.`);
  }
  
  if (profile.figma) {
    links.push(`View my Figma designs: ${profile.figma}.`);
  }
  
  if (profile.resumeLink) {
    links.push(`I have also attached my resume for your review: ${profile.resumeLink}.`);
  }

  const linksSection = links.length > 0 ? links.join("\n\n") : "";

  // Closing paragraph
  const closing = `Thank you for your time and consideration. I look forward to the possibility of discussing how my passion and skills can benefit your team.`;

  // Sign-off with contact info
  let signoff = "Best regards,";
  if (profile.name) {
    signoff += `\n${profile.name.toUpperCase()}`;
  }
  if (profile.phone) {
    signoff += `\n${profile.phone}`;
  }
  if (profile.email) {
    signoff += `\n${profile.email}`;
  }
  if (profile.linkedin) {
    signoff += ` | LinkedIn`;
  }

  // Combine all parts with proper spacing
  const parts = [greeting, opening, skillsParagraph];
  
  if (linksSection) {
    parts.push(linksSection);
  }
  
  parts.push(closing, signoff);

  return parts.join("\n\n");
}

/**
 * Batch analyze multiple jobs (instant, no rate limiting needed)
 */
export function batchAnalyzeLocal(
  jobs: Array<{ description: string }>,
  profile: UserProfile
): GeminiAnalysisResponse[] {
  return jobs.map((job) => analyzeJobDescriptionLocal(job.description, profile));
}

/**
 * Get statistics about the analysis
 */
export function getAnalysisStats(results: GeminiAnalysisResponse[]) {
  const entryLevel = results.filter((r) => r.isEntryLevel).length;
  const skipped = results.length - entryLevel;

  return {
    total: results.length,
    entryLevel,
    skipped,
    percentage: ((entryLevel / results.length) * 100).toFixed(1),
  };
}
