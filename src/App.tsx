/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import { 
  Video, FileText, Lightbulb, BookOpen, Sparkles, 
  Play, Search, Plus, Trash2, X, Lock, LogOut, 
  ChevronRight, Clock, Users, Book, Award, 
  Star, Menu, Edit3, GraduationCap, Building2, 
  TrendingUp, Calculator, BarChart3, DollarSign, 
  Globe, Target, Zap, CheckCircle, Bell, Filter, 
  Calendar, Download, ExternalLink, Settings, LayoutDashboard,
  ShieldCheck, MessageSquare, Send, Reply, Heart, Share2,
  MoreVertical, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Fuse from 'fuse.js';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  doc, 
  query, 
  where,
  orderBy, 
  setDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, loginWithGoogle, loginWithEmail, handleFirestoreError, OperationType, getFriendlyErrorMessage } from './lib/firebase';
import { Subject, Lecture, StudyFile, Tip, Term, SiteUpdate, Post, Comment } from './types';
import { DEFAULT_SUBJECTS, DEFAULT_TIPS, DEFAULT_TERMS } from './constants';

export default function App() {
  // --- State ---
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeSection, setActiveSection] = useState<'home' | 'lectures' | 'files' | 'tips' | 'terms' | 'announcements' | 'admin'>('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [videoModal, setVideoModal] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Data State ---
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [files, setFiles] = useState<StudyFile[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const ADMIN_EMAIL = 'ahmedgamalahmed159@gmail.com';

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleError = (err: any, op: OperationType, path: string) => {
      handleFirestoreError(err, op, path);
      showToast(getFriendlyErrorMessage(err), 'error');
    };

    // Real-time Subjects
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Subject));
      setSubjects(data.length > 0 ? data : DEFAULT_SUBJECTS);
    }, (err) => handleError(err, OperationType.LIST, 'subjects'));

    // Real-time Lectures
    const unsubLectures = onSnapshot(query(collection(db, 'lectures'), orderBy('date', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lecture));
      setLectures(data);
    }, (err) => handleError(err, OperationType.LIST, 'lectures'));

    // Real-time Files
    const unsubFiles = onSnapshot(query(collection(db, 'files'), orderBy('date', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyFile));
      setFiles(data);
    }, (err) => handleError(err, OperationType.LIST, 'files'));

    // Real-time Terms
    const unsubTerms = onSnapshot(collection(db, 'terms'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Term));
      setTerms(data.length > 0 ? data : DEFAULT_TERMS);
    }, (err) => handleError(err, OperationType.LIST, 'terms'));

    // Real-time Tips
    const unsubTips = onSnapshot(query(collection(db, 'tips'), orderBy('date', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tip));
      setTips(data.length > 0 ? data : DEFAULT_TIPS);
    }, (err) => handleError(err, OperationType.LIST, 'tips'));

    return () => {
      unsubSubjects();
      unsubLectures();
      unsubFiles();
      unsubTerms();
      unsubTips();
    };
  }, [showToast]);

  useEffect(() => {
    // Public Posts & Comments
    const unsubPosts = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          createdAt: d.createdAt?.toDate() || new Date()
        } as Post;
      });
      setPosts(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'posts');
      showToast(getFriendlyErrorMessage(err), 'error');
    });

    const unsubComments = onSnapshot(query(collection(db, 'comments'), orderBy('createdAt', 'asc')), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          createdAt: d.createdAt?.toDate() || new Date()
        } as Comment;
      });
      setComments(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'comments');
      showToast(getFriendlyErrorMessage(err), 'error');
    });

    return () => {
      unsubPosts();
      unsubComments();
    };
  }, [showToast]);

  useEffect(() => {
    if (!user) {
      setProgress([]);
      return;
    }

    const q = query(
      collection(db, 'userProgress'), 
      where('userId', '==', user.uid)
    );
    const unsubProgress = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setProgress(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'userProgress');
      showToast(getFriendlyErrorMessage(err), 'error');
    });

    return () => {
      unsubProgress();
    };
  }, [user, showToast]);

  // --- Filtering ---
  const lecturesWithSubject = useMemo(() => {
    return lectures.map(l => ({
      ...l,
      subjectName: subjects.find(s => s.id === l.subjectId)?.nameAr || ''
    }));
  }, [lectures, subjects]);

  const filteredLectures = useMemo(() => {
    let result = lecturesWithSubject;
    
    if (selectedSubject !== 'all') {
      result = result.filter(l => l.subjectId === selectedSubject);
    }

    if (!searchTerm.trim()) return result;

    const fuse = new Fuse(result, {
      keys: ['title', 'description', 'subjectName'],
      threshold: 0.3,
    });

    return fuse.search(searchTerm).map(r => r.item);
  }, [lecturesWithSubject, searchTerm, selectedSubject]);

  const filesWithSubject = useMemo(() => {
    return files.map(f => ({
      ...f,
      subjectName: subjects.find(s => s.id === f.subjectId)?.nameAr || ''
    }));
  }, [files, subjects]);

  const filteredFiles = useMemo(() => {
    let result = filesWithSubject;
    
    if (selectedSubject !== 'all') {
      result = result.filter(f => f.subjectId === selectedSubject);
    }

    if (!searchTerm.trim()) return result;

    const fuse = new Fuse(result, {
      keys: ['title', 'description', 'subjectName'],
      threshold: 0.3,
    });

    return fuse.search(searchTerm).map(r => r.item);
  }, [filesWithSubject, searchTerm, selectedSubject]);

  // --- Helpers ---
  const getSubColor = (id: string) => subjects.find(s => s.id === id)?.color || '#6366F1';
  const getSubName = (id: string) => subjects.find(s => s.id === id)?.nameAr || 'غير محدد';

  const getYouTubeEmbedUrl = (url: string) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // --- Actions ---
  const handleAddLecture = async (lectureData: Omit<Lecture, 'id' | 'date'>) => {
    try {
      await addDoc(collection(db, 'lectures'), {
        ...lectureData,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      showToast('تم إضافة المحاضرة بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'lectures');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleAddFile = async (fileData: Omit<StudyFile, 'id' | 'date'>) => {
    try {
      await addDoc(collection(db, 'files'), {
        ...fileData,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      showToast('تم إضافة الملف بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'files');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleAddSubject = async (subjectData: any) => {
    try {
      await addDoc(collection(db, 'subjects'), subjectData);
      showToast('تم إضافة التخصص بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subjects');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleAddTerm = async (termData: any) => {
    try {
      await addDoc(collection(db, 'terms'), termData);
      showToast('تم إضافة المصطلح بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'terms');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleUpdateLecture = async (id: string, lectureData: any) => {
    try {
      await updateDoc(doc(db, 'lectures', id), lectureData);
      showToast('تم تحديث المحاضرة بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `lectures/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleUpdateFile = async (id: string, fileData: any) => {
    try {
      await updateDoc(doc(db, 'files', id), fileData);
      showToast('تم تحديث الملف بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `files/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleUpdateSubject = async (id: string, subjectData: any) => {
    try {
      await updateDoc(doc(db, 'subjects', id), subjectData);
      showToast('تم تحديث التخصص بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subjects/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleUpdateTerm = async (id: string, termData: any) => {
    try {
      await updateDoc(doc(db, 'terms', id), termData);
      showToast('تم تحديث المصطلح بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `terms/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleUpdateTip = async (id: string, tipData: any) => {
    try {
      await updateDoc(doc(db, 'tips', id), tipData);
      showToast('تم تحديث النصيحة بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tips/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleUpdatePost = async (id: string, postData: any) => {
    try {
      await updateDoc(doc(db, 'posts', id), {
        title: postData.title,
        content: postData.content,
        updatedAt: serverTimestamp()
      });
      showToast('تم تحديث الإعلان بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleAddTip = async (tipData: any) => {
    try {
      await addDoc(collection(db, 'tips'), {
        ...tipData,
        date: new Date().toISOString(),
        isNew: true
      });
      showToast('تم إضافة النصيحة بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tips');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleAddPost = async (postData: any) => {
    if (!isAdmin || !user) return;
    try {
      await addDoc(collection(db, 'posts'), {
        title: postData.title,
        content: postData.content,
        authorId: user.uid,
        authorName: user.displayName || 'Admin',
        authorPhoto: user.photoURL || '',
        createdAt: serverTimestamp()
      });
      showToast('تم نشر الإعلان بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'comments'), {
        postId,
        content,
        userId: user.uid,
        userName: user.displayName || 'طالب مجهول',
        userPhoto: user.photoURL || '',
        createdAt: serverTimestamp()
      });
      showToast('تم إضافة تعليقك.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'comments');
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const deleteItem = async (colName: string, id: string) => {
    try {
      await deleteDoc(doc(db, colName, id));
      showToast('تم الحذف بنجاح.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${colName}/${id}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const toggleProgress = async (itemId: string, itemType: 'lecture' | 'file') => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    const progressId = `${user.uid}_${itemId}`;
    const existingEntry = progress.find(p => p.itemId === itemId);
    const newStatus = !existingEntry?.completed;

    try {
      await setDoc(doc(db, 'userProgress', progressId), {
        userId: user.uid,
        itemId,
        itemType,
        completed: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showToast(newStatus ? 'تم إضافة العنصر للمكتملات.' : 'تم إزالة العنصر من المكتملات.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `userProgress/${progressId}`);
      showToast(getFriendlyErrorMessage(err), 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setActiveSection('home');
  };

  return (
    <div className="min-h-screen flex flex-col rtl" dir="rtl">
      {/* --- Navigation --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-morphism h-20 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveSection('home')}>
          <div className="w-12 h-12 rounded-lg bg-navy-900 flex items-center justify-center shadow-lg border border-navy-700">
            <GraduationCap className="text-academic-gold w-7 h-7" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-black text-navy-900 leading-tight tracking-tight uppercase">Atallm <span className="text-academic-gold">Academy</span></h1>
            <p className="text-[10px] text-navy-700 font-bold tracking-[0.3em] uppercase">Academic Excellence</p>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {[
            { id: 'home', label: 'الرئيسية' },
            { id: 'lectures', label: 'المحاضرات' },
            { id: 'files', label: 'الملفات' },
            { id: 'announcements', label: 'الإعلانات' },
            { id: 'tips', label: 'نصائح دراسية' },
            { id: 'terms', label: 'المصطلحات' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`relative py-2 text-sm font-bold transition-all ${
                activeSection === item.id 
                  ? 'text-navy-900 after:absolute after:bottom-0 after:right-0 after:left-0 after:h-0.5 after:bg-academic-gold' 
                  : 'text-slate-500 hover:text-navy-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button 
                  onClick={() => setActiveSection('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeSection === 'admin' ? 'bg-navy-900 text-white shadow-lg' : 'bg-slate-100 text-navy-900 border border-slate-200'}`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden lg:inline">لوحة التحكم</span>
                </button>
              )}
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200 group relative">
                <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-full border-2 border-slate-100 shadow-sm" />
                <span className="text-sm font-bold text-navy-900 hidden lg:block">{user.displayName}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2.5 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-navy-900 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-navy-950/20 hover:bg-navy-800"
            >
              <ShieldCheck className="w-4 h-4 text-academic-gold" />
              <span>دخول الإدارة</span>
            </button>
          )}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-navy-900 bg-slate-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[60] bg-navy-900 pt-24 px-8 md:hidden"
          >
            <div className="flex flex-col gap-6">
              {[
                { id: 'home', label: 'الرئيسية', icon: LayoutDashboard },
                { id: 'lectures', label: 'المحاضرات', icon: Video },
                { id: 'files', label: 'المخزن الرقمي', icon: FileText },
                { id: 'announcements', label: 'إعلانات المنصة', icon: Bell },
                { id: 'tips', label: 'نصائح التفوق', icon: Award },
                { id: 'terms', label: 'قاموس المصطلحات', icon: BookOpen },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-6 p-5 rounded-xl text-xl font-bold transition-all ${
                    activeSection === item.id ? 'bg-academic-gold text-navy-900 shadow-xl' : 'text-slate-300 border border-white/10 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="absolute bottom-12 left-8 right-8 pt-8 border-t border-white/5">
               <p className="text-slate-500 text-xs font-bold text-center tracking-widest uppercase">Atallm Academy v2.0</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Main Content --- */}
      <main className="flex-grow pt-20">
        <AnimatePresence mode="wait">
          {activeSection === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Premium Hero */}
              <section className="relative academic-gradient py-24 md:py-36 overflow-hidden">
                {/* Geometric Background pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                   <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                   <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-academic-gold rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
                   <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </div>

                <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8 }}
                  >
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-8">
                      <Award className="text-academic-gold w-4 h-4" />
                      <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">المركز الأكاديمي المعتمد للتميز</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-[84px] font-black text-white mb-8 leading-[1.1] tracking-tight">
                      ارتقِ بمستواك <br />
                      <span className="text-academic-gold">في العلوم الإدارية</span>
                    </h1>
                    <p className="text-base sm:text-lg md:text-2xl text-slate-300 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
                      منصة Atallm توفر لطلاب كلية التجارة بيئة تعليمية احترافية، مجهزة بأحدث المحاضرات والملفّات الدراسية المتخصصة.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
                      <button 
                        onClick={() => setActiveSection('lectures')}
                        className="px-8 sm:px-12 py-4 sm:py-5 bg-academic-gold hover:bg-[#A37B30] text-navy-900 rounded-xl font-black text-lg sm:text-xl shadow-2xl flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95 w-full sm:w-auto"
                      >
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                        ابدأ المذاكرة الآن
                      </button>
                      <button 
                        onClick={() => setActiveSection('files')}
                        className="px-8 sm:px-12 py-4 sm:py-5 bg-white/10 text-white backdrop-blur-md border border-white/20 rounded-xl font-black text-lg sm:text-xl hover:bg-white/20 transition-all shadow-xl hover:-translate-y-1 w-full sm:w-auto"
                      >
                        المصادر الملفية
                      </button>
                    </div>
                  </motion.div>
                </div>
              </section>

              {/* Stats Bento Grid */}
              <section className="max-w-6xl mx-auto -mt-16 px-6 mb-24">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { icon: Video, label: 'محاضرة مرئية', value: lectures.length, color: 'text-academic-gold' },
                    { icon: FileText, label: 'ملف دراسي', value: files.length, color: 'text-academic-teal' },
                    { icon: Book, label: 'مادة دراسية', value: subjects.length, color: 'text-indigo-500' },
                    { icon: Award, label: 'شهادات وشروحات', value: '100+', color: 'text-rose-500' },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i + 0.4 }}
                      className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center text-center group transition-all hover:bg-navy-900 hover:border-navy-900"
                    >
                      <div className={`p-4 rounded-xl bg-slate-50 mb-6 group-hover:bg-white/10 transition-colors`}>
                        <stat.icon className={`${stat.color} w-8 h-8 group-hover:text-white`} />
                      </div>
                      <div className="text-4xl font-black text-navy-900 mb-2 group-hover:text-white transition-colors">{stat.value}</div>
                      <div className="text-sm font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Quick Info Box */}
              <section className="max-w-6xl mx-auto px-6 py-20 bg-slate-100 rounded-[3rem] border border-slate-200 mb-24 grid md:grid-cols-2 gap-12 items-center">
                 <div className="order-2 md:order-1">
                   <h2 className="text-4xl font-black text-navy-900 mb-6 leading-tight">لماذا منصة Atallm <br/><span className="text-academic-teal">المستقبليّة؟</span></h2>
                   <div className="space-y-6">
                     {[
                       { t: 'محتوى متجدد', d: 'يتم إضافة محاضرات يومية تغطي كافة جوانب المنهج الأكاديمي.' },
                       { t: 'تنظيم إداري احترافي', d: 'تصنيفات دقيقة للمواد والملفات لتسهيل وصولك للمعلومة.' },
                       { t: 'تكنولوجيا متقدمة', d: 'تجربة مستخدم عالمية تضاهي أكبر الجامعات الدولية.' }
                     ].map((item, idx) => (
                       <div key={idx} className="flex gap-4">
                         <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg shadow-sm flex items-center justify-center text-academic-teal font-black text-xl">{idx+1}</div>
                         <div>
                           <h4 className="text-lg font-bold text-navy-900 mb-1">{item.t}</h4>
                           <p className="text-slate-600 text-sm">{item.d}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
                 <div className="order-1 md:order-2 h-full bg-navy-900 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center relative min-h-[300px]">
                    <GraduationCap className="w-48 h-48 text-white/5" />
                    <div className="absolute inset-x-8 bottom-8 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                      <p className="text-white font-bold italic leading-relaxed">"التعليم ليس ملء إناء، بل إيقاد نار. Atallm هنا لتوقد تلك النار."</p>
                    </div>
                 </div>
              </section>
            </motion.div>
          )}

          {activeSection === 'lectures' && (
            <motion.div
              key="lectures"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-6xl mx-auto px-6 pb-24"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 pt-8">
                <div>
                  <h2 className="text-5xl font-black text-navy-900 mb-4 tracking-tighter">قاعة <span className="text-academic-gold">المحاضرات</span></h2>
                  <p className="text-slate-500 font-medium text-lg">بسطنا لك أعقد المفاهيم لتصل إلى القمة.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <div className="relative group flex-grow lg:w-80">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-academic-gold transition-colors w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="ابحث عن محاضرة..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-academic-gold/20 focus:border-academic-gold text-navy-900 placeholder-slate-400 transition-all font-bold shadow-sm"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select 
                      value={selectedSubject}
                      onChange={e => setSelectedSubject(e.target.value)}
                      className="appearance-none pr-12 pl-10 py-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-academic-gold text-navy-900 font-bold cursor-pointer transition-all shadow-sm"
                    >
                      <option value="all">جميع التخصصات</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
                    </select>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredLectures.map((lecture) => {
                  const yid = getYouTubeEmbedUrl(lecture.videoUrl);
                  const isCompleted = progress.find(p => p.itemId === lecture.id)?.completed;
                  return (
                    <motion.div 
                      key={lecture.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`premium-card overflow-hidden group cursor-pointer border-2 transition-all ${isCompleted ? 'border-academic-teal shadow-academic-teal/10' : 'border-transparent'}`}
                    >
                      <div 
                        className="aspect-video bg-navy-950 relative flex items-center justify-center overflow-hidden"
                        onClick={() => yid ? setVideoModal(`https://www.youtube.com/embed/${yid}?autoplay=1`) : window.open(lecture.videoUrl)}
                      >
                         {yid ? (
                           <img 
                             src={`https://img.youtube.com/vi/${yid}/maxresdefault.jpg`} 
                             className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" 
                             alt={lecture.title}
                           />
                         ) : (
                           <div className="academic-gradient w-full h-full flex items-center justify-center">
                             <Video className="w-16 h-16 text-white/10" />
                           </div>
                         )}
                         <div className="absolute inset-0 bg-navy-900/10 group-hover:bg-transparent transition-colors" />
                         <div className="absolute top-4 left-4">
                            <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg text-white border border-white/20">
                              <Play className="w-4 h-4 fill-current" />
                            </div>
                         </div>
                         {isCompleted && (
                           <div className="absolute top-4 right-4 bg-academic-teal text-white p-2 rounded-lg shadow-xl">
                              <CheckCircle className="w-5 h-5" />
                           </div>
                         )}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span 
                            className="px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-widest" 
                            style={{ backgroundColor: getSubColor(lecture.subjectId) }}
                          >
                            {getSubName(lecture.subjectId)}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProgress(lecture.id, 'lecture');
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                              isCompleted 
                                ? 'bg-academic-teal text-white' 
                                : 'bg-slate-100 text-slate-500 hover:bg-academic-teal/10 hover:text-academic-teal'
                            }`}
                          >
                            {isCompleted ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
                            {isCompleted ? 'مكتملة' : 'تمت المشاهدة؟'}
                          </button>
                        </div>
                        <h3 className="text-xl font-bold text-navy-900 mb-2 line-clamp-1 group-hover:text-academic-teal transition-colors tracking-tight" onClick={() => yid ? setVideoModal(`https://www.youtube.com/embed/${yid}?autoplay=1`) : window.open(lecture.videoUrl)}>{lecture.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed mb-4">
                          {lecture.description}
                        </p>
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                           <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                             <Calendar className="w-3 h-3" />
                             {new Date(lecture.date).toLocaleDateString('ar-EG')}
                           </span>
                           <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-academic-gold transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeSection === 'files' && (
            <motion.div
              key="files"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto px-6 pb-24"
            >
              <header className="mb-16 text-center pt-8">
                <div className="w-16 h-16 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-navy-700">
                  <FileText className="text-academic-gold w-8 h-8" />
                </div>
                <h2 className="text-5xl font-black text-navy-900 mb-4 tracking-tighter">المستندات <span className="text-academic-teal">الأكاديمية</span></h2>
                <p className="text-slate-500 font-medium text-lg">تحميل مباشر لأهم الملخصات والكتب الدراسية.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredFiles.map((file) => {
                  const isCompleted = progress.find(p => p.itemId === file.id)?.completed;
                  return (
                    <motion.div 
                      key={file.id}
                      className={`premium-card p-6 flex items-center gap-6 border-2 transition-all ${isCompleted ? 'border-academic-teal shadow-academic-teal/10' : 'border-transparent'}`}
                    >
                      <div className={`w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 transition-colors ${isCompleted ? 'bg-academic-teal/10 border-academic-teal/20' : 'group-hover:bg-navy-900'}`}>
                        {file.fileType === 'pdf' ? <FileText className={`${isCompleted ? 'text-academic-teal' : 'text-red-600'} w-10 h-10`} /> : 
                         file.fileType === 'xls' ? <BarChart3 className={`${isCompleted ? 'text-academic-teal' : 'text-emerald-500'} w-10 h-10`} /> :
                         <FileText className={`${isCompleted ? 'text-academic-teal' : 'text-academic-teal'} w-10 h-10`} />
                        }
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-black text-navy-700 tracking-wider">
                              {file.fileType.toUpperCase()}
                            </span>
                             <div className="w-1 h-1 rounded-full bg-slate-300" />
                             <span className="text-[10px] font-bold text-slate-400 capitalize">{getSubName(file.subjectId)}</span>
                          </div>
                          <button 
                            onClick={() => toggleProgress(file.id, 'file')}
                            className={`p-1.5 rounded-lg transition-all ${isCompleted ? 'bg-academic-teal text-white' : 'bg-slate-100 text-slate-400 hover:text-academic-teal hover:bg-academic-teal/10'}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="text-xl font-bold text-navy-900 mb-1 tracking-tight">{file.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-1">{file.description}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <a 
                            href={file.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-academic-teal font-black text-xs hover:text-navy-900 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            تحميل للمطالعة
                          </a>
                          {isCompleted && <span className="text-[10px] font-black text-academic-teal">مكتمل</span>}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeSection === 'tips' && (
            <motion.div
              key="tips"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto px-6 pb-24 pt-8"
            >
              <header className="text-center mb-16">
                <h2 className="text-4xl font-black text-navy-900 mb-4 tracking-tighter">نصائح <span className="text-academic-gold">للتفوق الدراسي</span></h2>
                <p className="text-slate-500 font-medium">خطوات عملية نحو النجاح الأكاديمي والمهني.</p>
              </header>
              <div className="grid grid-cols-1 gap-6">
                {tips.map((tip) => (
                  <div key={tip.id} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-6 group hover:border-academic-gold transition-colors">
                    <div className="p-4 bg-slate-50 rounded-xl group-hover:bg-academic-gold/10 transition-colors">
                      <Lightbulb className="w-8 h-8 text-academic-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-navy-900 tracking-tight">{tip.title}</h3>
                        {tip.isNew && <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded uppercase">جديد</span>}
                      </div>
                      <p className="text-slate-600 leading-relaxed font-bold">{tip.content}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-4 uppercase">{new Date(tip.date).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'announcements' && (
            <motion.div
              key="announcements"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto px-6 pb-24 pt-8"
            >
              <header className="text-center mb-16">
                <div className="w-16 h-16 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-navy-700">
                  <Bell className="text-academic-gold w-8 h-8" />
                </div>
                <h2 className="text-5xl font-black text-navy-900 mb-4 tracking-tighter">إعلانات <span className="text-academic-teal">المنصة</span></h2>
                <p className="text-slate-500 font-medium text-lg">ابقَ على اطلاع بأحدث الأخبار والفعاليات الأكاديمية.</p>
              </header>

              <div className="space-y-12">
                {posts.map(post => (
                  <motion.div 
                    key={post.id} 
                    className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden"
                  >
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}`} className="w-12 h-12 rounded-full border-2 border-slate-100" />
                          <div>
                            <h4 className="font-black text-navy-900 text-lg">{post.authorName}</h4>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">المسؤول الأكاديمي • {post.createdAt.toLocaleDateString('ar-EG')}</p>
                          </div>
                       </div>
                       {isAdmin && (
                         <button 
                          onClick={() => deleteItem('posts', post.id)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                         >
                           <Trash2 className="w-5 h-5" />
                         </button>
                       )}
                    </div>
                    <div className="p-8">
                       <h3 className="text-2xl font-black text-navy-900 mb-4 tracking-tight">{post.title}</h3>
                       <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap">{post.content}</p>
                    </div>
                    <div className="bg-slate-50 p-8 space-y-6">
                       <h5 className="font-black text-navy-900 flex items-center gap-2">
                         <MessageSquare className="w-5 h-5 text-academic-teal" />
                         المناقشات الأكاديمية ({comments.filter(c => c.postId === post.id).length})
                       </h5>
                       
                       <div className="space-y-4">
                         {comments.filter(c => c.postId === post.id).map(comment => (
                           <div key={comment.id} className="flex gap-4 items-start">
                             <img src={comment.userPhoto || `https://ui-avatars.com/api/?name=${comment.userName}`} className="w-8 h-8 rounded-full shadow-sm" />
                             <div className="flex-grow bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-black text-navy-900">{comment.userName}</span>
                                  {(isAdmin || user?.uid === comment.userId) && (
                                    <button 
                                      onClick={() => deleteItem('comments', comment.id)}
                                      className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600">{comment.content}</p>
                                <span className="absolute -bottom-5 left-0 text-[8px] text-slate-400 font-bold uppercase">{comment.createdAt.toLocaleDateString('ar-EG')}</span>
                             </div>
                           </div>
                         ))}
                       </div>

                       {user ? (
                         <form 
                          className="flex gap-4 mt-8"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const input = form.elements.namedItem('comment') as HTMLInputElement;
                            if (input.value.trim()) {
                              handleAddComment(post.id, input.value);
                              input.value = '';
                            }
                          }}
                         >
                           <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" />
                           <div className="flex-grow relative">
                             <input 
                              name="comment"
                              placeholder="أضف تعليقاً أكاديمياً..." 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-academic-teal transition-all pr-12 font-bold"
                             />
                             <button type="submit" className="absolute left-2 top-1/2 -translate-y-1/2 text-academic-teal hover:text-navy-900 transition-colors">
                               <Send className="w-5 h-5 ltr-flip" />
                             </button>
                           </div>
                         </form>
                       ) : (
                         <div className="bg-white p-4 rounded-xl border border-slate-100 text-center">
                            <p className="text-xs text-slate-400 font-bold">يرجى <button onClick={() => setShowLogin(true)} className="text-academic-teal underline">تسجيل الدخول</button> للمشاركة في النقاش.</p>
                         </div>
                       )}
                    </div>
                  </motion.div>
                ))}

                {posts.length === 0 && (
                  <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-black">لا توجد إعلانات نشطة حالياً.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeSection === 'terms' && (
            <motion.div
              key="terms"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-5xl mx-auto px-6 pb-24 pt-8"
            >
              <header className="mb-16 text-center">
                 <h2 className="text-4xl font-black text-navy-900 mb-4 tracking-tighter">قاموس <span className="text-academic-teal">المصطلحات</span></h2>
                 <p className="text-slate-500 font-medium">دليلك الشخصي لفهم أسرار العلوم الإدارية.</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {terms.map(term => (
                  <div key={term.id} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <span className="inline-block px-3 py-1 bg-slate-100 text-[10px] font-black text-navy-600 rounded-md mb-4 uppercase tracking-widest">{term.category}</span>
                    <h3 className="text-2xl font-black text-navy-900 mb-3 tracking-tight">{term.term}</h3>
                    <p className="text-slate-600 font-bold mb-4">{term.definition}</p>
                    {term.example && (
                      <div className="p-4 bg-slate-50 rounded-xl border-r-4 border-academic-gold">
                         <p className="text-xs text-slate-500 italic"><span className="font-bold text-navy-900 not-italic">مثال:</span> {term.example}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeSection === 'admin' && isAdmin && (
            <AdminPanel 
              subjects={subjects} 
              lectures={lectures} 
              files={files} 
              terms={terms}
              tips={tips}
              posts={posts}
              onAddLecture={handleAddLecture}
              onUpdateLecture={handleUpdateLecture}
              onAddFile={handleAddFile}
              onUpdateFile={handleUpdateFile}
              onDeleteLecture={(id: string) => deleteItem('lectures', id)}
              onDeleteFile={(id: string) => deleteItem('files', id)}
              onDeleteSubject={(id: string) => deleteItem('subjects', id)}
              onAddSubject={handleAddSubject}
              onUpdateSubject={handleUpdateSubject}
              onAddTerm={handleAddTerm}
              onUpdateTerm={handleUpdateTerm}
              onDeleteTerm={(id: string) => deleteItem('terms', id)}
              onAddTip={handleAddTip}
              onUpdateTip={handleUpdateTip}
              onDeleteTip={(id: string) => deleteItem('tips', id)}
              onAddPost={handleAddPost}
              onUpdatePost={handleUpdatePost}
              onDeletePost={(id: string) => deleteItem('posts', id)}
            />
          )}
        </AnimatePresence>
      </main>

      {/* --- Footer --- */}
      <footer className="academic-gradient py-20 px-6 text-white overflow-hidden relative">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                <GraduationCap className="text-academic-gold w-7 h-7" />
              </div>
              <h4 className="text-2xl font-black tracking-tight">Atallm <span className="text-academic-gold">Academy</span></h4>
            </div>
            <p className="text-slate-400 leading-relaxed font-medium">
              المنصة رقم #1 المتخصصة في دعم طلاب كليات التجارة بالوطن العربي عبر أحدث الوسائل التعليمية التفاعلية.
            </p>
          </div>
          
          <div>
            <h5 className="text-lg font-black text-academic-gold mb-8 uppercase tracking-widest">روابط سريعة</h5>
            <ul className="space-y-4 font-bold text-slate-300">
              <li><button onClick={()=>setActiveSection('lectures')} className="hover:text-white transition-colors">المحاضرات المرئية</button></li>
              <li><button onClick={()=>setActiveSection('files')} className="hover:text-white transition-colors">المكتبة الرقمية</button></li>
              <li><button onClick={()=>setActiveSection('terms')} className="hover:text-white transition-colors">قاموس المصطلحات</button></li>
              <li><button onClick={()=>setShowLogin(true)} className="hover:text-white transition-colors">إدارة النظام</button></li>
            </ul>
          </div>

          <div>
             <h5 className="text-lg font-black text-academic-gold mb-8 uppercase tracking-widest">الموافقة الأكاديمية</h5>
             <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-academic-teal w-5 h-5" />
                  <span className="text-sm font-bold text-slate-200">جميع المحتويات مراجعة علمياً</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-academic-teal w-5 h-5" />
                  <span className="text-sm font-bold text-slate-200">تحديث مستمر للمناهج</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="text-academic-teal w-5 h-5" />
                  <span className="text-sm font-bold text-slate-200">وصول مجاني لكافة الطلاب</span>
                </div>
             </div>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-slate-500 text-xs font-bold font-mono tracking-widest uppercase">
          <p>&copy; {new Date().getFullYear()} ATALLM ACADEMY | ALL RIGHTS RESERVED</p>
          <p className="mt-4 md:mt-0">DESIGNED BY ACADEMIC ENGINEERING DIVISION</p>
        </div>
      </footer>

      <Toast notification={notification} onClose={() => setNotification(null)} />

      {/* --- Modals --- */}
      {showLogin && (
        <LoginModal 
          onClose={() => setShowLogin(false)} 
          showToast={showToast}
        />
      )}

      {videoModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300" onClick={() => setVideoModal(null)}>
          <button className="absolute top-8 left-8 text-white/50 hover:text-white transition-colors" onClick={() => setVideoModal(null)}>
            <X className="w-10 h-10" />
          </button>
          <div className="w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <iframe 
              src={videoModal} 
              className="w-full h-full" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-Components ---

function AdminPanel({ 
  subjects, lectures, files, terms, tips, posts,
  onAddLecture, onUpdateLecture, onAddFile, onUpdateFile, onDeleteLecture, onDeleteFile, onDeleteSubject, onAddSubject, onUpdateSubject, onAddTerm, onUpdateTerm, onDeleteTerm,
  onAddTip, onUpdateTip, onDeleteTip, onAddPost, onUpdatePost, onDeletePost
}: any) {
  const [tab, setTab] = useState<'lectures' | 'files' | 'subjects' | 'terms' | 'tips' | 'announcements'>('lectures');
  const [formData, setFormData] = useState<any>({});
  const [editingItem, setEditingItem] = useState<any>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'lectures') {
      if (editingItem) onUpdateLecture(editingItem.id, formData);
      else onAddLecture(formData);
    }
    else if (tab === 'files') {
      if (editingItem) onUpdateFile(editingItem.id, formData);
      else onAddFile(formData);
    }
    else if (tab === 'subjects') {
      if (editingItem) onUpdateSubject(editingItem.id, formData);
      else onAddSubject(formData);
    }
    else if (tab === 'terms') {
      if (editingItem) onUpdateTerm(editingItem.id, formData);
      else onAddTerm(formData);
    }
    else if (tab === 'tips') {
      if (editingItem) onUpdateTip(editingItem.id, formData);
      else onAddTip(formData);
    }
    else if (tab === 'announcements') {
      if (editingItem) onUpdatePost(editingItem.id, formData);
      else onAddPost(formData);
    }
    setFormData({});
    setEditingItem(null);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24 pt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
           <h2 className="text-4xl font-black text-navy-900 flex items-center gap-4 tracking-tighter">
             <ShieldCheck className="text-academic-teal w-12 h-12" />
             بوابـة الإدارة
           </h2>
           <p className="text-slate-500 font-medium mt-1">إخلاء مسؤولية: أنت الآن في النطاق الإداري للمنصة.</p>
        </div>
      </div>

      <div className="flex gap-3 mb-12 overflow-x-auto pb-4 no-scrollbar">
        {[
          { id: 'lectures', label: 'المحاضرات', icon: Video },
          { id: 'files', label: 'الملفات', icon: FileText },
          { id: 'subjects', label: 'التخصصات', icon: Book },
          { id: 'terms', label: 'المصطلحات', icon: BookOpen },
          { id: 'tips', label: 'النصائح', icon: Lightbulb },
          { id: 'announcements', label: 'الإعلانات', icon: Bell },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => {setTab(t.id as any); setFormData({}); setEditingItem(null);}}
            className={`flex items-center gap-3 px-8 py-4 rounded-xl font-black whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-navy-900 text-white shadow-xl translate-y-[-2px]' : 'bg-white text-slate-500 border border-slate-200 hover:text-navy-900'
            }`}
          >
            <t.icon className="w-5 h-5 transition-colors" style={{ color: tab === t.id ? 'var(--color-academic-gold)' : '' }} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Form */}
        <section className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none" />
          <h3 className="text-2xl font-black text-navy-900 mb-8 flex items-center justify-between">
            <span>{editingItem ? 'تعديل' : 'إضافة'} {tab === 'lectures' ? 'محاضرة' : tab === 'files' ? 'ملف' : tab === 'subjects' ? 'تخصص' : 'مصطلح'}</span>
            {editingItem ? <Edit3 className="w-6 h-6 text-academic-gold" /> : <Plus className="w-6 h-6 text-academic-gold" />}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {tab === 'lectures' && (
              <>
                <Input label="عنوان المحاضرة المعتمد" value={formData.title} onChange={(v: string) => setFormData({...formData, title: v})} />
                <TextArea label="وصف المحتوى الأكاديمي" value={formData.description} onChange={(v: string) => setFormData({...formData, description: v})} />
                <Input label="معرف فيديو يوتيوب" placeholder="مثال: dQw4w9WgXcQ" value={formData.videoUrl} onChange={(v: string) => setFormData({...formData, videoUrl: v})} />
                <Select 
                  label="تنسيب المادة الدراسية" 
                  value={formData.subjectId} 
                  options={subjects.map((s: any) => ({ value: s.id, label: s.nameAr }))} 
                  onChange={(v: string) => setFormData({...formData, subjectId: v})}
                />
              </>
            )}
            {tab === 'files' && (
              <>
                <Input label="الاسم الرمزي للمستند" value={formData.title} onChange={(v: string) => setFormData({...formData, title: v})} />
                <Input label="مسار الوصول الرقمي (Link)" value={formData.fileUrl} onChange={(v: string) => setFormData({...formData, fileUrl: v})} />
                <Select 
                  label="تصنيف التوسعة" 
                  value={formData.fileType} 
                  options={[{value: 'pdf', label: 'PDF Library'}, {value: 'xls', label: 'Spreadsheet'}, {value: 'doc', label: 'Document'}]} 
                  onChange={(v: string) => setFormData({...formData, fileType: v})}
                />
                <Select 
                  label="تنسيب المادة الدراسية" 
                  value={formData.subjectId} 
                  options={subjects.map((s: any) => ({ value: s.id, label: s.nameAr }))} 
                  onChange={(v: string) => setFormData({...formData, subjectId: v})}
                />
              </>
            )}
            {tab === 'subjects' && (
              <>
                <Input label="اسم التخصص (بالعربية)" value={formData.nameAr} onChange={(v: string) => setFormData({...formData, nameAr: v})} />
                <Input label="الاسم الدولي (English)" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} />
                <div className="space-y-2">
                  <label className="text-sm font-black text-navy-700">تخصيص الهوية اللونية</label>
                  <input 
                    type="color" 
                    value={formData.color || '#0F172A'} 
                    onChange={e => setFormData({...formData, color: e.target.value})}
                    className="w-full h-14 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer p-1.5 transition-all focus:border-academic-gold"
                  />
                </div>
              </>
            )}
            {tab === 'terms' && (
              <>
                <Input label="المصطلح العلمي" value={formData.term} onChange={(v: string) => setFormData({...formData, term: v})} />
                <Input label="التصنيف الوظيفي" value={formData.category} onChange={(v: string) => setFormData({...formData, category: v})} />
                <TextArea label="الشرح المفصل للمعنى" value={formData.definition} onChange={(v: string) => setFormData({...formData, definition: v})} />
              </>
            )}
            {tab === 'tips' && (
              <>
                <Input label="عنوان النصيحة" value={formData.title} onChange={(v: string) => setFormData({...formData, title: v})} />
                <TextArea label="محتوى النصيحة" value={formData.content} onChange={(v: string) => setFormData({...formData, content: v})} />
                <Input label="أيقونة (Lucide Icon name)" placeholder="Lightbulb, Zap, Award..." value={formData.icon} onChange={(v: string) => setFormData({...formData, icon: v})} />
              </>
            )}
            {tab === 'announcements' && (
              <>
                <Input label="عنوان الإعلان" value={formData.title} onChange={(v: string) => setFormData({...formData, title: v})} />
                <TextArea label="محتوى الإعلان التفصيلي" value={formData.content} onChange={(v: string) => setFormData({...formData, content: v})} />
              </>
            )}
            <button className="w-full py-5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4">
              <CheckCircle className="w-6 h-6 text-academic-gold" />
              {editingItem ? 'حفظ التعديلات' : 'تأكيد وحفظ التغييرات'}
            </button>
            {editingItem && (
              <button 
                type="button"
                onClick={() => {setEditingItem(null); setFormData({});}}
                className="w-full py-4 text-slate-500 font-bold hover:text-navy-900 transition-colors"
              >
                إلغاء التعديل
              </button>
            )}
          </form>
        </section>

        {/* List */}
        <section className="space-y-6">
           <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-8">
             <h3 className="text-2xl font-black text-navy-900 tracking-tight">السجلات النشطة ({
               tab === 'lectures' ? lectures.length : 
               tab === 'files' ? files.length : 
               tab === 'subjects' ? subjects.length : 
               tab === 'terms' ? terms.length :
               tab === 'tips' ? tips.length :
               posts.length
             })</h3>
             <BarChart3 className="text-slate-200 w-8 h-8" />
           </div>
           <div className="max-h-[650px] overflow-y-auto pr-3 space-y-4 custom-scrollbar">
              {(
                tab === 'lectures' ? lectures : 
                tab === 'files' ? files : 
                tab === 'subjects' ? subjects : 
                tab === 'terms' ? terms : 
                tab === 'tips' ? tips :
                posts
              ).map((item: any) => (
                <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between group transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-navy-900 border border-slate-100 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                      {tab === 'lectures' ? <Video className="w-6 h-6" /> : 
                       tab === 'files' ? <FileText className="w-6 h-6" /> : 
                       tab === 'subjects' ? <Book className="w-6 h-6" /> : 
                       tab === 'terms' ? <BookOpen className="w-6 h-6" /> :
                       tab === 'tips' ? <Lightbulb className="w-6 h-6" /> :
                       <Bell className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-navy-900 font-bold text-lg leading-tight">{item.title || item.nameAr || item.term}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">ID: {item.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-3 text-academic-teal bg-slate-50 rounded-lg hover:bg-academic-teal hover:text-white transition-all shadow-sm"
                      title="تعديل"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        if(confirm('تنبيه: سيتم حذف البيانات نهائياً من السجلات الأكاديمية. هل تود المتابعة؟')) {
                          if(tab === 'lectures') onDeleteLecture(item.id);
                          if(tab === 'files') onDeleteFile(item.id);
                          if(tab === 'subjects') onDeleteSubject(item.id);
                          if(tab === 'terms') onDeleteTerm(item.id);
                          if(tab === 'tips') onDeleteTip(item.id);
                          if(tab === 'announcements') onDeletePost(item.id);
                        }
                      }}
                      className="p-3 text-red-500 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                      title="حذف"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              
              {(
                tab === 'lectures' ? lectures : 
                tab === 'files' ? files : 
                tab === 'subjects' ? subjects : 
                tab === 'terms' ? terms :
                tab === 'tips' ? tips :
                posts
              ).length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold">لا توجد بيانات مسجلة حالياً في هذا القسم.</p>
                </div>
              )}
           </div>
        </section>
      </div>
    </div>
  );
}

function LoginModal({ onClose, showToast }: any) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  const ADMIN_EMAIL = 'ahmedgamalahmed159@gmail.com';

  useEffect(() => {
    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      setShowAdminPass(true);
    } else {
      setShowAdminPass(false);
      setPassword('');
    }
  }, [email]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      showToast('تم تسجيل الدخول بنجاح.');
      onClose();
    } catch (error) {
      showToast('التحقق من الهوية فشل. يرجى مراجعة الصلاحيات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== '333555') {
      showToast('كلمة المرور الإدارية غير صحيحة.', 'error');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(ADMIN_EMAIL, password);
      showToast('مرحباً بك في لوحة الإدارة.');
      onClose();
    } catch (error: any) {
      showToast('فشل الدخول: ' + (error.message || 'خطأ غير متوقع'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-navy-950/80 backdrop-blur-xl flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white p-12 rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-full h-2 bg-academic-gold" />
        <button onClick={onClose} className="absolute top-10 left-10 text-slate-400 hover:text-navy-900 transition-colors">
          <X className="w-8 h-8" />
        </button>
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 bg-navy-900 rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-navy-700">
            <ShieldCheck className="text-academic-gold w-12 h-12" />
          </div>
          <h3 className="text-4xl font-black text-navy-900 mb-2 tracking-tighter">بوابة الوصول الموحد</h3>
          <p className="text-slate-500 font-bold">يرجى تسجيل الدخول لمتابعة مسيرتك الأكاديمية.</p>
        </div>

        <div className="space-y-6">
          {/* Main Login Options */}
          {!showAdminPass ? (
            <>
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-6 bg-white border-2 border-slate-200 hover:border-academic-gold text-navy-900 rounded-xl font-black text-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-4 group"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-navy-900/10 border-t-navy-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="" />
                    تسجيل دخول الطلاب (Google)
                  </>
                )}
              </button>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-xs font-black uppercase tracking-widest">أو دخول الإدارة</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>
            </>
          ) : (
            <div className="bg-navy-50 p-6 rounded-xl border border-navy-100 mb-4">
               <p className="text-navy-900 font-black text-center mb-2">تم اكتشاف هوية إدارية</p>
               <p className="text-slate-500 text-xs text-center font-bold">يرجى إكمال بيانات التحقق للوصول للوحة التحكم.</p>
            </div>
          )}

          {/* Email Input (Always present, but logic shifts) */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1 block mr-2">عنوان البريد الأكاديمي</label>
              <input 
                type="email"
                placeholder="example@atallm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-academic-gold/20 focus:border-academic-gold transition-all placeholder:text-slate-300 font-medium ltr"
              />
            </div>

            <AnimatePresence>
              {showAdminPass && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-4"
                >
                  <div>
                    <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1 block mr-2">كلمة المرور الإدارية</label>
                    <input 
                      type="password"
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-academic-gold/20 focus:border-academic-gold transition-all placeholder:text-slate-300 font-medium"
                    />
                  </div>
                  <button 
                    onClick={handleAdminLogin}
                    disabled={loading}
                    className="w-full py-5 bg-navy-900 hover:bg-navy-800 text-white rounded-xl font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/20 border-t-academic-gold rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-6 h-6 text-academic-gold" />
                        تأكيد دخول المسؤول
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Dynamic Form Elements ---

function Toast({ notification, onClose }: { notification: { message: string; type: 'success' | 'error' } | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className={`fixed bottom-10 left-1/2 z-[300] px-8 py-4 rounded-xl shadow-2xl flex items-center gap-4 min-w-[320px] ${
            notification.type === 'success' ? 'bg-navy-900 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-6 h-6 text-academic-gold" />
          ) : (
            <Bell className="w-6 h-6 text-white" />
          )}
          <span className="font-bold text-sm flex-grow">{notification.message}</span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Input({ label, value, onChange, placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-black text-navy-700 mr-2 uppercase tracking-wide">{label}</label>
      <input 
        type="text" 
        value={value || ''} 
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-academic-gold/20 focus:border-academic-gold transition-all placeholder:text-slate-300 font-medium"
      />
    </div>
  );
}

function TextArea({ label, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-black text-navy-700 mr-2 uppercase tracking-wide">{label}</label>
      <textarea 
        rows={4}
        value={value || ''} 
        onChange={e => onChange(e.target.value)}
        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-academic-gold/20 focus:border-academic-gold transition-all resize-none font-medium"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-black text-navy-700 mr-2 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select 
          value={value || ''} 
          onChange={e => onChange(e.target.value)}
          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 focus:outline-none focus:ring-2 focus:ring-academic-gold/20 focus:border-academic-gold appearance-none font-bold cursor-pointer"
        >
          <option value="">تحديد الخيار المناسب...</option>
          {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
           <ChevronRight className="w-5 h-5 rotate-90" />
        </div>
      </div>
    </div>
  );
}
