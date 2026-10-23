/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppDatabase, LetterRecord, LetterType, SchoolProfile, Student, Teacher, PaperSize } from './types';
import { StorageService } from './services/storageService';
import { generateNomorSurat, getDefaultClassificationCode, triggerPrintWithPaperSize } from './utils/formatters';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { LetterArchiveList } from './components/letters/LetterArchiveList';
import { LetterForm } from './components/letters/LetterForm';
import { StudentDatabase } from './components/students/StudentDatabase';
import { TeacherDatabase } from './components/teachers/TeacherDatabase';
import { SchoolProfileSettings } from './components/settings/SchoolProfileSettings';
import { LetterDocumentView } from './components/letters/LetterDocumentView';
import { GoogleDriveManager } from './components/drive/GoogleDriveManager';
import { ExportToDocsModal } from './components/drive/ExportToDocsModal';
import {
  testConnection,
  seedInitialDatabaseIfEmpty,
  subscribeToSchoolProfile,
  subscribeToStudents,
  subscribeToTeachers,
  subscribeToLetters,
  subscribeToCounter,
  saveSchoolProfileToFirestore,
  saveStudentToFirestore,
  deleteStudentFromFirestore,
  batchImportStudentsToFirestore,
  saveTeacherToFirestore,
  deleteTeacherFromFirestore,
  batchImportTeachersToFirestore,
  saveLetterToFirestore,
  updateLetterStatusInFirestore,
  deleteLetterFromFirestore,
  updateCounterInFirestore
} from './services/firestoreService';
import { Printer, X, Trash2, Cloud } from 'lucide-react';

