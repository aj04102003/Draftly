
export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  portfolio: string;
  linkedin: string;
  figma: string;
  resumeLink: string;
  bio: string;
}

export interface RawJobData {
  email: string;
  phone: string;
  description: string;
}

export interface AnalyzedJob extends RawJobData {
  id: string;
  isEntryLevel: boolean;
  emailSubject?: string;
  emailBody?: string;
  rejectionReason?: string;
  processing: boolean;
  status: 'pending' | 'analyzing' | 'completed' | 'skipped' | 'error';
}

export interface GeminiAnalysisResponse {
  isEntryLevel: boolean;
  emailSubject: string;
  emailBody: string;
  reason: string;
}
