import React, { useState } from "react";
import { parseCSV } from "./utils/csvParser";
import { analyzeJobDescriptionLocal } from "./utils/localAnalyzer";
import { AnalyzedJob, UserProfile } from "./types";
import JobCard from "./components/JobCard";
import {
  isSessionValid,
  getSessionProfile,
  saveSessionProfile,
} from "./utils/sessionStorage";

const App: React.FC = () => {
  const [view, setView] = useState<"landing" | "dashboard">("landing");
  const [jobs, setJobs] = useState<AnalyzedJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, entryLevel: 0, skipped: 0 });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSkippedPanel, setShowSkippedPanel] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");

  // Load saved profile from session or create empty
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (isSessionValid()) {
      const session = getSessionProfile();
      if (session) {
        return { ...session.profile };
      }
    }

    return {
      name: "",
      email: "",
      phone: "",
      portfolio: "",
      linkedin: "",
      figma: "",
      resumeLink: "",
      bio: "",
    };
  });

  const [initialProfile, setInitialProfile] =
    useState<UserProfile>(userProfile);

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setUserProfile((prev) => {
      const next = { ...prev, [name]: value };
      setIsDirty(JSON.stringify(next) !== JSON.stringify(initialProfile));
      return next;
    });
  };

  const saveProfile = () => {
    saveSessionProfile(userProfile);
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
        setJobs(
          rawData.map((d, i) => ({
            ...d,
            id: `${Date.now()}-${i}`,
            isEntryLevel: false,
            processing: false,
            status: "pending",
          }))
        );
        setStats({ total: rawData.length, entryLevel: 0, skipped: 0 });
        setView("dashboard");
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
  };

  const updateJobData = (id: string, updates: Partial<AnalyzedJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...updates } : j))
    );
  };

  const discardJob = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    
    if (confirm("Are you sure you want to discard this job? This action cannot be undone.")) {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      
      // Update stats based on job status
      if (job.status === "completed") {
        setStats((s) => ({ 
          ...s, 
          total: s.total - 1,
          entryLevel: s.entryLevel - 1
        }));
      } else {
        setStats((s) => ({ 
          ...s, 
          total: s.total - 1
        }));
      }
    }
  };

  const regenerateEmailForSkipped = (job: AnalyzedJob) => {
    if (confirm(`Generate application email for this job?\n\nEmail: ${job.email}`)) {
      // Re-analyze and force it as entry-level
      const result = analyzeJobDescriptionLocal(job.description, userProfile);
      
      updateJobData(job.id, {
        status: "completed",
        isEntryLevel: true,
        emailSubject: result.emailSubject,
        emailBody: result.emailBody,
        rejectionReason: "Manually approved by user",
      });

      setStats((s) => ({ 
        ...s, 
        entryLevel: s.entryLevel + 1,
        skipped: s.skipped - 1
      }));

      // Show success message
      setProcessingMessage("✓ Email generated successfully!");
      setTimeout(() => setProcessingMessage(""), 3000);
    }
  };

  const processAllJobs = async () => {
    if (jobs.length === 0 || isProcessing) return;
    
    setIsProcessing(true);
    setProcessingMessage("⚡ Analyzing jobs locally (instant, no API needed)...");

    const pendingJobs = jobs.filter(
      (j) => j.status === "pending" || j.status === "error"
    );

    let completed = 0;
    let entryLevelCount = 0;
    let skippedCount = 0;

    // Process jobs with a small delay for UI updates
    for (const job of pendingJobs) {
      updateJobData(job.id, { status: "analyzing", processing: true });

      try {
        const result = analyzeJobDescriptionLocal(job.description, userProfile);
        
        completed++;
        
        updateJobData(job.id, {
          status: result.isEntryLevel ? "completed" : "skipped",
          isEntryLevel: result.isEntryLevel,
          emailSubject: result.emailSubject,
          emailBody: result.emailBody,
          rejectionReason: result.reason,
          processing: false,
        });

        if (result.isEntryLevel) {
          entryLevelCount++;
          setStats((s) => ({ ...s, entryLevel: s.entryLevel + 1 }));
        } else {
          skippedCount++;
          setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
        }

        setProcessingMessage(
          `⚡ Processed ${completed}/${pendingJobs.length} jobs (${entryLevelCount} qualified)`
        );

        await new Promise((r) => setTimeout(r, 50));

      } catch (e: any) {
        console.error(`Error processing ${job.email}:`, e);
        updateJobData(job.id, { 
          status: "error", 
          processing: false,
          rejectionReason: "Analysis failed"
        });
      }
    }

    setIsProcessing(false);
    setProcessingMessage(
      `✓ Completed! ${entryLevelCount} entry-level jobs found from ${pendingJobs.length} analyzed.`
    );
    
    setTimeout(() => {
      setProcessingMessage("");
    }, 5000);
  };

  const skippedJobs = jobs.filter((j) => j.status === "skipped");
  const qualifiedJobs = jobs.filter((j) => j.status === "completed");

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-10 py-8 flex items-center justify-between z-10">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-gray-900">Your Profile</h2>
                <p className="text-sm text-gray-400 font-medium mt-1">Configure your application details</p>
              </div>
              <button
                onClick={closeProfileModal}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="px-10 py-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Full Name" name="name" value={userProfile.name} onChange={handleProfileChange} placeholder="John Doe" />
                <InputField label="Email" name="email" type="email" value={userProfile.email} onChange={handleProfileChange} placeholder="you@example.com" />
                <InputField label="Phone" name="phone" type="tel" value={userProfile.phone} onChange={handleProfileChange} placeholder="+1 (555) 123-4567" />
                <InputField label="Portfolio URL" name="portfolio" type="url" value={userProfile.portfolio} onChange={handleProfileChange} placeholder="https://yoursite.com" />
                <InputField label="LinkedIn" name="linkedin" type="url" value={userProfile.linkedin} onChange={handleProfileChange} placeholder="https://linkedin.com/in/you" />
                <InputField label="Figma Profile" name="figma" type="url" value={userProfile.figma} onChange={handleProfileChange} placeholder="https://figma.com/@you" />
              </div>
              
              <InputField label="Resume Link" name="resumeLink" type="url" value={userProfile.resumeLink} onChange={handleProfileChange} placeholder="https://drive.google.com/..." />
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Bio / Intro</label>
                <textarea
                  name="bio"
                  value={userProfile.bio}
                  onChange={handleProfileChange}
                  rows={4}
                  placeholder="Brief intro about yourself, skills, and career goals..."
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-black focus:border-black outline-none text-sm transition-all font-medium placeholder:text-gray-300 resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-10 py-6 flex justify-end gap-4">
              <button
                onClick={closeProfileModal}
                className="px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={!isDirty}
                className="bg-black text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 hover:shadow-black/20 disabled:opacity-30 disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all"
              >
                {isDirty ? "Save Changes" : "Saved"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skipped Jobs Slider Panel */}
      {showSkippedPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowSkippedPanel(false)}
          />
          
          {/* Slider Panel */}
          <div className="relative bg-white h-full w-full max-w-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-gray-900">Skipped Jobs</h2>
                <p className="text-sm text-gray-400 font-medium mt-1">
                  {skippedJobs.length} jobs filtered out • Review and regenerate if needed
                </p>
              </div>
              <button
                onClick={() => setShowSkippedPanel(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Skipped Jobs List */}
            <div className="overflow-y-auto h-[calc(100vh-88px)] px-8 py-6 space-y-4 custom-scrollbar">
              {skippedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-gray-50 p-6 rounded-3xl mb-6">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No skipped jobs</h3>
                  <p className="text-gray-400 max-w-xs mx-auto text-sm">
                    All jobs passed the entry-level filter or haven't been analyzed yet.
                  </p>
                </div>
              ) : (
                skippedJobs.map((job) => (
                  <SkippedJobCard 
                    key={job.id} 
                    job={job} 
                    onRegenerate={() => regenerateEmailForSkipped(job)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {view === "landing" ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <header className="px-6 md:px-16 py-8 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center">
                <span className="text-white font-black text-xl">J</span>
              </div>
              <span className="font-black text-xl tracking-tight">Juno</span>
              <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                ⚡ Local Mode
              </span>
            </div>
            
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-6 py-2.5 rounded-full border border-gray-200 hover:border-black hover:bg-black hover:text-white font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {userProfile.name || "Setup Profile"}
            </button>
          </header>

          {/* Hero */}
          <section className="px-6 md:px-16 py-32 md:py-40">
            <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white border border-gray-100 shadow-sm rounded-full mb-10">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">⚡ Instant Analysis • No API</span>
              </div>
              
              <h1 className="text-6xl md:text-[5.5rem] font-black tracking-[-0.04em] leading-[0.95] text-gray-900 mb-10 max-w-5xl">
                Land your next role <br/> 
                <span className="text-gray-400">lightning fast.</span>
              </h1>
              
              <p className="text-lg md:text-2xl text-gray-500 mb-6 max-w-2xl font-medium leading-tight">
                Upload your job leads. Local AI filters for entry-level roles and drafts personalized emails instantly.
              </p>
              
              <p className="text-sm text-green-600 font-bold mb-14 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                No API needed • 100% free • Works offline • Process 1000+ jobs in seconds
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <label className="relative group cursor-pointer">
                  <div className="absolute -inset-1 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                  <div className="relative bg-black text-white px-12 py-5 rounded-full font-black text-lg inline-flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Import Lead CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </div>
                </label>
              </div>
            </div>
          </section>

          <footer className="py-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Juno Local Engine • No API Required</p>
          </footer>
        </div>
      ) : (
        <main className="px-8 md:px-16 py-12 max-w-7xl mx-auto animate-in slide-in-from-right-8 duration-500">
          <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12">
            <div className="space-y-1">
               <button onClick={() => setView("landing")} className="group text-xs font-bold text-gray-400 hover:text-black flex items-center gap-2 transition-colors mb-4">
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                EXIT TO HOME
              </button>
              <h2 className="text-4xl font-black tracking-tight text-gray-900">Campaign Manager</h2>
              <div className="h-1 w-20 bg-black rounded-full" />
            </div>
            
            <div className="flex items-center gap-4">
              {isProcessing && (
                <div className="flex items-center gap-3 px-4 py-2 bg-black text-white rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-widest">{processingMessage}</span>
                </div>
              )}
              {!isProcessing && processingMessage && (
                <div className="flex items-center gap-3 px-4 py-2 bg-green-500 text-white rounded-full">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  <span className="text-[11px] font-black uppercase tracking-widest">{processingMessage}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setJobs([])}
                  className="px-6 py-2.5 text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                >
                  CLEAR
                </button>
                <button
                  onClick={processAllJobs}
                  disabled={isProcessing || !jobs.some(j => j.status === "pending" || j.status === "error")}
                  className="bg-black text-white px-8 py-2.5 rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 hover:shadow-black/20 disabled:opacity-30 disabled:shadow-none hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isProcessing ? "ANALYZING..." : "⚡ ANALYZE LOCALLY"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <StatItem label="Leads" value={stats.total} icon={<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8z" />} />
            <StatItem label="Qualified" value={stats.entryLevel} highlight icon={<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />} />
            <button 
              onClick={() => setShowSkippedPanel(true)}
              className="text-left"
            >
              <StatItem 
                label="Skipped" 
                value={stats.skipped} 
                icon={<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />} 
                clickable
              />
            </button>
            <StatItem label="Pending" value={jobs.filter(j => j.status === "pending" || j.status === "error").length} icon={<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} />
          </div>

          {jobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {qualifiedJobs.map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  onUpdate={(updates) => updateJobData(job.id, updates)}
                  onDiscard={() => discardJob(job.id)}
                />
              ))}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100 rounded-3xl">
               <div className="bg-gray-50 p-6 rounded-3xl mb-6">
                 <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-2">No active campaign</h3>
               <p className="text-gray-400 max-w-xs mx-auto text-sm">Upload a CSV on the home screen to start generating application drafts.</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
};

// Skipped Job Card Component
const SkippedJobCard = ({ job, onRegenerate }: { job: AnalyzedJob; onRegenerate: () => void }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-300 transition-all">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 mb-1 text-sm">{job.email}</h3>
        {job.phone && (
          <p className="text-xs text-gray-500">{job.phone}</p>
        )}
      </div>
      <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-wider rounded-full">
        Skipped
      </span>
    </div>

    {/* Rejection Reason */}
    {job.rejectionReason && (
      <div className="mb-4 p-3 bg-orange-50 rounded-lg">
        <p className="text-xs font-medium text-orange-800">
          <span className="font-black">Reason: </span>
          {job.rejectionReason}
        </p>
      </div>
    )}

    {/* Job Description Preview */}
    <div className="mb-4">
      <p className="text-xs text-gray-600 line-clamp-3">
        {job.description}
      </p>
    </div>

    {/* Action Button */}
    <button
      onClick={onRegenerate}
      className="w-full px-4 py-2.5 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Generate Email Anyway
    </button>
  </div>
);

const StatItem = ({ 
  label, 
  value, 
  highlight, 
  icon, 
  clickable 
}: { 
  label: string; 
  value: number; 
  highlight?: boolean; 
  icon: React.ReactNode;
  clickable?: boolean;
}) => (
  <div className={`relative p-8 rounded-[2.5rem] flex flex-col justify-between overflow-hidden transition-all duration-300 border ${
    highlight ? "bg-black text-white shadow-2xl shadow-black/20 border-black" : "bg-white border-gray-100 shadow-sm hover:border-gray-300"
  } ${clickable ? 'cursor-pointer hover:scale-[1.02] active:scale-95' : ''}`}>
    <p className={`text-[11px] font-black uppercase tracking-[0.2em] mb-4 ${highlight ? "text-gray-400" : "text-gray-400"}`}>
      {label}
      {clickable && value > 0 && (
        <span className="ml-2 text-[10px] opacity-60">(click to view)</span>
      )}
    </p>
    <div className="flex items-end justify-between">
      <p className="text-5xl font-black tracking-tighter leading-none">{value}</p>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${highlight ? 'bg-white/10' : 'bg-gray-50'}`}>
         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
    </div>
  </div>
);

const InputField = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</label>
    <input
      {...props}
      className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-black focus:border-black outline-none text-sm transition-all font-medium placeholder:text-gray-300"
    />
  </div>
);

export default App;