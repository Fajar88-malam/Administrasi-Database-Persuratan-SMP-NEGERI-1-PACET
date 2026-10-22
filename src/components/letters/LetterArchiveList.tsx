/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { LetterRecord, LetterType, SchoolProfile, PaperSize } from '../../types';
import { getLetterTypeName, formatTanggalIndonesia, exportToCsv, triggerPrintWithPaperSize } from '../../utils/formatters';
import {
  Search,
  Plus,
  Printer,
  Edit3,
  Copy,
  Trash2,
  FileSpreadsheet,
  Eye,
  CheckCircle2,
  Clock,
  Send,
  X,
  FileText,
  AlertTriangle,
  Layers,
  Cloud
} from 'lucide-react';
import { LetterDocumentView } from './LetterDocumentView';
import { ExportToDocsModal } from '../drive/ExportToDocsModal';

interface LetterArchiveListProps {
  letters: LetterRecord[];
  school: SchoolProfile;
  onCreateNew: (type?: LetterType) => void;
  onEdit: (letter: LetterRecord) => void;
  onDuplicate: (letter: LetterRecord) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onClearAll?: () => void;
  onStatusChange: (id: string, newStatus: LetterRecord['status']) => void;
}

export const LetterArchiveList: React.FC<LetterArchiveListProps> = ({
  letters,
  school,
  onCreateNew,
  onEdit,
  onDuplicate,
  onDelete,
  onDeleteMultiple,
  onClearAll,
  onStatusChange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [previewingLetter, setPreviewingLetter] = useState<LetterRecord | null>(null);

  // Selection state for batch deletion
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Paper Size & Multi-sheet Mutasi settings for Print & Preview
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [hideHeader, setHideHeader] = useState<boolean>(false);
  const [mutasiSheetView, setMutasiSheetView] = useState<'ALL' | 'LEMBAR_1' | 'LEMBAR_2'>('ALL');
  const [exportDocsLetter, setExportDocsLetter] = useState<LetterRecord | null>(null);

  // Filtered letters
  const filteredLetters = useMemo(() => {
    return letters.filter(item => {
      // Type filter
      if (selectedTypeFilter !== 'ALL' && item.jenisSurat !== selectedTypeFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNomor = item.nomorSurat.toLowerCase().includes(q);
        const matchesPerihal = item.perihal.toLowerCase().includes(q);
        const matchesPenerima = item.kepadaYth.toLowerCase().includes(q);
        return matchesNomor || matchesPerihal || matchesPenerima;
      }
      return true;
    });
  }, [letters, selectedTypeFilter, selectedStatusFilter, searchQuery]);

  // Checkbox toggle helpers
  const allFilteredSelected =
    filteredLetters.length > 0 &&
    filteredLetters.every(l => selectedIds.includes(l.id));

  function handleToggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLetters.map(l => l.id));
    }
  }

  function handleToggleSelectOne(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }

  function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    if (
      window.confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} surat terpilih dari buku agenda?`
      )
    ) {
      if (onDeleteMultiple) {
        onDeleteMultiple(selectedIds);
      } else {
        selectedIds.forEach(id => onDelete(id));
      }
      setSelectedIds([]);
    }
  }

  function handleClearAllLetters() {
    if (letters.length === 0) return;
    if (
      window.confirm(
        'PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data agenda surat keluar? Semua arsip persuratan akan dikosongkan.'
      )
    ) {
      if (onClearAll) {
        onClearAll();
      } else {
        letters.forEach(l => onDelete(l.id));
      }
      setSelectedIds([]);
    }
  }

  function handleExportCsv() {
    const exportData = filteredLetters.map(l => ({
      'No. Urut': l.nomorUrut,
      'Nomor Surat': l.nomorSurat,
      'Jenis Surat': getLetterTypeName(l.jenisSurat),
      'Tanggal Surat': l.tanggalSurat,
      'Perihal': l.perihal,
      'Penerima': l.kepadaYth,
      'Sifat': l.sifat,
      'Penandatangan': l.penandatanganNama,
      'Status': l.status
    }));
    const today = new Date().toISOString().split('T')[0];
    exportToCsv(`buku_agenda_surat_keluar_${today}.csv`, exportData);
  }

  function handlePrintCurrentPreview() {
    if (!previewingLetter) return;
    onStatusChange(previewingLetter.id, 'Dicetak');
    triggerPrintWithPaperSize(paperSize);
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Buku Agenda Surat Keluar</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Database arsip resmi persuratan dinas {school.namaSekolah} · Total {letters.length} surat teregistrasi
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Tombol Hapus Semua Agenda Surat */}
          <button
            onClick={handleClearAllLetters}
            disabled={letters.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-40 transition-colors shadow-2xs"
            title="Kosongkan seluruh data buku agenda surat"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Hapus Semua Agenda</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            title="Ekspor buku agenda ke format CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => onCreateNew()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Surat Baru</span>
          </button>
        </div>
      </div>

      {/* Batch Deletion Alert Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{selectedIds.length} surat dipilih dari buku agenda</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-rose-100 rounded-lg font-medium transition-colors"
            >
              Batalkan Pilihan
            </button>
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedIds.length} Surat Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nomor surat, perihal, atau tujuan penerima..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Type Filter Select */}
          <div className="w-full md:w-auto flex items-center gap-2">
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="w-full md:w-48 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-700"
            >
              <option value="ALL">Semua Jenis Surat</option>
              <option value="SURAT_TUGAS">Surat Tugas</option>
              <option value="SURAT_PENGANTAR">Surat Pengantar</option>
              <option value="SURAT_PANGGILAN_ORTU">Panggilan Orang Tua</option>
              <option value="SURAT_UNDANGAN_ORTU">Undangan Orang Tua</option>
              <option value="SURAT_MUTASI_KELUAR">Mutasi Keluar Siswa</option>
              <option value="SURAT_MUTASI_MASUK">Mutasi Masuk Siswa</option>
              <option value="SURAT_KETERANGAN_AKTIF">Keterangan Siswa</option>
            </select>

            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full md:w-36 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              <option value="Diterbitkan">Diterbitkan</option>
              <option value="Draft">Draft</option>
              <option value="Dicetak">Dicetak</option>
            </select>
          </div>
        </div>

        {/* Quick Type Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'SURAT_TUGAS', label: 'Surat Tugas' },
            { id: 'SURAT_PENGANTAR', label: 'Surat Pengantar' },
            { id: 'SURAT_PANGGILAN_ORTU', label: 'Panggilan Ortu' },
            { id: 'SURAT_UNDANGAN_ORTU', label: 'Undangan Ortu' },
            { id: 'SURAT_MUTASI_KELUAR', label: 'Mutasi Keluar' },
            { id: 'SURAT_MUTASI_MASUK', label: 'Mutasi Masuk' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                selectedTypeFilter === tab.id
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* High-Density Archive Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                    title="Pilih Semua Surat"
                  />
                </th>
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th className="py-3 px-4 w-52">Nomor Surat</th>
                <th className="py-3 px-4 w-44">Jenis Surat</th>
                <th className="py-3 px-4">Perihal & Tujuan Penerima</th>
                <th className="py-3 px-4 w-28 text-center">Tanggal</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-36 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLetters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-medium text-slate-600">Tidak ada arsip surat yang sesuai kriteria.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Gunakan tombol "Buat Surat Baru" untuk mencatat persuratan dinas pertama Anda.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLetters.map(letter => {
                  const isChecked = selectedIds.includes(letter.id);
                  return (
                    <tr
                      key={letter.id}
                      className={`hover:bg-slate-50/80 transition-colors group cursor-default ${
                        isChecked ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(letter.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-slate-400">
                        {letter.nomorUrut}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {letter.nomorSurat}
                        </div>
                        <div className="text-[10px] text-slate-400">Kode: {letter.kodeKlasifikasi}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">
                          {getLetterTypeName(letter.jenisSurat)}
                        </span>
                        <div className="text-[10px] text-slate-400">Sifat: {letter.sifat}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <div className="font-semibold text-slate-900 truncate" title={letter.perihal}>
                          {letter.perihal}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={letter.kepadaYth}>
                          Yth. {letter.kepadaYth}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap tabular-nums text-slate-600">
                        {formatTanggalIndonesia(letter.tanggalSurat)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            letter.status === 'Diterbitkan'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : letter.status === 'Dicetak'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {letter.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setPreviewingLetter(letter);
                              setMutasiSheetView('ALL');
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Pratinjau & Cetak Dokumen"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEdit(letter)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Edit Surat"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDuplicate(letter)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Duplikasi Surat dengan Nomor Baru"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setExportDocsLetter(letter)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Ekspor ke Google Docs"
                          >
                            <Cloud className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus surat nomor "${letter.nomorSurat}" dari buku agenda?`)) {
                                onDelete(letter.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Hapus Surat dari Agenda"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL PREVIEW & CETAK DENGAN PILIHAN UKURAN KERTAS A4 / F4 */}
      {/* ========================================================= */}
      {previewingLetter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Header Toolbar (Hidden saat pencetakan) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 gap-3 no-print">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Pratinjau Surat: {previewingLetter.nomorSurat}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                    {paperSize}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {getLetterTypeName(previewingLetter.jenisSurat)} · {school.namaSekolah}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Pilihan Jenis Kertas: A4 vs F4 (Folio) */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPaperSize('A4')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      paperSize === 'A4'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kertas A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('F4')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      paperSize === 'F4'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kertas F4 (Folio)
                  </button>
                </div>

                {/* Opsi Hilangkan Header / Kop Surat (misal cetak di kertas blanko berkop cetak) */}
                <button
                  type="button"
                  onClick={() => setHideHeader(prev => !prev)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                    hideHeader
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Hilangkan Kop Surat (Berguna jika mencetak pada kertas yang sudah tercetak kop surat percetakan)"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" style={{ display: hideHeader ? 'inline-block' : 'none' }} />
                  <span>{hideHeader ? 'Header: Sembunyi' : 'Header: Aktif'}</span>
                </button>

                {/* Khusus Surat Mutasi Keluar: Selector Lembar Cetak */}
                {previewingLetter.jenisSurat === 'SURAT_MUTASI_KELUAR' && (
                  <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setMutasiSheetView('ALL')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        mutasiSheetView === 'ALL'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-indigo-800 hover:bg-indigo-100'
                      }`}
                      title="Cetak Paket Lengkap: Surat Sekolah & Permohonan Orang Tua"
                    >
                      Semua Lembar
                    </button>
                    <button
                      type="button"
                      onClick={() => setMutasiSheetView('LEMBAR_1')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        mutasiSheetView === 'LEMBAR_1'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-indigo-800 hover:bg-indigo-100'
                      }`}
                      title="Hanya Lembar 1: Surat Keterangan Pindah dari Sekolah"
                    >
                      Lembar 1 (Sekolah)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMutasiSheetView('LEMBAR_2')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        mutasiSheetView === 'LEMBAR_2'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-indigo-800 hover:bg-indigo-100'
                      }`}
                      title="Hanya Lembar 2: Surat Permohonan dari Orang Tua / Wali Siswa"
                    >
                      Lembar 2 (Ortu)
                    </button>
                  </div>
                )}

                {/* Tombol Ekspor ke Google Docs */}
                <button
                  type="button"
                  onClick={() => setExportDocsLetter(previewingLetter)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-colors"
                  title="Ekspor surat ini ke dokumen Google Docs"
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Google Docs</span>
                </button>

                {/* Tombol Cetak Dokumen Bersih */}
                <button
                  onClick={handlePrintCurrentPreview}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak ({paperSize})</span>
                </button>

                {/* Tombol Hapus Agenda Surat di Modal */}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Apakah Anda yakin ingin menghapus surat nomor "${previewingLetter.nomorSurat}" dari buku agenda?`
                      )
                    ) {
                      onDelete(previewingLetter.id);
                      setPreviewingLetter(null);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  title="Hapus surat dari agenda"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus Agenda</span>
                </button>

                <button
                  onClick={() => setPreviewingLetter(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Render Body */}
            <div className="p-4 sm:p-8 bg-slate-100 max-h-[82vh] overflow-y-auto">
              <LetterDocumentView
                letter={previewingLetter}
                school={school}
                previewMode={true}
                paperSize={paperSize}
                hideHeader={hideHeader}
                activeSheetMutasi={mutasiSheetView}
              />
            </div>
          </div>
        </div>
      )}

      {/* Export to Google Docs Modal */}
      {exportDocsLetter && (
        <ExportToDocsModal
          letter={exportDocsLetter}
          school={school}
          isOpen={!!exportDocsLetter}
          onClose={() => setExportDocsLetter(null)}
        />
      )}
    </div>
  );
};
