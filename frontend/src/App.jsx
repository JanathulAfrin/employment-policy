import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, HelpCircle, GitCompare, ShieldCheck, 
  Activity, AlertCircle, RefreshCw, CheckCircle2, FileCode,
  Eye, X, Layers, Calendar, HardDrive, FileCheck, Loader2,
  Sparkles, ListChecks, UserCheck, Scale, AlertTriangle, Clock,
  CheckSquare, Ban, Info, ChevronRight, Send, MessageSquare,
  Trash2, FileSearch, Quote, User, Bot, PlusCircle, MinusCircle,
  ArrowRight, BarChart3, LayoutDashboard, Check
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiHealth, setApiHealth] = useState({ status: 'checking', message: 'Checking API status...' });
  
  // Real Backend Metrics State
  const [stats, setStats] = useState({
    policies_uploaded: 0,
    policies_processed: 0,
    summaries_generated: 0,
    questions_asked: 0
  });

  // Document Management States
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | success | error
  const [uploadStep, setUploadStep] = useState(1); // 1: Uploading | 2: Extracting | 3: Processing | 4: Ready
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Detail Inspector Modal State
  const [viewDocument, setViewDocument] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);

  // Summary State
  const [selectedSummaryDocId, setSelectedSummaryDocId] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // Ask Policy RAG Chat State
  const [selectedAskDocId, setSelectedAskDocId] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [askError, setAskError] = useState('');

  // Compare Policies State
  const [oldDocId, setOldDocId] = useState('');
  const [newDocId, setNewDocId] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparingPolicies, setComparingPolicies] = useState(false);
  const [compareError, setCompareError] = useState('');

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Check Backend Health & Fetch Live Stats
  const checkHealth = async () => {
    setApiHealth({ status: 'checking', message: 'Checking API status...' });
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setApiHealth({ status: 'online', message: data.message || 'API Connected' });
      } else {
        setApiHealth({ status: 'offline', message: `Server error (${res.status})` });
      }
    } catch (err) {
      setApiHealth({ status: 'offline', message: 'Backend unreachable. Make sure FastAPI server is running.' });
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  // Fetch Uploaded Policy Documents
  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0) {
          if (!selectedSummaryDocId) setSelectedSummaryDocId(data[0].id);
          if (!selectedAskDocId) setSelectedAskDocId(data[0].id);
          if (!oldDocId) setOldDocId(data[0].id);
          if (!newDocId && data.length > 1) setNewDocId(data[1].id);
          else if (!newDocId) setNewDocId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const refreshAll = () => {
    checkHealth();
    fetchStats();
    fetchDocuments();
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, askingQuestion]);

  // Format Bytes to Readable Size
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format Date String
  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Validate File Selection
  const handleFileSelection = (file) => {
    setErrorMessage('');
    setUploadResult(null);
    setUploadStatus('idle');

    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setErrorMessage('Only PDF (.pdf) and Word (.docx) policy files are supported.');
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setErrorMessage('Selected file is empty (0 bytes). Please select a valid policy document.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds maximum allowed limit of 15MB.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  // Upload File to Backend
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadStep(1);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setTimeout(() => setUploadStep(2), 600);
      setTimeout(() => setUploadStep(3), 1200);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadStep(4);
        setUploadStatus('success');
        setUploadResult(data);
        setSelectedFile(null);
        refreshAll();
        if (data.document?.id) {
          setSelectedSummaryDocId(data.document.id);
          setSelectedAskDocId(data.document.id);
        }
      } else {
        setUploadStatus('error');
        setErrorMessage(data.detail || 'Failed to process document.');
      }
    } catch (err) {
      setUploadStatus('error');
      setErrorMessage('Network error while uploading. Verify the FastAPI backend is running.');
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId, filename) => {
    if (!window.confirm(`Are you sure you want to delete policy document "${filename}"?`)) return;
    setDeletingDocId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        refreshAll();
        if (selectedSummaryDocId === docId) setSelectedSummaryDocId('');
        if (selectedAskDocId === docId) setSelectedAskDocId('');
        if (oldDocId === docId) setOldDocId('');
        if (newDocId === docId) setNewDocId('');
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    } finally {
      setDeletingDocId(null);
    }
  };

  // View Document Details Modal
  const handleViewDocument = async (docId) => {
    setLoadingDetail(true);
    setViewDocument(null);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setViewDocument(data);
      }
    } catch (err) {
      console.error("Failed to load document details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Generate Policy Summary via AI
  const handleGenerateSummary = async (docIdToUse) => {
    const targetDocId = docIdToUse || selectedSummaryDocId;
    if (!targetDocId) {
      setSummaryError('Please select or upload a policy document first.');
      return;
    }

    setGeneratingSummary(true);
    setSummaryError('');
    setSummaryData(null);

    try {
      const res = await fetch(`/api/documents/${targetDocId}/summary`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        setSummaryData(data.summary);
        fetchStats();
      } else {
        setSummaryError(data.detail || 'Failed to generate policy summary.');
      }
    } catch (err) {
      setSummaryError('Network error while communicating with backend AI summarizer service.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Ask Policy Q&A RAG Submission
  const handleAskQuestion = async (e) => {
    if (e) e.preventDefault();
    if (!questionInput.trim() || askingQuestion || !selectedAskDocId) return;

    const qText = questionInput.trim();
    setQuestionInput('');
    setAskError('');
    setAskingQuestion(true);

    try {
      const res = await fetch(`/api/documents/${selectedAskDocId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qText }),
      });

      const data = await res.json();

      if (res.ok) {
        const chatItem = {
          id: `qa_${Date.now()}`,
          question: qText,
          answer: data.answer,
          sources: data.sources || [],
          confidence: data.confidence || 'high',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatHistory((prev) => [...prev, chatItem]);
        fetchStats();
      } else {
        setAskError(data.detail || 'Failed to answer question.');
      }
    } catch (err) {
      setAskError('Network error connecting to backend RAG Q&A service.');
    } finally {
      setAskingQuestion(false);
    }
  };

  // Compare Policy Versions Submission
  const handleComparePolicies = async () => {
    if (!oldDocId || !newDocId) {
      setCompareError('Please select both an Old Policy and a New Policy to compare.');
      return;
    }

    if (oldDocId === newDocId) {
      setCompareError('Old and new policy documents must be different. Please select two distinct policy versions.');
      return;
    }

    setComparingPolicies(true);
    setCompareError('');
    setComparisonResult(null);

    try {
      const res = await fetch('/api/documents/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_document_id: oldDocId,
          new_document_id: newDocId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setComparisonResult(data);
      } else {
        setCompareError(data.detail || 'Failed to compare policy versions.');
      }
    } catch (err) {
      setCompareError('Network error connecting to backend policy comparison service.');
    } finally {
      setComparingPolicies(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Policy', icon: Upload },
    { id: 'summary', label: 'Policy Summary', icon: FileText },
    { id: 'ask', label: 'Ask Policy', icon: HelpCircle },
    { id: 'compare', label: 'Compare Policies', icon: GitCompare },
  ];

  const selectedDocObj = documents.find(d => d.id === selectedSummaryDocId);
  const selectedAskDocObj = documents.find(d => d.id === selectedAskDocId);
  const oldDocObj = documents.find(d => d.id === oldDocId);
  const newDocObj = documents.find(d => d.id === newDocId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Employment Policy Summarization Assistant
              </h1>
              <p className="text-xs text-slate-400 font-medium">Production Hackathon Build &bull; FastAPI + React + RAG</p>
            </div>
          </div>

          {/* Nav Links & Health Status */}
          <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
            <nav className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
              {navItems.map((nav) => {
                const NavIcon = nav.icon;
                const isActive = activeTab === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => setActiveTab(nav.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <NavIcon className="w-3.5 h-3.5" />
                    <span>{nav.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center space-x-2 text-xs flex-shrink-0">
              <div className={`flex items-center px-3 py-1.5 rounded-full border ${
                apiHealth.status === 'online'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : apiHealth.status === 'offline'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                <Activity className={`w-3.5 h-3.5 mr-1.5 ${apiHealth.status === 'checking' ? 'animate-spin' : ''}`} />
                <span className="font-medium">
                  {apiHealth.status === 'online' ? 'Backend API Ready' : 'Backend Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* TAB 0: MAIN DASHBOARD & STATS OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl p-8 sm:p-10 relative overflow-hidden shadow-xl">
              <div className="absolute -right-12 -top-12 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 max-w-3xl">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 mb-3">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Hackathon Production Release
                </span>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
                  Understand your workplace policy in seconds.
                </h2>
                <p className="mt-3 text-slate-400 text-base sm:text-lg leading-relaxed">
                  Upload employment policies (PDF/DOCX), generate structured summaries, ask verified RAG questions grounded strictly in document evidence, and track version changes.
                </p>
                
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-950/50 flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Policy Now</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('ask')}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition flex items-center space-x-2"
                  >
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    <span>Ask Policy Assistant</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Real Metrics Stat Cards (No Fake Statistics) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Policies Uploaded</p>
                  <p className="text-2xl font-extrabold text-slate-100 mt-0.5">{stats.policies_uploaded}</p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Policies Processed</p>
                  <p className="text-2xl font-extrabold text-slate-100 mt-0.5">{stats.policies_processed}</p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
                <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Summaries Generated</p>
                  <p className="text-2xl font-extrabold text-slate-100 mt-0.5">{stats.summaries_generated}</p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center space-x-4">
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Questions Asked</p>
                  <p className="text-2xl font-extrabold text-slate-100 mt-0.5">{stats.questions_asked}</p>
                </div>
              </div>
            </div>

            {/* Feature Access Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setActiveTab('upload')}
                className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-100">1. Upload Policy</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Upload PDF or DOCX documents with page and heading metadata retention.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition">
                  <span>Start Intake</span> &rarr;
                </div>
              </button>

              <button
                onClick={() => setActiveTab('summary')}
                className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-110 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-100">2. Policy Summary</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    View AI breakdowns across 10 structured sections with source page badges.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition">
                  <span>View Breakdown</span> &rarr;
                </div>
              </button>

              <button
                onClick={() => setActiveTab('ask')}
                className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-100">3. Ask Policy (RAG)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Ask natural language questions answered strictly using retrieved policy evidence.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition">
                  <span>Start Q&A</span> &rarr;
                </div>
              </button>

              <button
                onClick={() => setActiveTab('compare')}
                className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition">
                    <GitCompare className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-100">4. Compare Versions</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Compare Old vs New policy versions to track added, removed, and modified rules.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition">
                  <span>Compare Diffs</span> &rarr;
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: UPLOAD POLICY */}
        {activeTab === 'upload' && (
          <div className="flex flex-col gap-8">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Upload Policy Document</h3>
                  <p className="text-xs text-slate-400">Supported formats: PDF (.pdf) and Word (.docx) up to 15MB</p>
                </div>
              </div>

              {/* Dropzone Area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-indigo-500/50 hover:bg-slate-900/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => e.target.files && handleFileSelection(e.target.files[0])}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                  <FileCode className="w-7 h-7" />
                </div>
                <p className="text-slate-200 font-semibold text-base mb-1">
                  Drag and drop your policy file here, or <span className="text-indigo-400 underline decoration-indigo-400/50 underline-offset-4">browse</span>
                </p>
                <p className="text-slate-500 text-xs mt-1">PDF or DOCX files up to 15MB</p>
              </div>

              {selectedFile && uploadStatus !== 'uploading' && (
                <div className="mt-6 p-4 rounded-xl bg-slate-800/60 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-slate-700 text-indigo-300 rounded-lg">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">{formatBytes(selectedFile.size)} &bull; {selectedFile.name.split('.').pop().toUpperCase()}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-950/50 flex items-center justify-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Process Policy Document</span>
                  </button>
                </div>
              )}

              {/* Stage-by-stage Progress Loader */}
              {uploadStatus === 'uploading' && (
                <div className="mt-6 p-6 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-4">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
                    <p className="text-sm font-semibold text-indigo-200">Processing Employment Policy Document...</p>
                  </div>
                  
                  {/* Stages Bar */}
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                    <div className={`p-2 rounded border text-center ${uploadStep >= 1 ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-600 border-slate-800'}`}>
                      1. Uploading
                    </div>
                    <div className={`p-2 rounded border text-center ${uploadStep >= 2 ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-600 border-slate-800'}`}>
                      2. Extracting Text
                    </div>
                    <div className={`p-2 rounded border text-center ${uploadStep >= 3 ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-600 border-slate-800'}`}>
                      3. Chunking
                    </div>
                    <div className={`p-2 rounded border text-center ${uploadStep >= 4 ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-600 border-slate-800'}`}>
                      4. Ready
                    </div>
                  </div>
                </div>
              )}

              {uploadStatus === 'success' && uploadResult && (
                <div className="mt-6 p-6 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <h4 className="font-bold text-base text-emerald-100">{uploadResult.message}</h4>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setActiveTab('summary');
                          handleGenerateSummary(uploadResult.document.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition flex items-center space-x-1 shadow"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Summarize</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAskDocId(uploadResult.document.id);
                          setActiveTab('ask');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center space-x-1 shadow"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Ask Policy</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-emerald-500/20">
                    <div>
                      <span className="text-emerald-400/70 block font-medium">Document Name</span>
                      <span className="font-semibold text-emerald-100 truncate block">{uploadResult.document.filename}</span>
                    </div>
                    <div>
                      <span className="text-emerald-400/70 block font-medium">Format</span>
                      <span className="font-semibold uppercase text-emerald-100">{uploadResult.document.file_type}</span>
                    </div>
                    <div>
                      <span className="text-emerald-400/70 block font-medium">Structure</span>
                      <span className="font-semibold text-emerald-100">
                        {uploadResult.document.file_type === 'pdf'
                          ? `${uploadResult.document.page_count} Pages`
                          : `${uploadResult.document.section_count} Sections`}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-400/70 block font-medium">RAG Chunks</span>
                      <span className="font-semibold text-emerald-100">{uploadResult.document.chunk_count} Chunks</span>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-6 p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-start space-x-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-200">Processing Error</p>
                    <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Uploaded Repository List */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Uploaded Policy Repository</h3>
                    <p className="text-xs text-slate-400">Processed employment policies ready for summarization and grounding</p>
                  </div>
                </div>
                <button
                  onClick={refreshAll}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                  title="Refresh Repository"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDocs ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No policies uploaded yet.</p>
                  <p className="text-xs text-slate-500">Upload your first employment policy document to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Document Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-4">Chunks</th>
                        <th className="py-3 px-4">Upload Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-medium text-slate-100 flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            <span className="truncate max-w-xs">{doc.filename}</span>
                          </td>
                          <td className="py-3.5 px-4 uppercase font-semibold text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                              {doc.file_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">{formatBytes(doc.file_size)}</td>
                          <td className="py-3.5 px-4 font-mono text-indigo-300">{doc.chunk_count}</td>
                          <td className="py-3.5 px-4 text-slate-400">{formatDate(doc.upload_timestamp)}</td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  setSelectedAskDocId(doc.id);
                                  setActiveTab('ask');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/30 transition flex items-center space-x-1"
                                title="Ask Policy"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Ask</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSummaryDocId(doc.id);
                                  setActiveTab('summary');
                                  handleGenerateSummary(doc.id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/30 transition flex items-center space-x-1"
                                title="View Summary"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Summary</span>
                              </button>
                              <button
                                onClick={() => handleViewDocument(doc.id)}
                                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                                title="Inspect Metadata"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                disabled={deletingDocId === doc.id}
                                className="p-1 rounded-lg bg-slate-800/80 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                title="Delete Policy Document"
                              >
                                {deletingDocId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: POLICY SUMMARY */}
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Employment Policy Summarizer</span>
                </div>
                <h3 className="text-xl font-bold text-slate-100">Generate Structured Policy Breakdown</h3>
                <p className="text-xs text-slate-400">
                  Select an uploaded policy document to interpret formal rules, employee responsibilities, eligibility requirements, and deadlines with source citations.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <select
                  value={selectedSummaryDocId}
                  onChange={(e) => setSelectedSummaryDocId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 max-w-xs"
                >
                  {documents.length === 0 ? (
                    <option value="">No documents uploaded</option>
                  ) : (
                    documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.filename} ({d.file_type.toUpperCase()})
                      </option>
                    ))
                  )}
                </select>

                <button
                  onClick={() => handleGenerateSummary()}
                  disabled={generatingSummary || !selectedSummaryDocId}
                  className={`px-6 py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 shadow-lg ${
                    generatingSummary || !selectedSummaryDocId
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-950/50'
                  }`}
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Summary...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Policy Summary</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {summaryError && (
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-start space-x-3 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Summarization Error</p>
                  <p className="text-xs text-rose-300/90 mt-0.5">{summaryError}</p>
                </div>
              </div>
            )}

            {generatingSummary && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-lg space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-100">Analyzing Employment Policy...</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Translating formal policy terms into employee-friendly sections and verifying page citations...
                  </p>
                </div>
              </div>
            )}

            {!generatingSummary && !summaryData && !summaryError && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center min-h-[300px] flex flex-col items-center justify-center shadow-lg">
                <Sparkles className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-base font-semibold text-slate-300">Ready to Generate Policy Summary</p>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Select an uploaded employment policy from the dropdown above and click <strong>Generate Policy Summary</strong>.
                </p>
              </div>
            )}

            {!generatingSummary && summaryData && (
              <div className="space-y-6">
                <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-indigo-200">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold">Showing Summary for: {selectedDocObj?.filename || 'Uploaded Document'}</span>
                  </div>
                  <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-md font-mono border border-indigo-500/30">
                    Grounded AI Analysis • Metadata Intact
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                      <Info className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-100">Policy Overview</h4>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{summaryData.policy_overview || 'No overview provided.'}</p>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-100">Who It Applies To</h4>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{summaryData.applies_to || 'Applies to all covered employees.'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SummaryListCard
                    title="Key Rules & Requirements"
                    icon={ListChecks}
                    iconColor="text-indigo-400"
                    iconBg="bg-indigo-500/10"
                    items={summaryData.key_rules}
                    emptyText="No specific key rules identified."
                  />
                  <SummaryListCard
                    title="Eligibility & Conditions"
                    icon={Scale}
                    iconColor="text-emerald-400"
                    iconBg="bg-emerald-500/10"
                    items={summaryData.eligibility_conditions}
                    emptyText="No specific eligibility conditions listed."
                  />
                  <SummaryListCard
                    title="Employee Responsibilities"
                    icon={CheckSquare}
                    iconColor="text-amber-400"
                    iconBg="bg-amber-500/10"
                    items={summaryData.employee_responsibilities}
                    emptyText="No specific employee responsibilities outlined."
                  />
                  <SummaryListCard
                    title="Exceptions & Special Cases"
                    icon={Info}
                    iconColor="text-purple-400"
                    iconBg="bg-purple-500/10"
                    items={summaryData.exceptions}
                    emptyText="No explicit policy exceptions stated."
                  />
                  <SummaryListCard
                    title="Important Dates & Quantitative Limits"
                    icon={Clock}
                    iconColor="text-cyan-400"
                    iconBg="bg-cyan-500/10"
                    items={summaryData.important_dates_limits}
                    emptyText="No specific dates or numerical limits found."
                  />
                  <SummaryListCard
                    title="Required Actions & Procedures"
                    icon={ChevronRight}
                    iconColor="text-teal-400"
                    iconBg="bg-teal-500/10"
                    items={summaryData.required_actions}
                    emptyText="No required action steps detailed."
                  />
                  <SummaryListCard
                    title="Restrictions & Prohibitions"
                    icon={Ban}
                    iconColor="text-rose-400"
                    iconBg="bg-rose-500/10"
                    items={summaryData.restrictions}
                    emptyText="No prohibitions or restrictions listed."
                  />
                  <SummaryListCard
                    title="Ambiguities & Policy Flags"
                    icon={AlertTriangle}
                    iconColor="text-amber-400"
                    iconBg="bg-amber-500/10"
                    items={summaryData.warnings}
                    emptyText="No policy ambiguities or missing details flagged."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ASK POLICY (Grounded RAG Chat) */}
        {activeTab === 'ask' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Ask Policy Assistant</h3>
                  <p className="text-xs text-slate-400">Answers are grounded strictly in the selected policy evidence</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Policy</label>
                  <select
                    value={selectedAskDocId}
                    onChange={(e) => {
                      setSelectedAskDocId(e.target.value);
                      setChatHistory([]);
                    }}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
                  >
                    {documents.length === 0 ? (
                      <option value="">No documents uploaded</option>
                    ) : (
                      documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} ({d.file_type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {chatHistory.length > 0 && (
                  <button
                    onClick={() => setChatHistory([])}
                    className="mt-4 sm:mt-0 p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700/80 transition flex items-center space-x-1.5 text-xs font-medium"
                    title="Clear Chat Session"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear Chat</span>
                  </button>
                )}
              </div>
            </div>

            {/* Trust Indicator Banner */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 px-4 flex items-center space-x-2 text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span><strong>Trust Indicator:</strong> Answer generated strictly from your uploaded policy evidence. Zero external knowledge or invented rules.</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 min-h-[480px] flex flex-col justify-between shadow-lg">
              <div className="space-y-6 flex-1 overflow-y-auto pr-1 max-h-[600px] mb-4">
                {chatHistory.length === 0 ? (
                  <div className="h-full py-16 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-200">Ask any question about "{selectedAskDocObj?.filename || 'this policy'}"</h4>
                      <p className="text-xs text-slate-500 max-w-md mt-1">
                        Example questions: <em>"How many days of leave am I entitled to?"</em> or <em>"What is the procedure for remote work approval?"</em>
                      </p>
                    </div>
                  </div>
                ) : (
                  chatHistory.map((item) => (
                    <div key={item.id} className="space-y-4">
                      <div className="flex justify-end">
                        <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-2xl text-xs leading-relaxed shadow-md flex items-start space-x-2">
                          <span>{item.question}</span>
                          <User className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-80" />
                        </div>
                      </div>

                      <div className="flex justify-start">
                        <div className="bg-slate-950 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-none p-5 max-w-3xl text-xs space-y-4 shadow-md">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div className="flex items-center space-x-2">
                              <Bot className="w-4 h-4 text-emerald-400" />
                              <span className="font-bold text-slate-100 text-xs">Policy Assistant Response</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              item.confidence === 'high'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : item.confidence === 'medium'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              Confidence: {item.confidence.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-slate-200 text-xs leading-relaxed font-sans font-medium">
                            {item.answer}
                          </p>

                          {item.sources && item.sources.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80 space-y-2">
                              <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] font-bold">
                                <FileSearch className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Policy Evidence & Citations</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.sources.map((src, idx) => (
                                  <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 hover:border-indigo-500/40 transition">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-indigo-300">
                                      <div className="flex items-center space-x-1">
                                        {src.page && <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">Page {src.page}</span>}
                                        {src.section && <span className="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded truncate max-w-[140px]">§ {src.section}</span>}
                                      </div>
                                    </div>
                                    <p className="text-slate-300 text-[11px] leading-relaxed italic line-clamp-3">
                                      "{src.text}"
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {askingQuestion && (
                  <div className="flex justify-start">
                    <div className="bg-slate-950 border border-slate-800 text-slate-400 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span>Searching policy evidence & synthesizing grounded answer...</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {askError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{askError}</span>
                </div>
              )}

              <form onSubmit={handleAskQuestion} className="flex items-center gap-2">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={
                    documents.length === 0
                      ? "Upload a policy document to ask questions..."
                      : `Ask a question about ${selectedAskDocObj?.filename || 'this policy'}...`
                  }
                  disabled={askingQuestion || documents.length === 0}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={askingQuestion || !questionInput.trim() || documents.length === 0}
                  className={`px-5 py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1.5 shadow ${
                    askingQuestion || !questionInput.trim() || documents.length === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-950/40'
                  }`}
                >
                  {askingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span className="hidden sm:inline">Ask Policy</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: COMPARE POLICIES */}
        {activeTab === 'compare' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-md">
                <div className="flex items-center space-x-2 text-purple-400 text-xs font-semibold uppercase tracking-wider">
                  <GitCompare className="w-4 h-4" />
                  <span>Policy Version Comparison</span>
                </div>
                <h3 className="text-xl font-bold text-slate-100">Compare Employment Policies</h3>
                <p className="text-xs text-slate-400">
                  Select two uploaded policy versions to analyze added, removed, modified, and conflicting rules with source citations.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Old Policy Version</label>
                  <select
                    value={oldDocId}
                    onChange={(e) => setOldDocId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500 w-full sm:w-48"
                  >
                    {documents.length === 0 ? (
                      <option value="">No documents uploaded</option>
                    ) : (
                      documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} ({d.file_type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="hidden sm:flex items-center justify-center pt-4 text-slate-600">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">New Policy Version</label>
                  <select
                    value={newDocId}
                    onChange={(e) => setNewDocId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500 w-full sm:w-48"
                  >
                    {documents.length === 0 ? (
                      <option value="">No documents uploaded</option>
                    ) : (
                      documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} ({d.file_type.toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleComparePolicies}
                    disabled={comparingPolicies || documents.length < 2 || oldDocId === newDocId}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 shadow-lg ${
                      comparingPolicies || documents.length < 2 || oldDocId === newDocId
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950/50'
                    }`}
                  >
                    {comparingPolicies ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Comparing...</span>
                      </>
                    ) : (
                      <>
                        <GitCompare className="w-4 h-4" />
                        <span>Compare Policies</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {compareError && (
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 flex items-start space-x-3 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Comparison Error</p>
                  <p className="text-xs text-rose-300/90 mt-0.5">{compareError}</p>
                </div>
              </div>
            )}

            {comparingPolicies && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-lg space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-100">Comparing Policy Versions...</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Analyzing section-by-section differences between "{oldDocObj?.filename}" and "{newDocObj?.filename}"...
                  </p>
                </div>
              </div>
            )}

            {!comparingPolicies && !comparisonResult && !compareError && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center min-h-[300px] flex flex-col items-center justify-center shadow-lg">
                <GitCompare className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-base font-semibold text-slate-300">Ready to Compare Policy Versions</p>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Select two distinct uploaded policy documents from the dropdowns above and click <strong>Compare Policies</strong>.
                </p>
              </div>
            )}

            {!comparingPolicies && comparisonResult && (
              <div className="space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-2">
                  <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>Comparison Overview</span>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed font-sans">
                    {comparisonResult.comparison?.summary || "Policy version comparison completed successfully."}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <span><strong>Old:</strong> {comparisonResult.old_document?.filename}</span>
                    <span>&rarr;</span>
                    <span><strong>New:</strong> {comparisonResult.new_document?.filename}</span>
                  </div>
                </div>

                <DiffCategorySection
                  title="Important Policy Changes"
                  icon={Sparkles}
                  color="text-amber-400"
                  bg="bg-amber-500/10"
                  border="border-amber-500/30"
                  items={comparisonResult.comparison?.important_changes}
                  emptyText="No major policy changes detected."
                />

                <DiffCategorySection
                  title="Added Provisions (+)"
                  icon={PlusCircle}
                  color="text-emerald-400"
                  bg="bg-emerald-500/10"
                  border="border-emerald-500/30"
                  items={comparisonResult.comparison?.added}
                  emptyText="No newly added policy provisions."
                />

                <DiffCategorySection
                  title="Removed Provisions (-)"
                  icon={MinusCircle}
                  color="text-rose-400"
                  bg="bg-rose-500/10"
                  border="border-rose-500/30"
                  items={comparisonResult.comparison?.removed}
                  emptyText="No policy provisions removed."
                />

                <DiffCategorySection
                  title="Modified Provisions (↻)"
                  icon={RefreshCw}
                  color="text-indigo-400"
                  bg="bg-indigo-500/10"
                  border="border-indigo-500/30"
                  items={comparisonResult.comparison?.modified}
                  emptyText="No modified policy provisions."
                />

                <DiffCategorySection
                  title="Conflicting Provisions (⚠)"
                  icon={AlertTriangle}
                  color="text-amber-400"
                  bg="bg-amber-500/10"
                  border="border-amber-500/30"
                  items={comparisonResult.comparison?.conflicts}
                  emptyText="No contradictory or conflicting provisions detected."
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Inspect Document Metadata Modal */}
      {(viewDocument || loadingDetail) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {loadingDetail ? 'Loading Details...' : viewDocument?.filename}
                  </h3>
                  <p className="text-xs text-slate-400">Document ID: {viewDocument?.id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewDocument(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {loadingDetail ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                  <p>Loading document metadata...</p>
                </div>
              ) : viewDocument ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-500 block font-medium">Format</span>
                      <span className="font-semibold uppercase text-slate-200">{viewDocument.file_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">File Size</span>
                      <span className="font-semibold text-slate-200">{formatBytes(viewDocument.file_size)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Extracted Count</span>
                      <span className="font-semibold text-slate-200">
                        {viewDocument.file_type === 'pdf' ? `${viewDocument.page_count} Pages` : `${viewDocument.section_count} Sections`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">RAG Chunks</span>
                      <span className="font-semibold text-indigo-300 font-mono">{viewDocument.chunks?.length || 0} Chunks</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-200 text-sm mb-3 flex items-center justify-between">
                      <span>RAG Chunks Preview (Metadata Intact)</span>
                      <span className="text-xs font-normal text-slate-500">Showing first {Math.min(5, viewDocument.chunks?.length || 0)} chunks</span>
                    </h4>
                    <div className="space-y-3">
                      {viewDocument.chunks?.slice(0, 5).map((c, i) => (
                        <div key={c.chunk_id || i} className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                            <span className="font-mono text-indigo-400 font-medium">{c.chunk_id}</span>
                            <div className="flex items-center space-x-2">
                              {c.page_number && (
                                <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                                  Page {c.page_number}
                                </span>
                              )}
                              {c.section_heading && (
                                <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded">
                                  Section: {c.section_heading}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-300 leading-relaxed font-sans">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-right">
              <button
                onClick={() => setViewDocument(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 px-4 text-center text-xs text-slate-500">
        Employment Policy Summarization Assistant &bull; Hackathon Production Release &bull; FastAPI + React + RAG Engine
      </footer>
    </div>
  );
}

// Reusable Summary Item List Component with Citation Pills
function SummaryListCard({ title, icon: Icon, iconColor, iconBg, items, emptyText }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col">
      <div className="flex items-center space-x-3 mb-4">
        <div className={`p-2 ${iconBg} ${iconColor} rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        <h4 className="text-base font-bold text-slate-100">{title}</h4>
      </div>

      {!items || items.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2">{emptyText}</p>
      ) : (
        <ul className="space-y-3 text-xs flex-1">
          {items.map((item, idx) => {
            const isObj = typeof item === 'object' && item !== null;
            const textStr = isObj ? item.text : item;
            const page = isObj ? item.page : null;
            const section = isObj ? item.section : null;

            return (
              <li key={idx} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                <p className="text-slate-200 leading-relaxed font-sans">{textStr}</p>
                
                {(page || section) && (
                  <div className="flex items-center space-x-2 pt-1">
                    {page && (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono">
                        Page {page}
                      </span>
                    )}
                    {section && (
                      <span className="bg-indigo-950/70 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded text-[10px] font-mono truncate max-w-[200px]">
                        Section: {section}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Reusable Visual Policy Diff Category Card
function DiffCategorySection({ title, icon: Icon, color, bg, border, items, emptyText }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex items-center space-x-3">
        <div className={`p-2 ${bg} ${color} rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        <h4 className="text-base font-bold text-slate-100">{title}</h4>
      </div>

      {!items || items.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl bg-slate-950/60 border ${border} space-y-3 text-xs`}>
              <p className="font-semibold text-slate-100 text-xs">{item.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-rose-400">Old Policy</span>
                    <div className="flex space-x-1">
                      {item.old_page && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Page {item.old_page}</span>}
                      {item.old_section && <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[120px]">§ {item.old_section}</span>}
                    </div>
                  </div>
                  <p className="text-slate-300 leading-relaxed italic text-[11px]">
                    {item.old_text ? `"${item.old_text}"` : <span className="text-slate-500 not-italic">(Not present in old policy)</span>}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-emerald-400">New Policy</span>
                    <div className="flex space-x-1">
                      {item.new_page && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Page {item.new_page}</span>}
                      {item.new_section && <span className="bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded truncate max-w-[120px]">§ {item.new_section}</span>}
                    </div>
                  </div>
                  <p className="text-slate-300 leading-relaxed italic text-[11px]">
                    {item.new_text ? `"${item.new_text}"` : <span className="text-slate-500 not-italic">(Removed from new policy)</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
