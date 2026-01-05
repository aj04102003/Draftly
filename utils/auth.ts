// Session expiration: 2.5 hours (150 minutes)
const SESSION_DURATION_MS = 2.5 * 60 * 60 * 1000;

export interface UserAccount {
  email: string;
  password: string; // In production, this should be hashed
  profile: any;
  createdAt: number;
}

const USERS_STORAGE_KEY = 'juno_users';
const CURRENT_SESSION_KEY = 'juno_current_session';

export interface SessionData {
  email: string;
  expiresAt: number;
  profile: any;
}

/**
 * Check if a session is still valid
 */
export function isSessionValid(): boolean {
  const sessionData = getSessionData();
  if (!sessionData) return false;
  
  const now = Date.now();
  return sessionData.expiresAt > now;
}

/**
 * Get current session data
 */
export function getSessionData(): SessionData | null {
  try {
    const sessionStr = sessionStorage.getItem(CURRENT_SESSION_KEY);
    if (!sessionStr) return null;
    
    const session: SessionData = JSON.parse(sessionStr);
    
    // Check if expired
    if (session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Create a new session
 */
export function createSession(email: string, profile: any): SessionData {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session: SessionData = {
    email,
    expiresAt,
    profile
  };
  
  sessionStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Clear current session
 */
export function clearSession(): void {
  sessionStorage.removeItem(CURRENT_SESSION_KEY);
}

/**
 * Get all registered users
 */
function getUsers(): Map<string, UserAccount> {
  try {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY);
    if (!usersStr) return new Map();
    
    const usersArray: UserAccount[] = JSON.parse(usersStr);
    const usersMap = new Map<string, UserAccount>();
    
    usersArray.forEach(user => {
      usersMap.set(user.email.toLowerCase(), user);
    });
    
    return usersMap;
  } catch {
    return new Map();
  }
}

/**
 * Save users to storage
 */
function saveUsers(users: Map<string, UserAccount>): void {
  const usersArray = Array.from(users.values());
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersArray));
}

/**
 * Sign up a new user
 */
export function signUp(email: string, password: string, profile: any): { success: boolean; error?: string } {
  const users = getUsers();
  const emailLower = email.toLowerCase().trim();
  
  // Validate email
  if (!emailLower || !emailLower.includes('@')) {
    return { success: false, error: 'Please enter a valid email address' };
  }
  
  // Validate password
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  
  // Check if user already exists
  if (users.has(emailLower)) {
    return { success: false, error: 'An account with this email already exists' };
  }
  
  // Create new user
  const newUser: UserAccount = {
    email: emailLower,
    password, // In production, hash this
    profile: { ...profile, email: emailLower },
    createdAt: Date.now()
  };
  
  users.set(emailLower, newUser);
  saveUsers(users);
  
  // Create session
  createSession(emailLower, newUser.profile);
  
  return { success: true };
}

/**
 * Sign in an existing user
 */
export function signIn(email: string, password: string): { success: boolean; error?: string; profile?: any } {
  const users = getUsers();
  const emailLower = email.toLowerCase().trim();
  
  const user = users.get(emailLower);
  
  if (!user) {
    return { success: false, error: 'No account found with this email' };
  }
  
  if (user.password !== password) {
    return { success: false, error: 'Incorrect password' };
  }
  
  // Create session
  createSession(emailLower, user.profile);
  
  return { success: true, profile: user.profile };
}

/**
 * Update user profile
 */
export function updateUserProfile(email: string, profile: any): boolean {
  const users = getUsers();
  const emailLower = email.toLowerCase().trim();
  
  const user = users.get(emailLower);
  if (!user) return false;
  
  user.profile = { ...profile, email: emailLower };
  saveUsers(users);
  
  // Update session if active
  const session = getSessionData();
  if (session && session.email === emailLower) {
    createSession(emailLower, user.profile);
  }
  
  return true;
}

/**
 * Get user profile by email
 */
export function getUserProfile(email: string): any | null {
  const users = getUsers();
  const emailLower = email.toLowerCase().trim();
  const user = users.get(emailLower);
  return user ? user.profile : null;
}

