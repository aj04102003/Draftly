
import React, { useState, useRef, useEffect } from 'react';
import { parseCSV } from './utils/csvParser';
import { analyzeJobDescription } from './geminiService';
import { AnalyzedJob, UserProfile } from './types';
import JobCard from './components/JobCard';

const STORAGE_KEY = 'juno_profile_v6';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');
  const [jobs, setJobs] = useState<AnalyzedJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, entryLevel: 0, skipped: 0 });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      name: '', email: '', phone: '', portfolio: '', linkedin: '', figma: '', resumeLink: '', bio: '', isLoggedIn: false
    };
  });

  const [initialProfile, setInitialProfile] = useState<UserProfile>(userProfile);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => {
      const next = { ...prev, [name]: value };
      setIsDirty(JSON.stringify(next) !== JSON.stringify(initialProfile));
      return next;
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...userProfile, isLoggedIn: true };
    setUserProfile(updated);
    setInitialProfile(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    const updated = { ...userProfile, isLoggedIn: false };
    setUserProfile(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const saveProfile = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
    setInitialProfile(userProfile);
    setIsDirty(false);
    setShowProfileModal(false);
  };

  const closeProfileModal = () => {
    if (isDirty) {
      if (confirm("You have unsaved changes. Close anyway?")) {
        setUserProfile(initialProfile);
        setIsDirty(false);
        setShowProfileModal(false);
      }
    } else {
      setShowProfileModal(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rawData = parseCSV(e.target?.result as string);
        setJobs(rawData.map((d, i) => ({ ...d, id: `${Date.now()}-${i}`, isEntryLevel: false, processing: false, status: 'pending' })));
        setStats({ total: rawData.length, entryLevel: 0, skipped: 0 });
        setView('dashboard');
      } catch (err: any) { alert(err.message); }
    };
    reader.readAsText(file);
  };

  const updateJobData = (id: string, updates: Partial<AnalyzedJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const processAllJobs = async () => {
    if (jobs.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setProcessingMessage('Starting analysis...');
    
    for (const job of jobs) {
      if (job.status !== 'pending' && job.status !== 'error') continue;
      
      let retries = 0;
      const maxRetries = 3;
      let success = false;

      while (!success && retries <= maxRetries) {
        updateJobData(job.id, { status: 'analyzing', processing: true });
        
        try {
          const result = await analyzeJobDescription(job.description, userProfile);
          updateJobData(job.id, {
            status: result.isEntryLevel ? 'completed' : 'skipped',
            isEntryLevel: result.isEntryLevel,
            emailSubject: result.emailSubject,
            emailBody: result.emailBody,
            rejectionReason: result.reason,
            processing: false
          });
          
          if (result.isEntryLevel) {
            setStats(s => ({ ...s, entryLevel: s.entryLevel + 1 }));
          } else {
            setStats(s => ({ ...s, skipped: s.skipped + 1 }));
          }
          success = true;
          setProcessingMessage(`Processed ${job.email}`);
        } catch (e: any) {
          const isRateLimit = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED');
          
          if (isRateLimit && retries < maxRetries) {
            retries++;
            const delay = Math.pow(2, retries) * 2000; // Exponential backoff: 4s, 8s, 16s
            setProcessingMessage(`Rate limit hit. Retrying in ${delay / 1000}s...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            updateJobData(job.id, { status: 'error', processing: false });
            setProcessingMessage(`Failed to process ${job.email}`);
            break; // Move to next job
          }
        }
      }
      
      // Mandatory gap between successful requests to stay within free tier limits
      if (success) {
        await new Promise(r => setTimeout(r, 1500)); 
      }
    }
    
    setIsProcessing(false);
    setProcessingMessage('Analysis complete.');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-center mb-6">
                 <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 21a9.997 9.997 0 008.105-4.131m-5.12-2.192L14 14m-9 0h.01M5.013 5.311A10.001 10.001 0 0011 20.213m1-4.213V15m0-10V4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
              </div>
              <h2 className="text-xl font-bold text-center mb-2">Welcome Back</h2>
              <p className="text-sm text-gray-500 text-center mb-8">Sign in to save your application profile.</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <input required type="email" placeholder="Email address" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-black outline-none text-sm" />
                <input required type="password" placeholder="Password" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-black outline-none text-sm" />
                <button type="submit" className="btn-primary w-full py-3 rounded-xl font-bold text-sm">Sign In</button>
              </form>
              <button onClick={() => setShowLoginModal(false)} className="w-full mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Profile Configuration</h2>
              <button onClick={closeProfileModal} className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                  <input name="name" value={userProfile.name} onChange={handleProfileChange} placeholder="Enter your name" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                  <input name="email" value={userProfile.email} onChange={handleProfileChange} placeholder="Enter your email" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Portfolio URL</label>
                  <input name="portfolio" value={userProfile.portfolio} onChange={handleProfileChange} placeholder="https://yourportfolio.com" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resume Link</label>
                  <input name="resumeLink" value={userProfile.resumeLink} onChange={handleProfileChange} placeholder="Shareable link to CV" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Professional Bio</label>
                <textarea name="bio" value={userProfile.bio} onChange={handleProfileChange} placeholder="Describe your background briefly..." rows={3} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm resize-none" />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
              <button onClick={closeProfileModal} className="px-5 py-2 rounded-full text-sm font-semibold text-gray-500 hover:text-gray-800 transition">Dismiss</button>
              <button onClick={saveProfile} className="btn-primary px-7 py-2 rounded-full text-sm font-bold">Update Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Navigation */}
      <nav className="px-6 md:px-12 py-5 flex items-center justify-between border-b bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="black"/>
              <path d="M10 10H16V16H10V10Z" fill="white"/>
              <path d="M16 16H22V22H16V16Z" fill="white"/>
            </svg>
            <span className="text-lg font-bold tracking-tight">Juno</span>
          </div>
          <div className="hidden lg:flex items-center gap-8 text-[13px] font-semibold text-gray-500">
            <button className="hover:text-black transition">Product</button>
            <button className="hover:text-black transition">Solutions</button>
            <button className="hover:text-black transition">Enterprise</button>
            <button className="hover:text-black transition">Resources</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {userProfile.isLoggedIn ? (
            <>
              <button onClick={() => setShowProfileModal(true)} className="px-4 py-1.5 text-sm font-bold text-gray-600 hover:text-black transition">Profile Settings</button>
              <button onClick={handleLogout} className="px-4 py-1.5 text-sm font-bold text-red-500 hover:text-red-700 transition">Logout</button>
            </>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="btn-primary px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider">Login</button>
          )}
        </div>
      </nav>

      {view === 'landing' ? (
        <section className="px-6 md:px-12 py-20 md:py-32 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">v2.0 Career Automation</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-gray-900 mb-8 max-w-4xl">
            Where Marketing Careers <br/> are Build.
          </h1>
          <p className="text-lg md:text-xl text-gray-500 mb-12 max-w-2xl font-medium leading-relaxed">
            Automate the discovery and application process for entry-level opportunities. Upload your leads and let AI do the heavy lifting.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <label className="btn-primary px-10 py-4 rounded-full font-bold cursor-pointer inline-flex items-center gap-3 text-base group">
              Import Lead CSV <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <button className="px-10 py-4 bg-white border border-gray-200 rounded-full font-bold text-gray-700 hover:bg-gray-50 transition">Watch demo ↗</button>
          </div>
        </section>
      ) : (
        <main className="px-6 md:px-12 py-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="flex items-center justify-between mb-10">
            <div>
              <button onClick={() => setView('landing')} className="text-sm font-bold text-gray-400 hover:text-black flex items-center gap-1 transition mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                Back to import
              </button>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Campaign Dashboard</h2>
              {isProcessing && (
                <p className="text-sm font-bold text-blue-600 mt-1 animate-pulse">{processingMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => setJobs([])} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-red-500 transition">Clear Queue</button>
               <button 
                  onClick={processAllJobs} 
                  disabled={isProcessing || !jobs.some(j => j.status === 'pending' || j.status === 'error')} 
                  className="btn-primary px-8 py-2.5 rounded-full font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? "Processing..." : "Run Analysis"}
                  {!isProcessing && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>}
                </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatItem label="Lead Volume" value={stats.total} />
            <StatItem label="Entry Level" value={stats.entryLevel} highlight />
            <StatItem label="Skipped" value={stats.skipped} />
            <StatItem label="Remaining" value={jobs.filter(j => j.status === 'pending' || j.status === 'error').length} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {jobs.filter(j => j.status !== 'skipped').map(job => (
              <JobCard key={job.id} job={job} onUpdate={(updates) => updateJobData(job.id, updates)} />
            ))}
          </div>
        </main>
      )}
    </div>
  );
};

const StatItem = ({ label, value, highlight }: { label: string, value: number, highlight?: boolean }) => (
  <div className={`p-6 rounded-2xl border flex flex-col justify-between h-32 transition-all ${highlight ? 'bg-black text-white shadow-xl shadow-black/10' : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'}`}>
    <p className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
    <p className="text-4xl font-extrabold tracking-tight">{value}</p>
  </div>
);

export default App;
