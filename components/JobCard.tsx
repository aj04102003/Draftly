
import React, { useState } from 'react';
import { AnalyzedJob } from '../types';

interface JobCardProps {
  job: AnalyzedJob;
  onUpdate: (updates: Partial<AnalyzedJob>) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showJD, setShowJD] = useState(false);
  const [editedBody, setEditedBody] = useState(job.emailBody || "");

  const openGmail = () => {
    if (!job.emailBody || !job.emailSubject) return;
    const baseUrl = "https://mail.google.com/mail/?view=cm&fs=1";
    const to = encodeURIComponent(job.email);
    const subject = encodeURIComponent(job.emailSubject);
    const body = encodeURIComponent(job.emailBody);
    window.open(`${baseUrl}&to=${to}&su=${subject}&body=${body}`, '_blank');
  };

  const handleSaveEdit = () => {
    onUpdate({ emailBody: editedBody });
    setIsEditing(false);
  };

  const copyToClipboard = () => {
    if (job.emailBody) {
      navigator.clipboard.writeText(job.emailBody);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col h-[400px] shadow-sm hover:shadow-md hover:border-gray-200 transition-all group relative">
      {/* JD Modal Overlay */}
      {showJD && (
        <div className="absolute inset-0 bg-white z-20 rounded-2xl p-6 flex flex-col animate-in fade-in duration-200">
           <div className="flex justify-between items-center mb-4">
              <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Original Job Description</h4>
              <button onClick={() => setShowJD(false)} className="p-1 hover:bg-gray-100 rounded-full transition text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
           </div>
           <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-[11px] text-gray-600 leading-relaxed font-medium bg-gray-50 rounded-lg p-3">
              {job.description}
           </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-500 group-hover:bg-black group-hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 truncate w-32">{job.email.split('@')[0]}</h3>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{job.email.split('@')[1]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={() => setShowJD(true)} 
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black transition"
            title="View JD"
           >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </button>
           <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
            job.status === 'completed' ? 'bg-green-50 text-green-700' : 
            job.status === 'analyzing' ? 'bg-blue-50 text-blue-700 animate-pulse' : 
            'bg-gray-100 text-gray-400'
           }`}>
            {job.status}
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {job.status === 'completed' ? (
          <div className="flex-1 flex flex-col space-y-3">
            <div>
              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest block mb-0.5">Subject</span>
              <p className="text-xs font-bold text-gray-800 line-clamp-1">{job.emailSubject}</p>
            </div>
            <div className="flex-1 bg-gray-50/80 border border-gray-100 rounded-xl p-3 overflow-hidden flex flex-col relative">
              <div className="flex justify-between items-center mb-1.5">
                 <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Email Preview</span>
                 {!isEditing ? (
                    <button 
                      onClick={() => { setEditedBody(job.emailBody || ""); setIsEditing(true); }} 
                      className="p-1 hover:bg-white rounded-md text-gray-400 hover:text-black transition"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                 ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={handleSaveEdit} className="text-[9px] font-bold text-green-600 hover:text-green-800">Save</button>
                      <button onClick={() => setIsEditing(false)} className="text-[9px] font-bold text-red-500 hover:text-red-700">Cancel</button>
                    </div>
                 )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {isEditing ? (
                   <textarea 
                    autoFocus
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="w-full h-full text-[11px] text-gray-700 bg-white border border-gray-200 rounded-lg p-2 focus:ring-1 focus:ring-black outline-none resize-none"
                   />
                ) : (
                   <p className="text-[11px] text-gray-600 leading-relaxed font-medium whitespace-pre-wrap">
                    {job.emailBody}
                   </p>
                )}
              </div>
            </div>
          </div>
        ) : job.status === 'analyzing' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-gray-100 border-t-black rounded-full animate-spin"></div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Generating Draft</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-50 rounded-xl">
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Awaiting Analysis</p>
          </div>
        )}
      </div>

      {job.status === 'completed' && !isEditing && (
        <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2">
          <button 
            onClick={openGmail} 
            className="flex-1 bg-black text-white py-2 rounded-full text-[11px] font-bold hover:bg-gray-800 transition shadow-sm active:scale-95"
          >
            Draft in Gmail
          </button>
          <button 
            onClick={copyToClipboard} 
            className="p-2 border border-gray-200 rounded-full hover:bg-gray-50 transition text-gray-400 hover:text-black active:scale-95"
            title="Copy"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default JobCard;
