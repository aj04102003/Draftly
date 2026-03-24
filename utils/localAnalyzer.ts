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
  /minimum\s+(\d+)\s+years?/gi,
  /(\d+)\+\s*years?\s+(?:of\s+)?experience/gi,
  /(\d+)\s*-\s*(\d+)\s*years?\s+(?:of\s+)?experience/gi,
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

  for (const pattern of EXPERIENCE_PATTERNS) {
    const matches = [...description.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        const years = parseInt(match[1]);
        maxYearsRequired = Math.max(maxYearsRequired, years);
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
    // No clear indicators — assume entry-level if no experience mentioned
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
 * Extract job role from description
 */
function extractRole(description: string): string {
  // Try to grab the role from common patterns
  const patterns = [
    /(?:looking for|hiring|seeking|need(?:ing)?|want(?:ing)?)\s+(?:a\s+|an\s+)?([A-Z][a-zA-Z\/\s\-]{3,50}?)(?:\s+who|\s+with|\s+to\s|\.|,|\n)/i,
    /(?:position|role|opening|vacancy)\s+(?:for\s+)?(?:a\s+|an\s+)?([A-Z][a-zA-Z\/\s\-]{3,50}?)(?:\s+who|\s+with|\.|,|\n)/i,
    /^(?:we(?:'re| are) (?:looking for|hiring))\s+(?:a\s+|an\s+)?([A-Z][a-zA-Z\/\s\-]{3,50}?)(?:\s|\.|\n)/im,
  ];

  for (const p of patterns) {
    const m = description.match(p);
    if (m && m[1]) {
      return m[1].trim().replace(/\s+/g, " ");
    }
  }

  // Fallback: check for common design/dev role keywords
  const lower = description.toLowerCase();
  if (lower.includes("ui/ux") || lower.includes("ui ux") || lower.includes("product designer")) return "UI/UX Designer";
  if (lower.includes("graphic design")) return "Graphic Designer";
  if (lower.includes("frontend") || lower.includes("front-end")) return "Frontend Developer";
  if (lower.includes("backend") || lower.includes("back-end")) return "Backend Developer";
  if (lower.includes("full stack") || lower.includes("fullstack")) return "Full Stack Developer";
  if (lower.includes("react")) return "React Developer";
  if (lower.includes("flutter")) return "Flutter Developer";
  if (lower.includes("data analyst")) return "Data Analyst";
  if (lower.includes("content writer") || lower.includes("content creator")) return "Content Writer";
  if (lower.includes("social media")) return "Social Media Manager";
  if (lower.includes("marketing")) return "Marketing Executive";

  return "the open position";
}

/**
 * Generate subject line
 */
function generateSubjectLine(role: string, profile: UserProfile): string {
  const cleanRole = role
    .replace(/position|role|job|opening/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (profile.name) {
    return `Application for ${cleanRole} Position - ${profile.name}`;
  }
  return `Application for ${cleanRole} Position`;
}

/**
 * Generate the email body using the user's exact preferred template.
 * All profile fields fall back gracefully if not provided.
 */
function generateEmail(
  description: string,
  profile: UserProfile
): { emailSubject: string; emailBody: string } {
  const role = extractRole(description);
  const emailSubject = generateSubjectLine(role, profile);

  // ── Greeting ──────────────────────────────────────────────────────────────
  const greeting = "Dear Hiring Team,";

  // ── Opening paragraph ─────────────────────────────────────────────────────
  const bio =
    profile.bio ||
    "a creative professional with a passion for building intuitive, user-friendly solutions";

  const opening =
    `I am writing to express my interest in the ${role} position. As ${bio}, ` +
    `I am eager to contribute my skills to your team and grow within your fast-paced environment.`;

  // ── Skills paragraph ──────────────────────────────────────────────────────
  // Detect field for skill blurb
  const lower = description.toLowerCase();
  let skillsParagraph: string;

  if (
    lower.includes("design") ||
    lower.includes("ui") ||
    lower.includes("ux") ||
    lower.includes("figma") ||
    lower.includes("product designer")
  ) {
    skillsParagraph =
      "I have a strong foundation in creating wireframes, prototypes, and mockups, " +
      "and I am highly proficient in design tools like figma, framer, visily. " +
      "I am particularly excited about bringing my experience and creativity to this role " +
      "and the opportunity to iterate quickly while collaborating with your team to ship high-quality work. " +
      "My focus is on continuous learning and applying a user-centered approach to every project I undertake.";
  } else if (
    lower.includes("software") ||
    lower.includes("developer") ||
    lower.includes("engineer") ||
    lower.includes("frontend") ||
    lower.includes("backend") ||
    lower.includes("react") ||
    lower.includes("flutter")
  ) {
    skillsParagraph =
      "I have a strong foundation in software development and problem-solving, " +
      "and I am proficient in modern development tools and frameworks. " +
      "I am particularly excited about bringing my technical skills and creativity to this role " +
      "and the opportunity to collaborate with your team to build high-quality products. " +
      "My focus is on continuous learning and writing clean, maintainable code.";
  } else if (lower.includes("data") || lower.includes("analyst")) {
    skillsParagraph =
      "I have a strong foundation in data analysis, visualization, and deriving actionable insights. " +
      "I am proficient in analytical tools and methodologies. " +
      "I am particularly excited about bringing my analytical mindset to this role " +
      "and the opportunity to work with your team on data-driven decision making. " +
      "My focus is on continuous learning and applying best practices in data analysis.";
  } else if (lower.includes("content") || lower.includes("writ") || lower.includes("copy")) {
    skillsParagraph =
      "I have a strong foundation in crafting compelling content across formats, " +
      "with a keen eye for audience engagement and brand voice. " +
      "I am particularly excited about bringing my writing skills and creativity to this role " +
      "and the opportunity to collaborate with your team on impactful campaigns. " +
      "My focus is on continuous improvement and delivering content that resonates.";
  } else {
    skillsParagraph =
      "I have a strong foundation in my field and am eager to apply my skills and knowledge " +
      "to real-world challenges. I am particularly excited about bringing my dedication and fresh " +
      "perspective to this role and the opportunity to collaborate with your team. " +
      "My focus is on continuous learning and delivering high-quality results.";
  }

  // ── Portfolio / links paragraph ────────────────────────────────────────────
  const linkLines: string[] = [];

  if (profile.portfolio) {
    linkLines.push(
      `You can explore my work through my framer portfolio : ${profile.portfolio}`
    );
  }
  if (profile.figma) {
    linkLines.push(
      `and my community figma profile :   ${profile.figma}`
    );
  }

  // Join portfolio lines on the same paragraph if both exist
  let portfolioParagraph = linkLines.join(" ");
  if (portfolioParagraph) portfolioParagraph = portfolioParagraph.trim() + ".";

  // Resume on its own line
  let resumeLine = "";
  if (profile.resumeLink) {
    resumeLine = `I have also attached my resume for your review: ${profile.resumeLink}.`;
  }

  // ── Closing ───────────────────────────────────────────────────────────────
  const closing =
    "Thank you for your time and consideration. " +
    "I look forward to the possibility of discussing how my passion and skills can benefit your team.";

  // ── Sign-off ──────────────────────────────────────────────────────────────
  let signoff = "Best regards,";

  if (profile.name) signoff += `\n${profile.name.toUpperCase()}`;
  if (profile.phone) signoff += `\n${profile.phone}`;

  // Email + LinkedIn on the same line
  const contactLine: string[] = [];
  if (profile.email) contactLine.push(profile.email);
  if (profile.linkedin) contactLine.push("LinkedIn");
  if (contactLine.length) signoff += `\n${contactLine.join(" | ")}`;

  // ── Assemble ──────────────────────────────────────────────────────────────
  const parts: string[] = [greeting, opening, skillsParagraph];

  if (portfolioParagraph) parts.push(portfolioParagraph);
  if (resumeLine) parts.push(resumeLine);

  parts.push(closing, signoff);

  return {
    emailSubject,
    emailBody: parts.join("\n\n"),
  };
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
    percentage: results.length > 0
      ? ((entryLevel / results.length) * 100).toFixed(1)
      : "0.0",
  };
}
