// Session expiration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_PROFILE_KEY = 'juno_session_profile';

export interface SessionProfile {
  profile: any;
  expiresAt: number;
}

/**
 * Check if session is still valid
 */
export function isSessionValid(): boolean {
  const sessionData = getSessionProfile();
  if (!sessionData) return false;
  
  const now = Date.now();
  if (sessionData.expiresAt < now) {
    // Expired, clear it
    clearSessionProfile();
    return false;
  }
  
  return true;
}

/**
 * Get session profile if valid
 */
export function getSessionProfile(): SessionProfile | null {
  try {
    const sessionStr = localStorage.getItem(SESSION_PROFILE_KEY);
    if (!sessionStr) return null;
    
    const session: SessionProfile = JSON.parse(sessionStr);
    
    // Check if expired
    if (session.expiresAt < Date.now()) {
      clearSessionProfile();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Save profile to localStorage with expiration (persists across tabs/browser restarts)
 */
export function saveSessionProfile(profile: any): void {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session: SessionProfile = {
    profile,
    expiresAt
  };
  
  localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(session));
}

/**
 * Clear session profile
 */
export function clearSessionProfile(): void {
  localStorage.removeItem(SESSION_PROFILE_KEY);
}

/**
 * Get remaining session time in hours
 */
export function getRemainingSessionHours(): number {
  const session = getSessionProfile();
  if (!session) return 0;
  
  const remaining = session.expiresAt - Date.now();
  return Math.max(0, Math.floor(remaining / (60 * 60 * 1000)));
}

