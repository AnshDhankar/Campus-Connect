import React, { useState, useEffect } from 'react';
import { Globe, MapPin, ExternalLink } from 'lucide-react';
import { Institution } from '../types';

interface InstitutionBannerProps {
  institutionId: string;
  token: string;
  isDarkMode?: boolean;
}

export function InstitutionBanner({ institutionId, token, isDarkMode = false }: InstitutionBannerProps) {
  const [inst, setInst] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInstDetails = async () => {
    if (!institutionId || institutionId === 'default') {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/institutions/${institutionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setInst(data);
      }
    } catch (err) {
      console.warn('Failed to fetch institution profile:', (err as any)?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstDetails();
    const interval = setInterval(fetchInstDetails, 8000); // Poll every 8 seconds for dynamic sync!
    return () => clearInterval(interval);
  }, [institutionId, token]);

  if (loading) {
    return (
      <div className={`p-4 border border-slate-200 animate-pulse flex items-center gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200'}`}>
        <div className="w-12 h-12 bg-slate-200 rounded-md"></div>
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-slate-200 w-1/3 rounded-sm"></div>
          <div className="h-3 bg-slate-200 w-1/4 rounded-sm"></div>
        </div>
      </div>
    );
  }

  // Fallback to default SVG if logo path is empty
  const activeLogo = inst?.logo || '/uploads/default-institution.svg';
  const displayWebsite = inst?.website ? (inst.website.startsWith('http') ? inst.website : `https://${inst.website}`) : '';

  return (
    <div className={`relative rounded-xl border shadow-xs overflow-hidden transition-colors ${
      isDarkMode 
        ? 'bg-charcoal-900 border-charcoal-800 text-slate-100' 
        : 'bg-white border-slate-250 text-navy-950'
    }`}>
      {/* Restrained top accent line */}
      <div className={`h-1 w-full ${isDarkMode ? 'bg-gold-500/80' : 'bg-navy-900'}`} />
      
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left min-w-0">
          {/* Logo container with fallback */}
          <div className={`w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 flex items-center justify-center p-2 rounded-lg border ${
            isDarkMode ? 'bg-charcoal-950 border-charcoal-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <img 
              src={activeLogo} 
              alt={inst?.name || 'Institution Logo'} 
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = '/uploads/default-institution.svg';
              }}
            />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className={`text-base font-bold tracking-tight truncate ${
                isDarkMode ? 'text-white' : 'text-navy-950'
              }`}>
                {inst?.name || 'Campus Partner Workspace'}
              </h2>
              {inst?.type && (
                <span className={`text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded uppercase font-mono ${
                  isDarkMode 
                    ? 'bg-charcoal-800 text-gold-300 border border-charcoal-700' 
                    : 'bg-navy-50 text-navy-800 border border-navy-100'
                }`}>
                  {inst.type}
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {displayWebsite && (
                <a 
                  href={displayWebsite} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center gap-1 font-medium transition-colors select-all ${
                    isDarkMode ? 'hover:text-gold-400' : 'hover:text-navy-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 opacity-70" />
                  <span className="truncate max-w-[200px]">{inst?.website?.replace(/^https?:\/\//i, '')}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                </a>
              )}
              
              {(inst?.city || inst?.country) && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 opacity-70" />
                  <span>
                    {[inst.city, inst.state, inst.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Status Display */}
        <div className="text-center sm:text-right flex flex-col items-center sm:items-end gap-1 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
            Institution Registry
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md font-mono ${
            isDarkMode 
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60' 
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            <span>Verified & Live</span>
          </span>
        </div>
      </div>
    </div>
  );
}
