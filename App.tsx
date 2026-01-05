
import React, { useState, useRef, useEffect } from "react";
import { parseCSV } from "./utils/csvParser";
import { analyzeJobDescription } from "./geminiService";
import { AnalyzedJob, UserProfile } from "./types";
import JobCard from "./components/JobCard";
import {
  isSessionValid,
  getSessionProfile,
  saveSessionProfile,
  getRemainingSessionHours,
} from "./utils/sessionStorage";

const App: React.FC = () => {
  const [view, setView] = useState<"landing" | "dashboard">("landing");
  const [jobs, setJobs] = useState<AnalyzedJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, entryLevel: 0, skipped: 0 });
  const [showProfileModal, setShowProfileModal] = useState(false);
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

  const processAllJobs = async () => {
    if (jobs.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setProcessingMessage("Initializing Gemini AI core...");

    for (const job of jobs) {
      if (job.status !== "pending" && job.status !== "error") continue;

      let retries = 0;
      const maxRetries = 3;
      let success = false;

      while (!success && retries <= maxRetries) {
        updateJobData(job.id, { status: "analyzing", processing: true });

        try {
          const result = await analyzeJobDescription(
            job.description,
            userProfile
          );
          updateJobData(job.id, {
            status: result.isEntryLevel ? "completed" : "skipped",
            isEntryLevel: result.isEntryLevel,
            emailSubject: result.emailSubject,
            emailBody: result.emailBody,
            rejectionReason: result.reason,
            processing: false,
          });

          if (result.isEntryLevel) {
            setStats((s) => ({ ...s, entryLevel: s.entryLevel + 1 }));
          } else {
            setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
          }
          success = true;
          setProcessingMessage(`Processed ${job.email}`);
        } catch (e: any) {
          const isRateLimit =
            e.message?.includes("429") ||
            e.message?.includes("RESOURCE_EXHAUSTED");

          if (isRateLimit && retries < maxRetries) {
            retries++;
            const delay = Math.pow(2, retries) * 2000;
            setProcessingMessage(
              `Rate limit protection active. Retrying in ${delay / 1000}s...`
            );
            await new Promise((r) => setTimeout(r, delay));
          } else {
            updateJobData(job.id, { status: "error", processing: false });
            setProcessingMessage(`Failed to process ${job.email}`);
            break;
          }
        }
      }

      if (success) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setIsProcessing(false);
    setProcessingMessage("Campaign analysis finalized.");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-gray-900 selection:bg-black selection:text-white">
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-extrabold text-gray-900">Profile Context</h2>
              <button
                onClick={closeProfileModal}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className={`rounded-xl p-4 flex gap-3 items-center ${isSessionValid() ? 'bg-green-50 border border-green-100' : 'bg-blue-50 border border-blue-100'}`}>
                <div className={`w-2 h-2 rounded-full ${isSessionValid() ? 'bg-green-500' : 'bg-blue-500'}`} />
                <p className={`text-xs font-semibold ${isSessionValid() ? 'text-green-800' : 'text-blue-800'}`}>
                  {isSessionValid() 
                    ? `Profile persistence active. ${getRemainingSessionHours()} hours remaining.` 
                    : "Save profile to enable 7-day cloudless persistence."}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="Full Name" name="name" value={userProfile.name} onChange={handleProfileChange} placeholder="Alex Rivera" />
                <InputField label="Email Address" name="email" value={userProfile.email} onChange={handleProfileChange} placeholder="alex@example.com" />
                <InputField label="Phone" name="phone" value={userProfile.phone} onChange={handleProfileChange} placeholder="+1 234 567" />
                <InputField label="Portfolio" name="portfolio" value={userProfile.portfolio} onChange={handleProfileChange} placeholder="https://alex.design" />
                <InputField label="LinkedIn" name="linkedin" value={userProfile.linkedin} onChange={handleProfileChange} placeholder="linkedin.com/in/alex" />
                <InputField label="Figma" name="figma" value={userProfile.figma} onChange={handleProfileChange} placeholder="figma.com/@alex" />
                <div className="md:col-span-2">
                   <InputField label="Resume Direct Link" name="resumeLink" value={userProfile.resumeLink} onChange={handleProfileChange} placeholder="Google Drive or Dropbox link" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Professional Narrative</label>
                <textarea
                  name="bio"
                  value={userProfile.bio}
                  onChange={handleProfileChange}
                  placeholder="Tell Gemini about your core strengths..."
                  rows={4}
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-black focus:border-black outline-none text-sm transition-all resize-none font-medium"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={closeProfileModal} className="px-6 py-2.5 rounded-full text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">Discard</button>
              <button onClick={saveProfile} className="bg-black text-white px-8 py-2.5 rounded-full text-sm font-black tracking-tight hover:scale-[1.02] active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="px-8 md:px-16 py-6 flex items-center justify-between border-b bg-white/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView("landing")}>
          <div className="bg-black p-1.5 rounded-lg group-hover:rotate-6 transition-transform">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M10 10H16V16H10V10Z" fill="white" />
              <path d="M16 16H22V22H16V16Z" fill="white" />
            </svg>
          </div>
          <span className="text-xl font-black tracking-tighter">JUNO</span>
        </div>
        <div className="flex items-center gap-8">
          <button onClick={() => setShowProfileModal(true)} className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-black transition-colors">
            Profile {isDirty && <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full ml-1" />}
          </button>
          {view === "dashboard" && (
             <button onClick={() => setView("landing")} className="bg-black text-white px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all">New Campaign</button>
          )}
        </div>
      </nav>

      {view === "landing" ? (
        <div className="animate-in fade-in duration-700">
          {/* Hero Section */}
          <section className="relative px-6 md:px-16 pt-24 pb-32 overflow-hidden">
            <div className="absolute inset-0 -z-10 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            
            <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white border border-gray-100 shadow-sm rounded-full mb-10">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Next-Gen Career Automation</span>
              </div>
              
              <h1 className="text-6xl md:text-[5.5rem] font-black tracking-[-0.04em] leading-[0.95] text-gray-900 mb-10 max-w-5xl">
                Land your next role <br/> 
                <span className="text-gray-400">while you sleep.</span>
              </h1>
              
              <p className="text-lg md:text-2xl text-gray-500 mb-14 max-w-2xl font-medium leading-tight">
                Upload your job leads. Juno filters for entry-level roles and drafts hyper-personalized emails instantly.
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

          {/* Feature Grid */}
          <section className="px-6 md:px-16 py-24 bg-white border-y border-gray-100">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <FeatureCard 
                  step="01"
                  title="Bulk Import"
                  desc="Drop your CSV containing emails and job descriptions. We handle the heavy lifting."
                  icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 014-4h1m-5 4v2a4 4 0 01-4 4H3m5-4h3m-3 1h3m2-5h3m-3 1h3" />}
                />
                <FeatureCard 
                  step="02"
                  title="Smart Filtering"
                  desc="Gemini AI identifies genuine entry-level roles (0-2 yrs), skipping the noise automatically."
                  icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />}
                />
                <FeatureCard 
                  step="03"
                  title="One-Tap Apply"
                  desc="Personalized drafts open directly in Gmail. No copy-pasting required."
                  icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />}
                />
              </div>
            </div>
          </section>
          
          <footer className="py-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Juno Professional Career Engine</p>
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
                  {isProcessing ? "PROCESSING..." : "START ANALYSIS"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <StatItem label="Leads" value={stats.total} icon={<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8z" />} />
            <StatItem label="Qualified" value={stats.entryLevel} highlight icon={<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />} />
            <StatItem label="Skipped" value={stats.skipped} icon={<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />} />
            <StatItem label="Pending" value={jobs.filter(j => j.status === "pending" || j.status === "error").length} icon={<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} />
          </div>

          {jobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {jobs
                .filter(j => j.status !== "skipped")
                .map((job) => (
                  <JobCard key={job.id} job={job} onUpdate={(updates) => updateJobData(job.id, updates)} />
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

const FeatureCard = ({ step, title, desc, icon }: { step: string; title: string; desc: string; icon: React.ReactNode }) => (
  <div className="group space-y-6 hover:-translate-y-2 transition-all duration-300">
    <div className="flex items-center gap-4">
      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{step}</span>
      <div className="h-px flex-1 bg-gray-100 group-hover:bg-black transition-colors" />
    </div>
    <div className="bg-gray-50 group-hover:bg-black group-hover:text-white w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300">
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
    </div>
    <div className="space-y-3">
      <h3 className="text-2xl font-black tracking-tight">{title}</h3>
      <p className="text-gray-500 font-medium leading-relaxed">{desc}</p>
    </div>
  </div>
);

const StatItem = ({ label, value, highlight, icon }: { label: string; value: number; highlight?: boolean; icon: React.ReactNode }) => (
  <div className={`relative p-8 rounded-[2.5rem] flex flex-col justify-between overflow-hidden transition-all duration-300 border ${
    highlight ? "bg-black text-white shadow-2xl shadow-black/20 border-black" : "bg-white border-gray-100 shadow-sm hover:border-gray-300"
  }`}>
    <p className={`text-[11px] font-black uppercase tracking-[0.2em] mb-4 ${highlight ? "text-gray-400" : "text-gray-400"}`}>{label}</p>
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