export default function App() {
  const [database, setDatabase] = useState<AppDatabase>(() => StorageService.getDatabase());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState<boolean>(false);
  const [cloudSyncState, setCloudSyncState] = useState<'connected' | 'connecting' | 'syncing' | 'offline'>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Letter Creation / Edit State
  const [editingLetter, setEditingLetter] = useState<LetterRecord | null>(null);
  const [newLetterType, setNewLetterType] = useState<LetterType>('SURAT_TUGAS');
  
  // Direct Quick Preview Modal State (accessible from anywhere)
  const [modalPreviewLetter, setModalPreviewLetter] = useState<LetterRecord | null>(null);
  const [modalPaperSize, setModalPaperSize] = useState<PaperSize>('A4');
  const [modalHideHeader, setModalHideHeader] = useState<boolean>(false);
  const [modalMutasiSheet, setModalMutasiSheet] = useState<'ALL' | 'LEMBAR_1' | 'LEMBAR_2'>('ALL');
  const [docsModalLetter, setDocsModalLetter] = useState<LetterRecord | null>(null);

  // Sync to localStorage whenever database updates as offline cache
  useEffect(() => {
    StorageService.saveDatabase(database);
  }, [database]);

  // Realtime Cloud Synchronization (Akses di mana saja & update realtime)
  useEffect(() => {
    let isMounted = true;

    // Validate connection and seed cloud database if initial empty
    testConnection().then(async (online) => {
      if (!isMounted) return;
      if (online) {
        setCloudSyncState('connected');
        try {
          await seedInitialDatabaseIfEmpty(database);
        } catch (e) {
          console.warn('Seeding check notice:', e);
        }
      } else {
        setCloudSyncState('offline');
      }
    });

    // Subscriptions to Firestore collections in realtime
    const unsubProfile = subscribeToSchoolProfile(
      (profile) => {
        if (!isMounted || !profile) return;
        setDatabase(prev => ({ ...prev, schoolProfile: profile }));
        setCloudSyncState('connected');
        setLastSyncTime(new Date());
      },
      () => setCloudSyncState('offline')
    );

    const unsubStudents = subscribeToStudents(
      (students) => {
        if (!isMounted) return;
        if (students.length > 0) {
          setDatabase(prev => ({ ...prev, students }));
          setCloudSyncState('connected');
          setLastSyncTime(new Date());
        }
      },
      () => setCloudSyncState('offline')
    );

    const unsubTeachers = subscribeToTeachers(
      (teachers) => {
        if (!isMounted) return;
        if (teachers.length > 0) {
          setDatabase(prev => ({ ...prev, teachers }));
          setCloudSyncState('connected');
          setLastSyncTime(new Date());
        }
      },
      () => setCloudSyncState('offline')
    );

    const unsubLetters = subscribeToLetters(
      (letters) => {
        if (!isMounted) return;
        if (letters.length > 0) {
          setDatabase(prev => ({ ...prev, letters }));
          setCloudSyncState('connected');
          setLastSyncTime(new Date());
        }
      },
      () => setCloudSyncState('offline')
    );

    const unsubCounter = subscribeToCounter(
      (lastNum) => {
        if (!isMounted) return;
        if (typeof lastNum === 'number') {
          setDatabase(prev => ({
            ...prev,
            lastLetterNumber: Math.max(prev.lastLetterNumber, lastNum)
          }));
          setCloudSyncState('connected');
          setLastSyncTime(new Date());
        }
      },
      () => setCloudSyncState('offline')
    );

    return () => {
      isMounted = false;
      unsubProfile();
      unsubStudents();
      unsubTeachers();
      unsubLetters();
      unsubCounter();
    };
  }, []);

  // Handlers for Letters
  function handleStartCreateNewLetter(type: LetterType = 'SURAT_TUGAS') {
    setEditingLetter(null);
    setNewLetterType(type);
    setActiveTab('create_letter');
  }

  function handleStartEditLetter(letter: LetterRecord) {
    setEditingLetter(letter);
    setNewLetterType(letter.jenisSurat);
    setActiveTab('create_letter');
  }

  async function handleDuplicateLetter(sourceLetter: LetterRecord) {
    const nextNum = database.lastLetterNumber + 1;
    const newNumberStr = generateNomorSurat(
      sourceLetter.kodeKlasifikasi,
      nextNum,
      database.schoolProfile.namaSingkatanSekolah,
      new Date().toISOString().split('T')[0]
    );

    const duplicatedLetter: LetterRecord = {
      ...sourceLetter,
      id: `ltr_${Date.now()}`,
      nomorUrut: nextNum,
      nomorSurat: newNumberStr,
      tanggalSurat: new Date().toISOString().split('T')[0],
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDatabase(prev => ({
      ...prev,
      letters: [duplicatedLetter, ...prev.letters],
      lastLetterNumber: nextNum
    }));

    try {
      setCloudSyncState('syncing');
      await saveLetterToFirestore(duplicatedLetter);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to sync duplicated letter to Firestore:', e);
    }
  }

  async function handleDeleteLetter(id: string) {
    setDatabase(prev => ({
      ...prev,
      letters: prev.letters.filter(l => l.id !== id)
    }));

    try {
      setCloudSyncState('syncing');
      await deleteLetterFromFirestore(id);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to delete letter from Firestore:', e);
    }
  }

  async function handleSaveLetter(savedLetter: LetterRecord) {
    setDatabase(prev => {
      const isExisting = prev.letters.some(l => l.id === savedLetter.id);
      let updatedLetters: LetterRecord[];
      let nextLastNum = prev.lastLetterNumber;

      if (isExisting) {
        updatedLetters = prev.letters.map(l => (l.id === savedLetter.id ? savedLetter : l));
      } else {
        updatedLetters = [savedLetter, ...prev.letters];
        if (savedLetter.nomorUrut > nextLastNum) {
          nextLastNum = savedLetter.nomorUrut;
        }
      }

      return {
        ...prev,
        letters: updatedLetters,
        lastLetterNumber: nextLastNum
      };
    });

    setActiveTab('letters');
    setEditingLetter(null);

    try {
      setCloudSyncState('syncing');
      await saveLetterToFirestore(savedLetter);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to save letter to Firestore:', e);
    }
  }

  async function handleLetterStatusChange(id: string, newStatus: LetterRecord['status']) {
    setDatabase(prev => ({
      ...prev,
      letters: prev.letters.map(l => (l.id === id ? { ...l, status: newStatus } : l))
    }));

    try {
      setCloudSyncState('syncing');
      await updateLetterStatusInFirestore(id, newStatus);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to update letter status in Firestore:', e);
    }
  }

  // Quick Action from Student Database
  function handleQuickCreateLetterFromStudent(type: LetterType, student: Student) {
    const nextNum = database.lastLetterNumber + 1;
    const code = getDefaultClassificationCode(type);
    const today = new Date().toISOString().split('T')[0];
    const newNo = generateNomorSurat(code, nextNum, database.schoolProfile.namaSingkatanSekolah, today);

    let specificContent: LetterRecord['content'];

    if (type === 'SURAT_PANGGILAN_ORTU') {
      specificContent = {
        type: 'SURAT_PANGGILAN_ORTU',
        data: {
          studentId: student.id,
          namaSiswa: student.nama,
          nisn: student.nisn,
          kelas: student.kelas,
          namaOrtuWali: student.namaAyah || student.namaIbu || student.namaWali || 'Orang Tua Siswa',
          hariTanggalPanggilan: today,
          waktuPanggilan: '09.00 WIB s.d. 10.30 WIB',
          tempatMenghadap: `Ruang Bimbingan & Konseling (BK) ${database.schoolProfile.namaSekolah}`,
          menemuiPejabat: 'Guru BK & Wali Kelas',
          alasanPanggilan: 'Konsultasi perkembangan belajar dan pembinaan kedisiplinan siswa di sekolah.',
          catatanKhusus: 'Mengingat pentingnya hal ini, dimohon hadir tepat waktu dan tidak diwakilkan.',
          tembusan: ['Wali Kelas', 'Guru BK', 'Arsip Kesiswaan']
        }
      };
    } else if (type === 'SURAT_MUTASI_KELUAR') {
      specificContent = {
        type: 'SURAT_MUTASI_KELUAR',
        data: {
          studentId: student.id,
          namaSiswa: student.nama,
          nis: student.nis,
          nisn: student.nisn,
          jenisKelamin: student.jenisKelamin,
          tempatTanggalLahir: `${student.tempatLahir}, ${student.tanggalLahir}`,
          tingkatKelas: student.kelas,
          jurusan: student.jurusan,
          namaOrtuWali: student.namaAyah || student.namaIbu || student.namaWali || 'Orang Tua',
          pekerjaanOrtu: student.pekerjaanOrtu,
          alamatOrtu: student.alamat,
          namaSekolahTujuan: 'SEKOLAH TUJUAN PINDAH',
          kabKotaSekolahTujuan: 'Kota Tujuan',
          provinsiSekolahTujuan: 'Provinsi Tujuan',
          alasanPindah: 'Mengikuti kepindahan tugas orang tua.',
          bukuRaportDiserahkan: true,
          suratValidasiNisn: true,
          fotokopiAkreditasi: true,
          keteranganLainnya: 'Berkas Dapodik terlampir.',
          tembusan: ['Dinas Pendidikan Asal', 'Dinas Pendidikan Tujuan', 'Orang Tua Siswa', 'Arsip']
        }
      };
    } else {
      // Default fallback
      specificContent = {
        type: 'SURAT_KETERANGAN_AKTIF',
        data: {
          studentId: student.id,
          namaSiswa: student.nama,
          nis: student.nis,
          nisn: student.nisn,
          jenisKelamin: student.jenisKelamin,
          tempatTanggalLahir: `${student.tempatLahir}, ${student.tanggalLahir}`,
          kelas: student.kelas,
          namaOrtu: student.namaAyah || student.namaIbu || 'Orang Tua',
          alamat: student.alamat,
          tujuanPenggunaan: 'Syarat Berkas Administrasi Resmi',
          keteranganTambahan: ''
        }
      };
    }

    const prefilledLetter: LetterRecord = {
      id: `ltr_${Date.now()}`,
      nomorSurat: newNo,
      nomorUrut: nextNum,
      kodeKlasifikasi: code,
      jenisSurat: type,
      perihal: type === 'SURAT_PANGGILAN_ORTU' ? 'Panggilan Orang Tua / Wali Siswa' : 'Surat Keterangan Pindah Sekolah',
      sifat: type === 'SURAT_PANGGILAN_ORTU' ? 'Rahasia' : 'Biasa',
      lampiran: type === 'SURAT_MUTASI_KELUAR' ? '1 Berkas Raport' : '-',
      tanggalSurat: today,
      tempatDibuat: database.schoolProfile.kotaKab.replace('Kota ', '').replace('Kabupaten ', ''),
      kepadaYth: `Orang Tua / Wali Siswa: ${student.nama}`,
      content: specificContent,
      penandatanganNama: database.schoolProfile.kepalaSekolahNama,
      penandatanganNip: database.schoolProfile.kepalaSekolahNip,
      penandatanganPangkat: database.schoolProfile.kepalaSekolahPangkat,
      penandatanganJabatan: database.schoolProfile.kepalaSekolahJabatan,
      includeStempel: database.schoolProfile.stempelEnabled,
      includeTtd: database.schoolProfile.ttdEnabled,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingLetter(prefilledLetter);
    setNewLetterType(type);
    setActiveTab('create_letter');
  }

  // Quick Action from Teacher Database
  function handleQuickCreateTugasFromTeacher(teacher: Teacher) {
    const nextNum = database.lastLetterNumber + 1;
    const code = '800';
    const today = new Date().toISOString().split('T')[0];
    const newNo = generateNomorSurat(code, nextNum, database.schoolProfile.namaSingkatanSekolah, today);

    const prefilledLetter: LetterRecord = {
      id: `ltr_${Date.now()}`,
      nomorSurat: newNo,
      nomorUrut: nextNum,
      kodeKlasifikasi: code,
      jenisSurat: 'SURAT_TUGAS',
      perihal: `Surat Perintah Tugas Kedinasan - ${teacher.nama}`,
      sifat: 'Penting',
      lampiran: '1 (satu) Berkas',
      tanggalSurat: today,
      tempatDibuat: database.schoolProfile.kotaKab.replace('Kota ', '').replace('Kabupaten ', ''),
      kepadaYth: teacher.nama,
      content: {
        type: 'SURAT_TUGAS',
        data: {
          dasarPenugasan: `Surat Edaran Kepala Dinas Pendidikan perihal Pelaksanaan Kegiatan Peningkatan Kompetensi GTK.`,
          daftarPetugas: [
            {
              nama: teacher.nama,
              nip: teacher.nip,
              pangkatGolongan: teacher.pangkatGolongan,
              jabatan: teacher.jabatan
            }
          ],
          keperluanTugas: `Melaksanakan tugas kedinasan dan menghadiri kegiatan pelatihan / pendampingan resmi perwakilan ${database.schoolProfile.namaSekolah}.`,
          waktuMulai: today,
          waktuSelesai: today,
          jamKegiatan: '08.00 WIB s.d Selesai',
          tempatKegiatan: `Balai Pengembangan Mutu Pendidikan Provinsi ${database.schoolProfile.provinsi}`,
          bebanAnggaran: `BOS / DIPA ${database.schoolProfile.namaSekolah} Tahun 2026`,
          tembusan: ['Kepala Cabang Dinas Pendidikan', 'Arsip']
        }
      },
      penandatanganNama: database.schoolProfile.kepalaSekolahNama,
      penandatanganNip: database.schoolProfile.kepalaSekolahNip,
      penandatanganPangkat: database.schoolProfile.kepalaSekolahPangkat,
      penandatanganJabatan: database.schoolProfile.kepalaSekolahJabatan,
      includeStempel: database.schoolProfile.stempelEnabled,
      includeTtd: database.schoolProfile.ttdEnabled,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingLetter(prefilledLetter);
    setNewLetterType('SURAT_TUGAS');
    setActiveTab('create_letter');
  }

  // Student CRUD
  async function handleAddStudent(newStudent: Student) {
    setDatabase(prev => ({
      ...prev,
      students: [newStudent, ...prev.students]
    }));
    try {
      setCloudSyncState('syncing');
      await saveStudentToFirestore(newStudent);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to add student to Firestore:', e);
    }
  }

  async function handleUpdateStudent(updatedStudent: Student) {
    setDatabase(prev => ({
      ...prev,
      students: prev.students.map(s => (s.id === updatedStudent.id ? updatedStudent : s))
    }));
    try {
      setCloudSyncState('syncing');
      await saveStudentToFirestore(updatedStudent);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to update student in Firestore:', e);
    }
  }

  async function handleDeleteStudent(id: string) {
    setDatabase(prev => ({
      ...prev,
      students: prev.students.filter(s => s.id !== id)
    }));
    try {
      setCloudSyncState('syncing');
      await deleteStudentFromFirestore(id);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to delete student from Firestore:', e);
    }
  }

  async function handleBatchImportStudents(imported: Student[], replace: boolean) {
    setDatabase(prev => ({
      ...prev,
      students: replace ? imported : [...imported, ...prev.students]
    }));
    try {
      setCloudSyncState('syncing');
      await batchImportStudentsToFirestore(imported, replace);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to batch import students to Firestore:', e);
    }
  }

  // Teacher CRUD
  async function handleAddTeacher(newTeacher: Teacher) {
    setDatabase(prev => ({
      ...prev,
      teachers: [newTeacher, ...prev.teachers]
    }));
    try {
      setCloudSyncState('syncing');
      await saveTeacherToFirestore(newTeacher);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to add teacher to Firestore:', e);
    }
  }

  async function handleUpdateTeacher(updatedTeacher: Teacher) {
    setDatabase(prev => ({
      ...prev,
      teachers: prev.teachers.map(t => (t.id === updatedTeacher.id ? updatedTeacher : t))
    }));
    try {
      setCloudSyncState('syncing');
      await saveTeacherToFirestore(updatedTeacher);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to update teacher in Firestore:', e);
    }
  }

  async function handleDeleteTeacher(id: string) {
    setDatabase(prev => ({
      ...prev,
      teachers: prev.teachers.filter(t => t.id !== id)
    }));
    try {
      setCloudSyncState('syncing');
      await deleteTeacherFromFirestore(id);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to delete teacher from Firestore:', e);
    }
  }

  async function handleBatchImportTeachers(imported: Teacher[], replace: boolean) {
    setDatabase(prev => ({
      ...prev,
      teachers: replace ? imported : [...imported, ...prev.teachers]
    }));
    try {
      setCloudSyncState('syncing');
      await batchImportTeachersToFirestore(imported, replace);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to batch import teachers to Firestore:', e);
    }
  }

  // School Profile & Database Reset
  async function handleSaveProfile(newProfile: SchoolProfile) {
    setDatabase(prev => ({
      ...prev,
      schoolProfile: newProfile
    }));
    try {
      setCloudSyncState('syncing');
      await saveSchoolProfileToFirestore(newProfile);
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to save profile to Firestore:', e);
    }
  }

  async function handleDatabaseRestored(restoredDb: AppDatabase) {
    setDatabase(restoredDb);
    try {
      setCloudSyncState('syncing');
      await saveSchoolProfileToFirestore(restoredDb.schoolProfile);
      await updateCounterInFirestore(restoredDb.lastLetterNumber);
      await batchImportStudentsToFirestore(restoredDb.students, true);
      await batchImportTeachersToFirestore(restoredDb.teachers, true);
      for (const letter of restoredDb.letters) {
        await saveLetterToFirestore(letter);
      }
      setCloudSyncState('connected');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Failed to restore database to Firestore:', e);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans-ui">
      {/* Tab Navigasi di Sebelah Kiri (Left Sidebar) */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={tab => {
          setActiveTab(tab);
          setEditingLetter(null);
        }}
        onCreateLetter={type => handleStartCreateNewLetter(type)}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
        school={database.schoolProfile}
        totalLetters={database.letters.length}
      />

      {/* Konten Utama di Sisi Kanan */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          activeTab={activeTab}
          onTabChange={tab => {
            setActiveTab(tab);
            setEditingLetter(null);
          }}
          onCreateNewLetter={() => handleStartCreateNewLetter('SURAT_TUGAS')}
          onToggleSidebarMobile={() => setIsSidebarOpenMobile(prev => !prev)}
          school={database.schoolProfile}
          cloudSyncState={cloudSyncState}
          lastSyncTime={lastSyncTime}
        />

        {/* Main Workspace Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              letters={database.letters}
              students={database.students}
              teachers={database.teachers}
              school={database.schoolProfile}
              onNavigateTab={setActiveTab}
              onCreateLetter={type => handleStartCreateNewLetter(type)}
              onPreviewLetter={letter => setModalPreviewLetter(letter)}
            />
          )}

          {activeTab === 'letters' && (
            <LetterArchiveList
              letters={database.letters}
              school={database.schoolProfile}
              onCreateNew={type => handleStartCreateNewLetter(type || 'SURAT_TUGAS')}
              onEdit={handleStartEditLetter}
              onDuplicate={handleDuplicateLetter}
              onDelete={handleDeleteLetter}
              onStatusChange={handleLetterStatusChange}
            />
          )}

          {activeTab === 'create_letter' && (
            <LetterForm
              existingLetter={editingLetter}
              initialType={newLetterType}
              school={database.schoolProfile}
              students={database.students}
              teachers={database.teachers}
              nextSequence={database.lastLetterNumber + 1}
              onSave={handleSaveLetter}
              onCancel={() => {
                setActiveTab('letters');
                setEditingLetter(null);
              }}
            />
          )}

          {activeTab === 'students' && (
            <StudentDatabase
              students={database.students}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onQuickCreateLetter={handleQuickCreateLetterFromStudent}
              onBatchImportStudents={handleBatchImportStudents}
            />
          )}

          {activeTab === 'teachers' && (
            <TeacherDatabase
              teachers={database.teachers}
              onAddTeacher={handleAddTeacher}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onQuickCreateTugas={handleQuickCreateTugasFromTeacher}
              onBatchImportTeachers={handleBatchImportTeachers}
            />
          )}

          {activeTab === 'settings' && (
            <SchoolProfileSettings
              school={database.schoolProfile}
              database={database}
              onSaveProfile={handleSaveProfile}
              onDatabaseRestored={handleDatabaseRestored}
            />
          )}

          {activeTab === 'drive' && (
            <GoogleDriveManager
              database={database}
              school={database.schoolProfile}
              onNavigateToLetters={() => setActiveTab('letters')}
            />
          )}
        </main>

        {/* Minimal Clean Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 no-print">
          <p>
            {database.schoolProfile.namaSekolah} · Sistem Informasi Database & Persuratan Administrasi Sekolah
          </p>
        </footer>
      </div>

      {/* Global Quick Preview Modal (accessible when viewing from Dashboard) */}
      {modalPreviewLetter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 gap-3 no-print">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Pratinjau Surat: {modalPreviewLetter.nomorSurat}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
                    {modalPaperSize}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Tata Naskah Dinas Resmi {database.schoolProfile.namaSekolah}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Pilihan Jenis Kertas: A4 vs F4 (Folio) */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setModalPaperSize('A4')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      modalPaperSize === 'A4'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kertas A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalPaperSize('F4')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      modalPaperSize === 'F4'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kertas F4 (Folio)
                  </button>
                </div>

                {/* Opsi Hilangkan Header / Kop Surat */}
                <button
                  type="button"
                  onClick={() => setModalHideHeader(prev => !prev)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                    modalHideHeader
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Hilangkan Kop Surat (Berguna jika mencetak pada kertas yang sudah tercetak kop surat percetakan)"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" style={{ display: modalHideHeader ? 'inline-block' : 'none' }} />
                  <span>{modalHideHeader ? 'Header: Sembunyi' : 'Header: Aktif'}</span>
                </button>

                {/* Khusus Surat Mutasi Keluar: Selector Lembar Cetak */}
                {modalPreviewLetter.jenisSurat === 'SURAT_MUTASI_KELUAR' && (
                  <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setModalMutasiSheet('ALL')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        modalMutasiSheet === 'ALL'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-indigo-800 hover:bg-indigo-100'
                      }`}
                      title="Cetak Paket Lengkap: Surat Sekolah & Permohonan Orang Tua"
                    >
                      Semua Lembar
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMutasiSheet('LEMBAR_1')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        modalMutasiSheet === 'LEMBAR_1'
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-indigo-800 hover:bg-indigo-100'
                      }`}
                      title="Hanya Lembar 1: Surat Keterangan Pindah dari Sekolah"
                    >
                      Lembar 1 (Sekolah)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMutasiSheet('LEMBAR_2')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        modalMutasiSheet === 'LEMBAR_2'
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
                  onClick={() => setDocsModalLetter(modalPreviewLetter)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-colors"
                  title="Ekspor surat ini ke dokumen Google Docs"
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Google Docs</span>
                </button>

                {/* Tombol Cetak Dokumen Bersih */}
                <button
                  onClick={() => {
                    handleLetterStatusChange(modalPreviewLetter.id, 'Dicetak');
                    triggerPrintWithPaperSize(modalPaperSize);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak ({modalPaperSize})</span>
                </button>

                {/* Tombol Hapus Agenda Surat */}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Apakah Anda yakin ingin menghapus surat nomor "${modalPreviewLetter.nomorSurat}" dari buku agenda?`
                      )
                    ) {
                      handleDeleteLetter(modalPreviewLetter.id);
                      setModalPreviewLetter(null);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  title="Hapus surat ini dari buku agenda"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus Agenda</span>
                </button>

                <button
                  onClick={() => setModalPreviewLetter(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-slate-100 max-h-[82vh] overflow-y-auto">
              <LetterDocumentView
                letter={modalPreviewLetter}
                school={database.schoolProfile}
                previewMode={true}
                paperSize={modalPaperSize}
                hideHeader={modalHideHeader}
                activeSheetMutasi={modalMutasiSheet}
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Export to Docs Modal */}
      {docsModalLetter && (
        <ExportToDocsModal
          letter={docsModalLetter}
          school={database.schoolProfile}
          isOpen={!!docsModalLetter}
          onClose={() => setDocsModalLetter(null)}
        />
      )}
    </div>
  );
}
