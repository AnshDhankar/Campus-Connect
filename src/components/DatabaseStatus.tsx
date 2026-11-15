import React, { useState, useEffect } from 'react';
import { 
  Database, CheckCircle2, AlertTriangle, Clock, Server, Layers, 
  ShieldCheck, HelpCircle, Users, ClipboardCheck, ArrowLeft, 
  RefreshCw, Sparkles, BookOpen, Link, Check, Cpu
} from 'lucide-react';

interface DatabaseStatusProps {
  onBack?: () => void;
  isDarkMode: boolean;
  token?: string;
}

interface DBStats {
  mongodbUriConfigured: boolean;
  isMongoConnected: boolean;
  mode: string;
  lastConnectionTime: string | null;
  totalRecords: number;
  counts: {
    students: number;
    departments: number;
    complaints: number;
    helpRequests: number;
    staff: number;
  };
}

export default function DatabaseStatus({ onBack, isDarkMode, token }: DatabaseStatusProps) {
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [token]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/database-status', {
        headers
      });
      if (!res.ok) {
        throw new Error('Could not synchronize database status metrics.');
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch status.');
    } finally {
      setLoading(false);
    }
  };

  const copyConfigKey = () => {
    navigator.clipboard.writeText('MONGODB_URI');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 pb-16 ${
      isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Government/University Style Header */}
      <div className={`border-b border-slate-200 py-6 px-4 sm:px-6 lg:px-8 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white shadow-xs'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition mr-3"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}
              <span className="text-[10px] uppercase font-bold text-blue-900 tracking-wider">SYSTEM DIAGNOSTICS DECK</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Database className="w-6 h-6 text-blue-900" />
              <h1 className="text-2xl font-black">Active Database Ledger Status</h1>
            </div>
            <span className="text-xs text-slate-400 font-mono mt-1 block">
              Active Server Connection Logs • Direct Integrity Diagnostics
            </span>
          </div>

          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="py-2 px-4 bg-blue-900 text-white hover:bg-blue-805 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">

        {/* Loading State */}
        {loading && !stats && (
          <div className="py-24 text-center space-y-4">
            <RefreshCw className="w-12 h-12 text-blue-900 animate-spin mx-auto" />
            <p className="font-extrabold uppercase tracking-widest text-slate-400 text-xs">Querying Active Database Diagnostics...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border-2 border-rose-200 text-rose-800 text-sm font-bold flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div>
              <p className="text-sm">Database Diagnostics Query Error</p>
              <p className="text-xs font-mono font-medium">{error}</p>
            </div>
          </div>
        )}

        {stats && (
          <div className="space-y-8">
            
            {/* 1. Main Telemetry Block (Cards Grid) */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Database Type */}
              <div className={`p-5 border-y border-r border-l-4 rounded-sm shadow-xs flex flex-col justify-between h-36 ${
                stats.isMongoConnected ? 'border-emerald-500 border-slate-200' : 'border-amber-500 border-slate-200'
              } ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Database Type</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Server className="w-4 h-4 text-slate-500" />
                    <strong className="text-base font-black text-slate-900">
                      {stats.isMongoConnected ? 'MongoDB' : 'File Database'}
                    </strong>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono text-slate-500 leading-tight">
                  {stats.isMongoConnected ? 'Remote Document DB' : 'Structured JSON Ledger'}
                </span>
              </div>

              {/* Connection Status */}
              <div className={`p-5 border-y border-r border-l-4 rounded-sm shadow-xs flex flex-col justify-between h-36 ${
                stats.isMongoConnected ? 'border-emerald-500 border-slate-200' : 'border-amber-500 border-slate-200'
              } ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Connection Status</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`w-3 h-3 rounded-full ${stats.isMongoConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <strong className="text-base font-black text-slate-950 uppercase tracking-tight">
                      {stats.isMongoConnected ? 'CONNECTED' : 'LOCAL FALLBACK'}
                    </strong>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  {stats.isMongoConnected ? (
                    <span className="text-emerald-800 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Secure Atlas Link
                    </span>
                  ) : (
                    <span className="text-amber-800 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Local JSON Isolation
                    </span>
                  )}
                </div>
              </div>

              {/* Last Connection Time */}
              <div className={`p-5 border-y border-r border-l-4 border-blue-600 rounded-sm shadow-xs flex flex-col justify-between h-36 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Last Connection Time</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-4 h-4 text-blue-900" />
                    <span className="text-xs font-mono font-bold text-slate-800 tracking-tight">
                      {stats.lastConnectionTime ? new Date(stats.lastConnectionTime).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 overflow-x-auto truncate select-all block" title={stats.lastConnectionTime || ''}>
                  {stats.lastConnectionTime ? new Date(stats.lastConnectionTime).toLocaleDateString() : 'Attempt pending'}
                </span>
              </div>

              {/* Total Records */}
              <div className={`p-5 border-y border-r border-l-4 border-indigo-600 rounded-sm shadow-xs flex flex-col justify-between h-36 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Total Records</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-black text-indigo-700">{stats.totalRecords}</span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Entries</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  All system segments compiled
                </span>
              </div>

            </section>

            {/* 2. Connection Mode Banner */}
            <section className={`p-6 border rounded-sm ${
              stats.isMongoConnected 
                ? 'bg-emerald-50/70 border-emerald-250 text-slate-800' 
                : 'bg-amber-50/70 border-amber-250 text-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase bg-slate-900 text-white py-0.5 px-2 rounded-sm select-all">
                    LOG DATA SUMMARY
                  </span>
                  <h3 className="text-lg font-black mt-2">
                    Database Mode: <strong className="text-blue-900">{stats.mode}</strong>
                  </h3>
                  <p className="text-xs text-slate-600">
                    {stats.isMongoConnected 
                      ? 'The system has secured a live link to your MongoDB Atlas cloud document database cluster. Read/Write states are active, global, and highly persistent.' 
                      : 'The system did not detect MONGODB_URI or failed to connect to the cloud DB. Operating with a persistent Local JSON Fallback system located inside `.data/` directory to preserve all of your input changes.'}
                  </p>
                </div>
                {stats.isMongoConnected ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 flex-shrink-0 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-amber-605 text-amber-600 flex-shrink-0" />
                )}
              </div>
            </section>

            {/* 3. Detailed Records Counter Grid (NO MOCK DATA) */}
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-900" />
                Active Database Registry Counts
              </h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-slate-800">
                {/* Total Students */}
                <div className={`p-4 border rounded-sm bg-white border-slate-200 shadow-xs space-y-1`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] uppercase font-black font-mono tracking-wider">Students</span>
                    <Users className="w-4 h-4 text-blue-900" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.counts.students}</div>
                  <span className="text-[10px] text-slate-400 block font-mono">Registered Submitter Hub</span>
                </div>

                {/* Total Departments */}
                <div className={`p-4 border rounded-sm bg-white border-slate-200 shadow-xs space-y-1`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] uppercase font-black font-mono tracking-wider">Departments</span>
                    <BookOpen className="w-4 h-4 text-blue-900" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.counts.departments}</div>
                  <span className="text-[10px] text-slate-400 block font-mono">Configured Admin Cells</span>
                </div>

                {/* Total Complaints */}
                <div className={`p-4 border rounded-sm bg-white border-slate-200 shadow-xs space-y-1`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] uppercase font-black font-mono tracking-wider">Complaints</span>
                    <ClipboardCheck className="w-4 h-4 text-rose-800" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.counts.complaints}</div>
                  <span className="text-[10px] text-slate-400 block font-mono">Formal Grievance Logs</span>
                </div>

                {/* Total Help Requests */}
                <div className={`p-4 border rounded-sm bg-white border-slate-200 shadow-xs space-y-1`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] uppercase font-black font-mono tracking-wider">Help Requests</span>
                    <HelpCircle className="w-4 h-4 text-sky-800" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.counts.helpRequests}</div>
                  <span className="text-[10px] text-slate-400 block font-mono">Assistance Tickets</span>
                </div>

                {/* Total Staff */}
                <div className={`p-4 border rounded-sm bg-white border-slate-200 shadow-xs space-y-1`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] uppercase font-black font-mono tracking-wider">Officers Staff</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{stats.counts.staff}</div>
                  <span className="text-[10px] text-slate-400 block font-mono">Active Resolving Officers</span>
                </div>
              </div>
            </section>

            {/* 4. Steps to configure MongoDB Atlas (Mandatory / Tutorial Guideline) */}
            <section className="bg-white border-2 border-slate-950 p-6 shadow-md text-slate-800 space-y-5">
              <div className="flex items-center gap-2 border-b pb-3">
                <Cpu className="w-5 h-5 text-indigo-700" />
                <h2 className="text-sm font-black uppercase tracking-wide">How to Setup & Configure MongoDB Atlas</h2>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-normal">
                  Your CampusConnect application is dual-wired to toggle seamlessly. Follow these quick steps to deploy a cluster on MongoDB Atlas and paste your credentials:
                </p>

                <div className="grid md:grid-cols-3 gap-4 text-xs font-mono">
                  {/* Step 1 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                    <span className="inline-block px-2 py-0.5 bg-blue-900 text-white font-extrabold text-[10px] uppercase">STEP 1</span>
                    <h4 className="font-extrabold text-slate-900 font-sans">Deploy MongoDB Atlas Cluster</h4>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Create a free account on <a href="https://www.mongodb.com/cloud/atlas" target="_blank" rel="noreferrer" className="text-blue-900 underline font-bold">mongodb.com/atlas</a>. Click <strong>"Create Database"</strong> and choose the Shared Free tier. Select your preferred Cloud provider and region.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                    <span className="inline-block px-2 py-0.5 bg-blue-900 text-white font-extrabold text-[10px] uppercase">STEP 2</span>
                    <h4 className="font-extrabold text-slate-900 font-sans">Configure Network & Access</h4>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Under "Security" {"->"} "Database Access", create an admin user with a secure password. Under "Network Access", click <strong>"Add IP Address"</strong> and select <strong>"Allow Access from Anywhere (0.0.0.0/0)"</strong>.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
                    <span className="inline-block px-2 py-0.5 bg-blue-900 text-white font-extrabold text-[10px] uppercase">STEP 3</span>
                    <h4 className="font-extrabold text-slate-900 font-sans">Generate URI & Save Secrets</h4>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Click <strong>"Connect"</strong> {"->"} Choose <strong>"Drivers" (Node.js)</strong>. Copy the connection string. Replace <code>{"<password>"}</code> inside it with your database user password.
                    </p>
                  </div>
                </div>

                {/* Configuration Integration Details block */}
                <div className="bg-blue-50/50 p-4 border border-blue-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-mono text-slate-700">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-blue-900 block font-sans">VITE CONTAINER INTEGRATION KEYS</span>
                    <p className="font-bold text-slate-900">Configure key: <code className="bg-slate-200 px-1 text-rose-800">MONGODB_URI</code></p>
                    <p className="text-[11px] font-sans text-slate-500">Provide the generated connection URI in your environment configuration settings to auto-trigger the connection.</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyConfigKey}
                      className="py-1.5 px-3 bg-white border border-blue-200 hover:bg-white text-blue-900 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Link className="w-3 h-3" /> Copy ENV Key Name
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* DB URI connection string placeholder example */}
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto rounded-sm shadow-inner">
                  # Example Environment Entry (.env.example)
                  <br />
                  <span className="text-slate-450 text-slate-500"># Replace credentials with your database credentials</span>
                  <br />
                  MONGODB_URI=mongodb+srv://adminUser:securePassWord123@cluster0.abcde.mongodb.net/campusconnect?retryWrites=true&amp;w=majority
                </div>

              </div>
            </section>

          </div>
        )}

      </main>
    </div>
  );
}
