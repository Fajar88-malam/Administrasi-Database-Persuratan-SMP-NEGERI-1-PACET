import React, { useState, useEffect } from 'react';
import { Menu, Plus, Cloud, CheckCircle2, RefreshCw, Wifi, Database } from 'lucide-react';
import { SchoolProfile } from '../../types';
import { initAuth } from '../../services/googleAuthService';
import { User } from 'firebase/auth';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCreateNewLetter: () => void;
  onToggleSidebarMobile: () => void;
  school: SchoolProfile;
  cloudSyncState?: 'connected' | 'connecting' | 'syncing' | 'offline';
  lastSyncTime?: Date | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onCreateNewLetter,
  onToggleSidebarMobile,
  school,
  cloudSyncState = 'connected',
  lastSyncTime
}) => {
  const [googleUser, setGoogleUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      user => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => unsubscribe();
  }, []);

  function getTabBreadcrumb(tab: string): string {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard & Statistik';
      case 'letters':
        return 'Buku Agenda Surat Keluar';
      case 'create_letter':
        return 'Formulir Pembuatan Surat';
      case 'students':
        return 'Database Master Siswa';
      case 'teachers':
        return 'Database Master Guru & GTK';
      case 'settings':
        return 'Pengaturan Profil & Kop Surat';
      case 'drive':
        return 'Google Drive & Docs Workspace';
      default:
        return 'Sistem Persuratan';
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 no-print">
      {/* Left: Mobile hamburger & breadcrumb trail */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebarMobile}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
          title="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb trail */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline font-medium text-slate-400">E-Surat</span>
          <span className="hidden sm:inline text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{getTabBreadcrumb(activeTab)}</span>
        </div>
      </div>

      {/* Right: Cloud Realtime Badge, Google Workspace, School Name & CTA */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Realtime Cloud Persistence Status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            cloudSyncState === 'connected'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : cloudSyncState === 'syncing'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : cloudSyncState === 'connecting'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
          title={
            lastSyncTime
              ? `Sinkronisasi Realtime Aktif. Terakhir diperbarui: ${lastSyncTime.toLocaleTimeString('id-ID')}`
              : 'Database Terhubung ke Cloud Firestore'
          }
        >
          {cloudSyncState === 'connected' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline font-semibold">Realtime Cloud Aktif</span>
              <span className="md:hidden">Sync</span>
            </>
          )}
          {cloudSyncState === 'syncing' && (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
              <span className="hidden md:inline font-semibold">Menyimpan ke Cloud...</span>
            </>
          )}
          {cloudSyncState === 'connecting' && (
            <>
              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
              <span className="hidden md:inline font-semibold">Menghubungkan Cloud...</span>
            </>
          )}
          {cloudSyncState === 'offline' && (
            <>
              <Database className="w-3 h-3 text-slate-500" />
              <span className="hidden md:inline font-semibold">Penyimpanan Lokal</span>
            </>
          )}
        </div>

        {/* Google Drive & Docs button */}
        <button
          onClick={() => onTabChange('drive')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            googleUser
              ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
          title={googleUser ? `Terhubung ke Google Drive (${googleUser.email})` : 'Hubungkan Google Drive & Docs'}
        >
          <Cloud className={`w-3.5 h-3.5 ${googleUser ? 'text-blue-600' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">
            {googleUser ? 'Drive Aktif' : 'Hubungkan Drive'}
          </span>
        </button>

        <span className="hidden xl:inline text-xs font-medium text-slate-500 max-w-[200px] truncate">
          {school.namaSekolah}
        </span>

        <button
          onClick={onCreateNewLetter}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Surat</span>
        </button>
      </div>
    </header>
  );
};
