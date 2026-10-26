import React from 'react';
import { AlertTriangle, Key, ExternalLink, Terminal, Copy, Check } from 'lucide-react';
import { SupabaseConfigStatus } from '../lib/supabase';

interface ConfigErrorProps {
  status: SupabaseConfigStatus;
}

export const ConfigError: React.FC<ConfigErrorProps> = ({ status }) => {
  const [copied, setCopied] = React.useState(false);

  const envSample = `VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sbp_xxxxxxxxxxxxxxx`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(envSample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Banner */}
        <div className="bg-amber-500 text-white p-6 sm:p-8 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-600/60 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Supabase Configuration Required
            </h1>
            <p className="text-amber-100 text-sm mt-1">
              Assignment Hub needs your Supabase project credentials to store assignments and files.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              Missing Environment Variables:
            </h2>
            <ul className="space-y-1.5">
              {status.missingVars.map((v) => (
                <li
                  key={v}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-mono text-xs font-semibold flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {v}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              How to configure locally:
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>
                Create a project on{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 font-semibold inline-flex items-center gap-1 hover:underline"
                >
                  Supabase <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Run the database migration found in{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">
                  supabase/setup.sql
                </code>{' '}
                inside the Supabase SQL Editor.
              </li>
              <li>
                Create a file named <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">.env.local</code> in the root folder with:
              </li>
            </ol>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto">
                {envSample}
              </pre>
              <button
                type="button"
                onClick={copyToClipboard}
                className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Note: In Vite, variables starting with <code>VITE_</code> are embedded into the client bundle at build time. Never place secret service-role keys in your frontend environment.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              Reload Page
            </button>
            <span className="text-xs text-slate-400">Assignment Hub v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

