import React, { useState, useEffect, useRef, createContext, useContext, Component } from "react";
import { 
  LayoutDashboard, BookOpen, Video, ClipboardList, Users, Settings, LogOut, 
  Search, Bell, ChevronRight, Star, Clock, Play, CheckCircle, Upload, Plus, 
  Trash2, Edit, ArrowLeft, Award, Target, Zap, TrendingUp, User, ChevronDown,
  Menu, X, Filter, MoreVertical, ExternalLink, Download, Share2, Info, VideoOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { COLORS, COURSES, QUIZZES, STATS } from "./constants";
import { UserRole, Course, Quiz, Stat, UserProfile } from "./types";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, 
  updateDoc, deleteDoc, Timestamp, serverTimestamp, FirebaseUser
} from "./firebase";

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  role: UserRole | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within a FirebaseProvider");
  return context;
};

const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch or create user profile in Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setRole(userDoc.data().role as UserRole);
        } else {
          // Default role is student, unless it's the admin email
          const defaultRole: UserRole = firebaseUser.email === "vilvanathanvbmpk@gmail.com" ? "admin" : "student";
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: defaultRole,
            createdAt: serverTimestamp(),
          });
          setRole(defaultRole);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Error Boundary ---

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  props: any;
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", color: COLORS.text }}>
          <h2 style={{ marginBottom: "20px" }}>Something went wrong.</h2>
          <pre style={{ backgroundColor: COLORS.surfaceHigh, padding: "20px", borderRadius: "8px", overflow: "auto", maxWidth: "100%" }}>
            {typeof this.state.error === 'object' ? JSON.stringify(this.state.error, null, 2) : String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: "20px", padding: "12px 24px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return (this.props as any).children;
  }
}

// --- Custom Hooks for Firestore ---

const useFirestoreCollection = <T,>(collectionPath: string, constraints: any[] = []) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, collectionPath), ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error(`Error fetching ${collectionPath}:`, err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionPath, constraints.length]); // Simple dependency check for constraints length

  return { data, loading, error };
};

// --- Helper Components ---

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span style={{
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    backgroundColor: `${color}15`,
    color: color,
    border: `1px solid ${color}30`,
  }}>
    {children}
  </span>
);

const ProgressBar = ({ progress, color = COLORS.accent }: { progress: number; color?: string }) => (
  <div style={{ width: "100%", height: "8px", backgroundColor: COLORS.surfaceHigh, borderRadius: "4px", overflow: "hidden" }}>
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      style={{ height: "100%", backgroundColor: color }}
    />
  </div>
);

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) => (
  <div style={{
    backgroundColor: COLORS.surface,
    padding: "24px",
    borderRadius: "16px",
    border: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    gap: "20px",
  }}>
    <div style={{
      width: "56px",
      height: "56px",
      borderRadius: "14px",
      backgroundColor: `${color}15`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: color,
    }}>
      <Icon size={28} />
    </div>
    <div>
      <p style={{ color: COLORS.textMuted, fontSize: "14px", fontWeight: 500, marginBottom: "4px" }}>{label}</p>
      <h3 style={{ color: COLORS.text, fontSize: "24px", fontWeight: 700 }}>{value}</h3>
    </div>
  </div>
);

const Toast = ({ message, videoUrl, onClose }: { message: string; videoUrl?: string; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
    style={{
      position: "fixed",
      bottom: "40px",
      right: "40px",
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.emerald}`,
      borderRadius: "16px",
      padding: "20px 24px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      zIndex: 1000,
      minWidth: "320px"
    }}
  >
    <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: `${COLORS.emerald}20`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald }}>
      <CheckCircle size={24} />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ color: COLORS.text, fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>Success!</p>
      <p style={{ color: COLORS.textMuted, fontSize: "13px" }}>{message}</p>
      {videoUrl && (
        <a 
          href={videoUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "6px", 
            marginTop: "8px", 
            color: COLORS.accent, 
            fontSize: "13px", 
            fontWeight: 600, 
            textDecoration: "none" 
          }}
        >
          View Video <ExternalLink size={14} />
        </a>
      )}
    </div>
    <button 
      onClick={onClose}
      style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", padding: "4px" }}
    >
      <X size={18} />
    </button>
  </motion.div>
);

// --- Page Components ---

const LoginScreen = () => {
  const { login } = useAuth();

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.primary,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "48px",
          backgroundColor: COLORS.surface,
          borderRadius: "24px",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ 
            width: "64px", height: "64px", backgroundColor: COLORS.accent, borderRadius: "18px", 
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
            color: "white", boxShadow: `0 10px 20px ${COLORS.accent}40`
          }}>
            <BookOpen size={32} style={{ margin: "auto" }} />
          </div>
          <h1 style={{ color: COLORS.text, fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>EduCloud</h1>
          <p style={{ color: COLORS.textMuted }}>Sign in to your learning account</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <button 
            onClick={login}
            style={{
              width: "100%", padding: "16px", backgroundColor: "white", color: "#1f2937",
              borderRadius: "12px", border: "none", fontWeight: 700, fontSize: "16px",
              cursor: "pointer", marginTop: "12px", transition: "transform 0.1s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
            }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: "20px", height: "20px" }} />
            Sign in with Google
          </button>

          <p style={{ color: COLORS.textDim, fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const AdminDashboardPage = ({ onNavigate }: { onNavigate: (tab: string) => void }) => {
  const { data: courses } = useFirestoreCollection<Course>("courses");
  const { data: quizzes } = useFirestoreCollection<Quiz>("quizzes");
  const { data: users } = useFirestoreCollection<UserProfile>("users");
  
  const stats = {
    courses: courses.length > 0 ? courses.length : STATS.courses,
    students: users.length > 0 ? users.length : STATS.students,
    quizzes: quizzes.length > 0 ? quizzes.length : STATS.quizzes,
    videos: STATS.videos // Fallback for now
  };

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Platform Overview</h2>
        <p style={{ color: COLORS.textMuted }}>Real-time performance metrics for your e-learning ecosystem.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginBottom: "40px" }}>
        <StatCard label="Total Courses" value={stats.courses} icon={BookOpen} color={COLORS.accent} />
        <StatCard label="Active Students" value={stats.students.toLocaleString()} icon={Users} color={COLORS.emerald} />
        <StatCard label="Quizzes Completed" value={stats.quizzes} icon={ClipboardList} color={COLORS.gold} />
        <StatCard label="Video Content" value={`${stats.videos}h`} icon={Video} color={COLORS.rose} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        <div style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "20px", border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "24px" }}>Recent Enrollments</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {users.slice(0, 4).map((user, i) => (
              <div key={user.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", backgroundColor: COLORS.surfaceHigh, borderRadius: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                    {user.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <p style={{ color: COLORS.text, fontWeight: 600 }}>{user.name || "Anonymous User"}</p>
                    <p style={{ color: COLORS.textMuted, fontSize: "13px" }}>{user.email}</p>
                  </div>
                </div>
                <span style={{ color: COLORS.textDim, fontSize: "13px" }}>{user.role}</span>
              </div>
            ))}
            {users.length === 0 && [1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", backgroundColor: COLORS.surfaceHigh, borderRadius: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>U</div>
                  <div>
                    <p style={{ color: COLORS.text, fontWeight: 600 }}>Student Name {i}</p>
                    <p style={{ color: COLORS.textMuted, fontSize: "13px" }}>Enrolled in React Patterns</p>
                  </div>
                </div>
                <span style={{ color: COLORS.textDim, fontSize: "13px" }}>2 hours ago</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "20px", border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "24px" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button 
              onClick={() => onNavigate("videos")}
              style={{ padding: "14px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Video size={18} /> Manage Videos
            </button>
            <button 
              onClick={() => onNavigate("courses")}
              style={{ padding: "14px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Create New Course
            </button>
            <button style={{ padding: "14px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}>Generate Report</button>
            <button style={{ padding: "14px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}>Manage Users</button>
          </div>
        </div>
      </div>
    </div>
  );
};


const QuizForm = ({ onClose }: { onClose: () => void }) => {
  const [formData, setFormData] = useState({
    title: "",
    course: "",
    questions: 10,
    time: 15,
    passing: 70,
    attempts: 0,
    avgScore: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "quizzes"), {
        ...formData,
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      console.error("Error creating quiz:", err);
      alert("Failed to create quiz.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", width: "100%", maxWidth: "500px", border: `1px solid ${COLORS.border}` }}
      >
        <h3 style={{ color: COLORS.text, fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>Create New Quiz</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input 
            placeholder="Quiz Title" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})}
            required
            style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          />
          <input 
            placeholder="Course Name" 
            value={formData.course} 
            onChange={e => setFormData({...formData, course: e.target.value})}
            required
            style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: COLORS.textMuted, fontSize: "12px" }}>Questions</label>
              <input 
                type="number"
                value={formData.questions} 
                onChange={e => setFormData({...formData, questions: parseInt(e.target.value)})}
                style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ color: COLORS.textMuted, fontSize: "12px" }}>Time (mins)</label>
              <input 
                type="number"
                value={formData.time} 
                onChange={e => setFormData({...formData, time: parseInt(e.target.value)})}
                style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ color: COLORS.textMuted, fontSize: "12px" }}>Passing Score (%)</label>
            <input 
              type="number"
              value={formData.passing} 
              onChange={e => setFormData({...formData, passing: parseInt(e.target.value)})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: "12px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{ flex: 1, padding: "12px", borderRadius: "12px", backgroundColor: COLORS.accent, color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Create Quiz
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const QuizAdminPage = () => {
  const { data: quizzes, loading } = useFirestoreCollection<Quiz>("quizzes");
  const [isAddingQuiz, setIsAddingQuiz] = useState(false);
  const displayQuizzes = quizzes.length > 0 ? quizzes : QUIZZES;

  const handleDeleteQuiz = async (id: string) => {
    if (confirm("Are you sure you want to delete this quiz?")) {
      try {
        await deleteDoc(doc(db, "quizzes", id));
      } catch (err) {
        console.error("Error deleting quiz:", err);
        alert("Failed to delete quiz.");
      }
    }
  };

  const handleAddMockQuizzes = async () => {
    if (confirm("Add mock quizzes to Firestore?")) {
      try {
        for (const quiz of QUIZZES) {
          const { id, ...quizData } = quiz;
          await addDoc(collection(db, "quizzes"), {
            ...quizData,
            createdAt: serverTimestamp()
          });
        }
        alert("Mock quizzes added!");
      } catch (err) {
        console.error("Error adding mock quizzes:", err);
        alert("Failed to add mock quizzes.");
      }
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
        <div>
          <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Quiz Management</h2>
          <p style={{ color: COLORS.textMuted }}>Create and monitor student assessments.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {quizzes.length === 0 && (
            <button 
              onClick={handleAddMockQuizzes}
              style={{ padding: "12px 24px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Seed Mock Quizzes
            </button>
          )}
          <button 
            onClick={() => setIsAddingQuiz(true)}
            style={{ padding: "12px 24px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={18} /> Create Quiz
          </button>
        </div>
      </div>

      {isAddingQuiz && <QuizForm onClose={() => setIsAddingQuiz(false)} />}

      <div style={{ backgroundColor: COLORS.surface, borderRadius: "20px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <th style={{ padding: "20px 24px", color: COLORS.textMuted, fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}>Quiz Title</th>
              <th style={{ padding: "20px 24px", color: COLORS.textMuted, fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}>Course</th>
              <th style={{ padding: "20px 24px", color: COLORS.textMuted, fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}>Questions</th>
              <th style={{ padding: "20px 24px", color: COLORS.textMuted, fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}>Avg. Score</th>
              <th style={{ padding: "20px 24px", color: COLORS.textMuted, fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && quizzes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: COLORS.textMuted }}>Loading quizzes...</td>
              </tr>
            ) : (
              displayQuizzes.map(quiz => (
                <tr key={quiz.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "20px 24px", color: COLORS.text, fontWeight: 600 }}>{quiz.title}</td>
                  <td style={{ padding: "20px 24px", color: COLORS.textMuted }}>{quiz.course}</td>
                  <td style={{ padding: "20px 24px", color: COLORS.textMuted }}>{quiz.questions} Qs</td>
                  <td style={{ padding: "20px 24px" }}>
                    <span style={{ color: COLORS.emerald, fontWeight: 700 }}>{quiz.avgScore}%</span>
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button style={{ color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer" }}><Edit size={18} /></button>
                      <button 
                        onClick={() => quiz.id && handleDeleteQuiz(quiz.id)}
                        style={{ color: COLORS.rose, background: "none", border: "none", cursor: "pointer" }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StudentDashboardPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: courses, loading: coursesLoading } = useFirestoreCollection<Course>("courses");
  const { data: progress, loading: progressLoading } = useFirestoreCollection<any>("progress", [where("uid", "==", user?.uid || "")]);
  
  const enrolledCourseIds = progress.map(p => p.courseId);
  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id?.toString()));
  
  const displayCourses = enrolledCourses.length > 0 ? enrolledCourses : [];
  const loading = coursesLoading || progressLoading;

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Welcome back, {user?.displayName || "Student"}!</h2>
        <p style={{ color: COLORS.textMuted }}>You are enrolled in {enrolledCourses.length} courses.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "32px" }}>
        <div>
          <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "24px" }}>Continue Learning</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {loading ? (
              <div style={{ color: COLORS.textMuted }}>Loading your courses...</div>
            ) : displayCourses.length > 0 ? (
              displayCourses.map(course => {
                const courseProgress = progress.find(p => p.courseId === course.id?.toString())?.percent || 0;
                return (
                  <div 
                    key={course.id} 
                    onClick={() => onSelectCourse(course)}
                    style={{ backgroundColor: COLORS.surface, padding: "24px", borderRadius: "20px", border: `1px solid ${COLORS.border}`, display: "flex", gap: "24px", cursor: "pointer" }}
                  >
                    <div style={{ width: "120px", height: "80px", borderRadius: "12px", backgroundColor: course.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>
                      {course.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div>
                          <Badge color={course.color}>{course.cat}</Badge>
                          <h4 style={{ color: COLORS.text, fontSize: "18px", fontWeight: 700, marginTop: "8px" }}>{course.title}</h4>
                        </div>
                        <span style={{ color: COLORS.textMuted, fontSize: "14px", fontWeight: 600 }}>{courseProgress}% Complete</span>
                      </div>
                      <ProgressBar progress={courseProgress} color={course.color} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "40px", textAlign: "center", backgroundColor: COLORS.surface, borderRadius: "20px", border: `1px dashed ${COLORS.border}` }}>
                <BookOpen size={48} style={{ color: COLORS.textDim, marginBottom: "16px" }} />
                <p style={{ color: COLORS.text }}>You haven't enrolled in any courses yet.</p>
                <p style={{ color: COLORS.textMuted, fontSize: "14px", marginTop: "8px" }}>Check out the Course Catalog to get started!</p>
              </div>
            )}
          </div>
        </div>

      <div style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
        <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "24px" }}>Your Stats</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: `${COLORS.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.gold }}>
              <Award size={24} />
            </div>
            <div>
              <p style={{ color: COLORS.text, fontWeight: 700, fontSize: "18px" }}>12</p>
              <p style={{ color: COLORS.textMuted, fontSize: "13px" }}>Certificates Earned</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.accent }}>
              <Zap size={24} />
            </div>
            <div>
              <p style={{ color: COLORS.text, fontWeight: 700, fontSize: "18px" }}>450</p>
              <p style={{ color: COLORS.textMuted, fontSize: "13px" }}>Learning Points</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: `${COLORS.emerald}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald }}>
              <Target size={24} />
            </div>
            <div>
              <p style={{ color: COLORS.text, fontWeight: 700, fontSize: "18px" }}>85%</p>
              <p style={{ color: COLORS.textMuted, fontSize: "13px" }}>Avg. Quiz Score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

const CourseCatalogPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: courses, loading: coursesLoading } = useFirestoreCollection<Course>("courses");
  const { data: progress, loading: progressLoading } = useFirestoreCollection<any>("progress", [where("uid", "==", user?.uid || "")]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const enrolledCourseIds = progress.map(p => p.courseId);
  const displayCourses = courses.length > 0 ? courses : COURSES;
  const loading = coursesLoading || progressLoading;

  const handleEnroll = async (courseId: string | number) => {
    if (!user) {
      alert("Please sign in to enroll.");
      return;
    }
    try {
      await addDoc(collection(db, "progress"), {
        uid: user.uid,
        courseId: courseId.toString(),
        percent: 0,
        lastAccessed: serverTimestamp()
      });
      
      // Increment enrolled count in course document
      const courseRef = doc(db, "courses", courseId.toString());
      const courseSnap = await getDoc(courseRef);
      if (courseSnap.exists()) {
        await updateDoc(courseRef, {
          enrolled: (courseSnap.data().enrolled || 0) + 1
        });
      }
      alert("Successfully enrolled!");
    } catch (err) {
      console.error("Enrollment error:", err);
      alert("Failed to enroll.");
    }
  };

  const filteredCourses = displayCourses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
        <div>
          <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Course Catalog</h2>
          <p style={{ color: COLORS.textMuted }}>Explore our wide range of professional courses.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: COLORS.textDim }} />
            <input 
              type="text" 
              placeholder="Search courses..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "12px 12px 12px 40px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", color: COLORS.text, outline: "none", width: "240px" }}
            />
          </div>
          <button style={{ padding: "12px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", color: COLORS.text }}><Filter size={18} /></button>
        </div>
      </div>

      {loading && courses.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Loading catalog...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
          {filteredCourses.map(course => (
            <motion.div 
              key={course.id}
              whileHover={{ y: -5 }}
              onClick={() => onSelectCourse(course)}
              style={{ backgroundColor: COLORS.surface, borderRadius: "20px", border: `1px solid ${COLORS.border}`, overflow: "hidden", cursor: "pointer" }}
            >
              <div style={{ height: "160px", backgroundColor: course.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "64px" }}>
                {course.emoji}
              </div>
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <Badge color={course.color}>{course.cat}</Badge>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: COLORS.gold, fontSize: "14px", fontWeight: 700 }}>
                    <Star size={14} fill={COLORS.gold} /> {course.rating}
                  </div>
                </div>
                <h4 style={{ color: COLORS.text, fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{course.title}</h4>
                <p style={{ color: COLORS.textMuted, fontSize: "14px", marginBottom: "20px" }}>By {course.instructor}</p>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "20px", borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: COLORS.textDim, fontSize: "13px" }}>
                      <Clock size={14} /> {course.duration}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: COLORS.textDim, fontSize: "13px" }}>
                      <Users size={14} /> {course.enrolled}
                    </div>
                  </div>
                  {enrolledCourseIds.includes(course.id?.toString()) ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSelectCourse(course); }}
                      style={{ color: COLORS.emerald, fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      Continue <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEnroll(course.id!); }}
                      style={{ color: COLORS.accent, fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      Enroll Now <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const QuizListPage = ({ onSelectQuiz }: { onSelectQuiz: (quiz: Quiz) => void }) => {
  const { data: quizzes, loading } = useFirestoreCollection<Quiz>("quizzes");
  const displayQuizzes = quizzes.length > 0 ? quizzes : QUIZZES;

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Available Quizzes</h2>
        <p style={{ color: COLORS.textMuted }}>Test your knowledge and earn certifications.</p>
      </div>

      {loading && quizzes.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Loading quizzes...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
          {displayQuizzes.map(quiz => (
            <div key={quiz.id} style={{ backgroundColor: COLORS.surface, padding: "24px", borderRadius: "20px", border: `1px solid ${COLORS.border}` }}>
              <h4 style={{ color: COLORS.text, fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{quiz.title}</h4>
              <p style={{ color: COLORS.textMuted, fontSize: "14px", marginBottom: "20px" }}>Course: {quiz.course}</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                <div style={{ padding: "12px", backgroundColor: COLORS.surfaceHigh, borderRadius: "10px", textAlign: "center" }}>
                  <p style={{ color: COLORS.textDim, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>Questions</p>
                  <p style={{ color: COLORS.text, fontWeight: 700 }}>{quiz.questions}</p>
                </div>
                <div style={{ padding: "12px", backgroundColor: COLORS.surfaceHigh, borderRadius: "10px", textAlign: "center" }}>
                  <p style={{ color: COLORS.textDim, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>Time Limit</p>
                  <p style={{ color: COLORS.text, fontWeight: 700 }}>{quiz.time}m</p>
                </div>
              </div>

              <button 
                onClick={() => onSelectQuiz(quiz as Quiz)}
                style={{ width: "100%", padding: "14px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                Start Quiz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const QuizTakingPage = ({ quiz, onBack }: { quiz: Quiz; onBack: () => void }) => {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  
  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "8px", color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer", marginBottom: "32px", fontWeight: 600 }}>
        <ArrowLeft size={18} /> Back to Quizzes
      </button>

      <div style={{ backgroundColor: COLORS.surface, padding: "40px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <h2 style={{ color: COLORS.text, fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>{quiz.title}</h2>
            <p style={{ color: COLORS.textMuted }}>Question {currentQuestion} of {quiz.questions}</p>
          </div>
          <div style={{ padding: "10px 20px", backgroundColor: `${COLORS.rose}15`, borderRadius: "12px", color: COLORS.rose, fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={18} /> 18:45
          </div>
        </div>

        <ProgressBar progress={(currentQuestion / quiz.questions) * 100} />

        <div style={{ marginTop: "40px" }}>
          <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 600, lineHeight: 1.5, marginBottom: "32px" }}>
            Which of the following is a primary benefit of using React Hooks over Class Components?
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              "Improved performance in all scenarios",
              "Better code reuse and logic separation",
              "Mandatory for all React applications",
              "Easier to debug in production"
            ].map((option, i) => (
              <div key={i} style={{ 
                padding: "20px", 
                backgroundColor: COLORS.surfaceHigh, 
                borderRadius: "14px", 
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                transition: "border-color 0.2s"
              }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `2px solid ${COLORS.textDim}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "transparent" }} />
                </div>
                {option}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            <button style={{ padding: "14px 28px", backgroundColor: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: "12px", color: COLORS.text, fontWeight: 600, cursor: "pointer" }}>Previous</button>
            <button 
              onClick={() => setCurrentQuestion(prev => Math.min(quiz.questions, prev + 1))}
              style={{ padding: "14px 28px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Next Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CoursePlayerPage = ({ course, onBack }: { course: Course; onBack: () => void }) => {
  const [videoUrl, setVideoUrl] = useState(course.videoUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setVideoUrl(course.videoUrl);
  }, [course.videoUrl]);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const youtubeId = getYoutubeId(videoUrl);

  const generateAiVideo = async () => {
    if (!hasApiKey) {
      if ((window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      } else {
        alert("API Key selection is not available in this environment.");
        return;
      }
    }

    setIsGenerating(true);
    setGenerationStatus("Initializing AI Model...");

    try {
      // Use process.env.API_KEY for Veo models as per platform instructions
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      setGenerationStatus("Crafting visual script for: " + course.title);
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A high-quality educational lecture video about ${course.title}. The scene shows a professional instructor in a modern studio with digital graphics related to ${course.cat}. Cinematic lighting, 4k resolution.`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      setGenerationStatus("AI is rendering your custom lesson... (this may take a minute)");

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
        
        // Update status periodically to keep user engaged
        const statuses = [
          "Synthesizing visual elements...",
          "Optimizing frame transitions...",
          "Finalizing educational content...",
          "Almost ready..."
        ];
        setGenerationStatus(statuses[Math.floor(Math.random() * statuses.length)]);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': apiKey || "",
          },
        });
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        setVideoUrl(localUrl);
        setGenerationStatus("Generation Complete!");
      }
    } catch (error: any) {
      console.error("Video generation error:", error);
      
      // If the error is a permission error, it might be due to an invalid or missing paid API key
      if (error?.message?.includes("PERMISSION_DENIED") || error?.status === "PERMISSION_DENIED") {
        alert("Permission Denied: This feature requires a paid Gemini API key. Please select a valid key from a paid Google Cloud project.");
        if ((window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
        }
      } else {
        alert("Failed to generate AI video. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "8px", color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer", marginBottom: "32px", fontWeight: 600 }}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      <div style={{ backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <div style={{ position: "relative", paddingTop: "56.25%", backgroundColor: "black" }}>
          {isGenerating ? (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", gap: "20px", background: "linear-gradient(45deg, #0f172a, #1e293b)" }}>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                style={{ width: "60px", height: "60px", border: "4px solid rgba(255,255,255,0.1)", borderTop: `4px solid ${COLORS.accent}`, borderRadius: "50%" }}
              />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Generating AI Lesson</p>
                <p style={{ color: COLORS.textDim, fontSize: "14px" }}>{generationStatus}</p>
              </div>
            </div>
          ) : youtubeId ? (
            <iframe
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Course Video"
            />
          ) : videoUrl ? (
            <video 
              key={videoUrl}
              src={videoUrl} 
              controls 
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
          ) : (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, gap: "16px", padding: "40px", textAlign: "center" }}>
              <VideoOff size={48} />
              <div>
                <p style={{ color: COLORS.text, fontWeight: 600, fontSize: "18px" }}>No video URL provided</p>
                <p style={{ fontSize: "14px", marginTop: "4px" }}>Please update the course with a valid YouTube or MP4 link.</p>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <div>
              <Badge color={course.color}>{course.cat}</Badge>
              <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginTop: "12px", marginBottom: "8px" }}>{course.title}</h2>
              <p style={{ color: COLORS.textMuted }}>Instructor: {course.instructor}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", color: COLORS.gold, fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
                  <Star size={18} fill={COLORS.gold} /> {course.rating}
                </div>
                <p style={{ color: COLORS.textDim, fontSize: "14px" }}>{course.enrolled.toLocaleString()} Students</p>
              </div>
              <button 
                onClick={generateAiVideo}
                disabled={isGenerating}
                style={{ 
                  padding: "10px 20px", 
                  backgroundColor: isGenerating ? COLORS.surfaceHigh : `${COLORS.accent}20`, 
                  color: COLORS.accent, 
                  border: `1px solid ${COLORS.accent}40`, 
                  borderRadius: "10px", 
                  fontWeight: 700, 
                  fontSize: "13px",
                  cursor: isGenerating ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <Zap size={16} /> {isGenerating ? "Generating..." : "Regenerate with AI"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "24px", paddingTop: "24px", borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.accent }}>
                <Clock size={20} />
              </div>
              <div>
                <p style={{ color: COLORS.textDim, fontSize: "12px", fontWeight: 600 }}>Duration</p>
                <p style={{ color: COLORS.text, fontWeight: 700 }}>{course.duration}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.emerald}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald }}>
                <CheckCircle size={20} />
              </div>
              <div>
                <p style={{ color: COLORS.textDim, fontSize: "12px", fontWeight: 600 }}>Modules</p>
                <p style={{ color: COLORS.text, fontWeight: 700 }}>{course.modules} Lessons</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.gold }}>
                <Award size={20} />
              </div>
              <div>
                <p style={{ color: COLORS.textDim, fontSize: "12px", fontWeight: 600 }}>Level</p>
                <p style={{ color: COLORS.text, fontWeight: 700 }}>{course.level}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CourseForm = ({ onClose, initialData }: { onClose: () => void, initialData?: Course }) => {
  const [formData, setFormData] = useState(initialData || {
    title: "",
    cat: "Technology",
    instructor: "",
    duration: "10h",
    enrolled: 0,
    rating: 5.0,
    color: "#6366f1",
    emoji: "📚",
    modules: 5,
    level: "Beginner",
    videoUrl: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData?.id) {
        const { id, ...updateData } = formData;
        await updateDoc(doc(db, "courses", id.toString()), {
          ...updateData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "courses"), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      onClose();
    } catch (err) {
      console.error("Error saving course:", err);
      alert("Failed to save course.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", width: "100%", maxWidth: "500px", border: `1px solid ${COLORS.border}`, maxHeight: "90vh", overflowY: "auto" }}
      >
        <h3 style={{ color: COLORS.text, fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>{initialData ? "Edit Course" : "Create New Course"}</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input 
            placeholder="Course Title" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})}
            required
            style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          />
          <input 
            placeholder="Instructor Name" 
            value={formData.instructor} 
            onChange={e => setFormData({...formData, instructor: e.target.value})}
            required
            style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <select 
              value={formData.cat} 
              onChange={e => setFormData({...formData, cat: e.target.value})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            >
              <option>Technology</option>
              <option>Medical</option>
              <option>Agriculture</option>
              <option>Business</option>
              <option>Design</option>
              <option>Marketing</option>
              <option>Personal Growth</option>
            </select>
            <select 
              value={formData.level} 
              onChange={e => setFormData({...formData, level: e.target.value})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
              <option>All Levels</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <input 
              placeholder="Duration (e.g. 12h)" 
              value={formData.duration} 
              onChange={e => setFormData({...formData, duration: e.target.value})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
            <input 
              type="number"
              placeholder="Modules" 
              value={formData.modules} 
              onChange={e => setFormData({...formData, modules: parseInt(e.target.value)})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <input 
              type="color"
              value={formData.color} 
              onChange={e => setFormData({...formData, color: e.target.value})}
              style={{ padding: "4px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, height: "48px", width: "100%" }}
            />
            <input 
              placeholder="Emoji (e.g. ⚛️)" 
              value={formData.emoji} 
              onChange={e => setFormData({...formData, emoji: e.target.value})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ color: COLORS.textMuted, fontSize: "12px" }}>Original Video URL</label>
            <input 
              placeholder="e.g. https://youtube.com/watch?v=... or .mp4 link" 
              value={formData.videoUrl} 
              onChange={e => setFormData({...formData, videoUrl: e.target.value})}
              style={{ padding: "12px 16px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
            <p style={{ color: COLORS.textDim, fontSize: "11px" }}>Supports YouTube links and direct MP4/WebM video files.</p>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: "12px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{ flex: 1, padding: "12px", borderRadius: "12px", backgroundColor: COLORS.accent, color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              {initialData ? "Update Course" : "Create Course"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const CoursesAdminPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { data: courses, loading } = useFirestoreCollection<Course>("courses");
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const displayCourses = courses.length > 0 ? courses : COURSES;

  const handleAddMockData = async () => {
    if (confirm("Add mock courses to Firestore?")) {
      try {
        for (const course of COURSES) {
          const { id, ...courseData } = course;
          await addDoc(collection(db, "courses"), {
            ...courseData,
            createdAt: serverTimestamp()
          });
        }
        alert("Mock data added successfully!");
      } catch (err) {
        console.error("Error adding mock data:", err);
        alert("Failed to add mock data.");
      }
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (confirm("Are you sure you want to delete this course?")) {
      try {
        await deleteDoc(doc(db, "courses", id));
      } catch (err) {
        console.error("Error deleting course:", err);
        alert("Failed to delete course.");
      }
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
        <div>
          <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Course Management</h2>
          <p style={{ color: COLORS.textMuted }}>Manage your course catalog and curriculum.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {courses.length === 0 && (
            <button 
              onClick={handleAddMockData}
              style={{ padding: "12px 24px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Seed Mock Data
            </button>
          )}
          <button 
            onClick={() => setIsAddingCourse(true)}
            style={{ padding: "12px 24px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={18} /> Add New Course
          </button>
        </div>
      </div>

      {isAddingCourse && <CourseForm onClose={() => setIsAddingCourse(false)} />}
      {editingCourse && <CourseForm onClose={() => setEditingCourse(null)} initialData={editingCourse} />}

      {loading && courses.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Loading courses...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
          {displayCourses.map(course => (
            <div 
              key={course.id} 
              onClick={() => onSelectCourse(course)}
              style={{ backgroundColor: COLORS.surface, borderRadius: "20px", border: `1px solid ${COLORS.border}`, overflow: "hidden", cursor: "pointer" }}
            >
              <div style={{ height: "120px", backgroundColor: course.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>
                {course.emoji}
              </div>
              <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                  <Badge color={course.color}>{course.cat}</Badge>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingCourse(course); }}
                      style={{ color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer" }}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); course.id && handleDeleteCourse(course.id.toString()); }}
                      style={{ color: COLORS.rose, background: "none", border: "none", cursor: "pointer" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h4 style={{ color: COLORS.text, fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{course.title}</h4>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onSelectCourse(course); }}
                    style={{ padding: "8px 16px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Video size={14} /> Preview
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: COLORS.gold, fontSize: "13px" }}>
                    <Star size={14} fill={COLORS.gold} color={COLORS.gold} /> {course.rating}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VideoManagementPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { data: courses, loading } = useFirestoreCollection<Course>("courses");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const displayCourses = courses.length > 0 ? courses : COURSES;

  const filteredCourses = displayCourses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.instructor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddMockData = async () => {
    if (confirm("Add 300 mock courses to Firestore? This will allow you to update their video URLs.")) {
      try {
        setUpdatingId("seeding");
        for (const course of COURSES) {
          const { id, ...courseData } = course;
          await addDoc(collection(db, "courses"), {
            ...courseData,
            createdAt: serverTimestamp()
          });
        }
        alert("Mock data added successfully!");
      } catch (err) {
        console.error("Error adding mock data:", err);
        alert("Failed to add mock data.");
      } finally {
        setUpdatingId(null);
      }
    }
  };

  const handleUpdateUrl = async (id: string | number, newUrl: string) => {
    if (typeof id === 'number') {
      alert("This course is currently in 'Mock Mode'. Please click 'Seed Data to Firestore' first to make it editable.");
      return;
    }
    setUpdatingId(id.toString());
    try {
      await updateDoc(doc(db, "courses", id.toString()), {
        videoUrl: newUrl,
        updatedAt: serverTimestamp()
      });
      alert("Video URL updated successfully!");
    } catch (err) {
      console.error("Error updating video URL:", err);
      alert("Failed to update video URL. " + (err instanceof Error ? err.message : "Check console for details."));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ padding: "40px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h2 style={{ fontSize: "32px", fontWeight: 800, color: COLORS.text, marginBottom: "8px" }}>Video Management</h2>
          <p style={{ color: COLORS.textMuted }}>Batch update original course video URLs for all 300 courses.</p>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {courses.length === 0 && (
            <button 
              onClick={handleAddMockData}
              disabled={updatingId === "seeding"}
              style={{ padding: "12px 24px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              {updatingId === "seeding" ? "Seeding..." : "Seed Data to Firestore"}
            </button>
          )}
          <div style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted }} />
            <input 
              placeholder="Search courses..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: "12px 16px 12px 40px", borderRadius: "12px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, width: "300px" }}
            />
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surfaceHigh }}>
              <th style={{ padding: "16px 24px", color: COLORS.textMuted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Course</th>
              <th style={{ padding: "16px 24px", color: COLORS.textMuted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Instructor</th>
              <th style={{ padding: "16px 24px", color: COLORS.textMuted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Original Video URL</th>
              <th style={{ padding: "16px 24px", color: COLORS.textMuted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map(course => (
              <tr key={course.id} style={{ borderBottom: `1px solid ${COLORS.border}`, transition: "background 0.2s" }}>
                <td style={{ padding: "16px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: course.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                      {course.emoji}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: COLORS.text }}>{course.title}</div>
                      <button 
                        onClick={() => onSelectCourse(course)}
                        style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: "11px", fontWeight: 700, padding: 0, marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Video size={12} /> Preview Player
                      </button>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "16px 24px", color: COLORS.textDim }}>{course.instructor}</td>
                <td style={{ padding: "16px 24px" }}>
                  <input 
                    defaultValue={course.videoUrl}
                    onBlur={async (e) => {
                      if (e.target.value !== course.videoUrl) {
                        // Optional: auto-save on blur or just use the button
                      }
                    }}
                    id={`url-${course.id}`}
                    placeholder="YouTube or MP4 link"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: "13px" }}
                  />
                  <p style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "4px" }}>YouTube or direct video link</p>
                </td>
                <td style={{ padding: "16px 24px" }}>
                  <button 
                    disabled={updatingId === course.id?.toString()}
                    onClick={() => {
                      const input = document.getElementById(`url-${course.id}`) as HTMLInputElement;
                      if (course.id) handleUpdateUrl(course.id, input.value);
                    }}
                    style={{ 
                      padding: "8px 16px", 
                      borderRadius: "8px", 
                      backgroundColor: COLORS.accent, 
                      color: "white", 
                      border: "none", 
                      fontSize: "12px", 
                      fontWeight: 600, 
                      cursor: "pointer",
                      opacity: updatingId === course.id?.toString() ? 0.5 : 1
                    }}
                  >
                    {updatingId === course.id?.toString() ? "Saving..." : "Update"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCourses.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: COLORS.textMuted }}>
            No courses found matching your search.
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Platform Component ---

const ELearningPlatform = () => {
  const { role, logout, user } = useAuth();
  const { data: courses } = useFirestoreCollection<Course>("courses");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const adminNav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "videos", label: "Video Management", icon: Video },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
    { id: "users", label: "Students", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const studentNav = [
    { id: "dashboard", label: "My Learning", icon: LayoutDashboard },
    { id: "catalog", label: "Course Catalog", icon: BookOpen },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
    { id: "achievements", label: "Achievements", icon: Award },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const navItems = role === "admin" ? adminNav : studentNav;

  const currentCourse = selectedCourse ? (courses.find(c => String(c.id) === String(selectedCourse.id)) || selectedCourse) : null;

  const renderContent = () => {
    if (currentCourse) return <CoursePlayerPage course={currentCourse} onBack={() => setSelectedCourse(null)} />;
    if (selectedQuiz) return <QuizTakingPage quiz={selectedQuiz} onBack={() => setSelectedQuiz(null)} />;

    if (role === "admin") {
      switch (activeTab) {
        case "dashboard": return <AdminDashboardPage onNavigate={setActiveTab} />;
        case "courses": return <CoursesAdminPage onSelectCourse={setSelectedCourse} />;
        case "videos": return <VideoManagementPage onSelectCourse={setSelectedCourse} />;
        case "quizzes": return <QuizAdminPage />;
        default: return <div style={{ padding: "40px", color: COLORS.text }}>Page under construction</div>;
      }
    } else {
      switch (activeTab) {
        case "dashboard": return <StudentDashboardPage onSelectCourse={setSelectedCourse} />;
        case "catalog": return <CourseCatalogPage onSelectCourse={setSelectedCourse} />;
        case "quizzes": return <QuizListPage onSelectQuiz={setSelectedQuiz} />;
        default: return <div style={{ padding: "40px", color: COLORS.text }}>Page under construction</div>;
      }
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: COLORS.primary, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: "280px", backgroundColor: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", padding: "32px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "48px", padding: "0 12px" }}>
          <div style={{ width: "40px", height: "40px", backgroundColor: COLORS.accent, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <BookOpen size={24} />
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em" }}>EduCloud</h2>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSelectedQuiz(null); setSelectedCourse(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "12px", border: "none", cursor: "pointer",
                backgroundColor: activeTab === item.id ? `${COLORS.accent}15` : "transparent",
                color: activeTab === item.id ? COLORS.accent : COLORS.textMuted,
                fontWeight: activeTab === item.id ? 700 : 500,
                transition: "all 0.2s"
              }}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "32px", borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", padding: "0 12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: COLORS.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {user?.photoURL ? <img src={user.photoURL} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color={COLORS.textDim} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.displayName || "User"}</p>
              <p style={{ fontSize: "12px", color: COLORS.textDim, textTransform: "capitalize" }}>{role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "12px", border: "none", cursor: "pointer", backgroundColor: "transparent", color: COLORS.rose, fontWeight: 600 }}
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: "80px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", backgroundColor: COLORS.primary }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: COLORS.textDim, fontWeight: 600, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Platform</span>
            <ChevronRight size={16} style={{ color: COLORS.textDim }} />
            <span style={{ color: COLORS.text, fontWeight: 700, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{activeTab}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ position: "relative", color: COLORS.textMuted }}>
              <Bell size={22} />
              <div style={{ position: "absolute", top: "-2px", right: "-2px", width: "10px", height: "10px", backgroundColor: COLORS.rose, borderRadius: "50%", border: `2px solid ${COLORS.primary}` }} />
            </div>
            <div style={{ height: "32px", width: "1px", backgroundColor: COLORS.border }} />
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: COLORS.text, fontSize: "14px", fontWeight: 700 }}>{user?.displayName || "User"}</p>
                <p style={{ color: COLORS.textMuted, fontSize: "12px", fontWeight: 500 }}>{user?.email}</p>
              </div>
              <div style={{ width: "44px", height: "44px", borderRadius: "14px", backgroundColor: COLORS.surfaceHigh, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, overflow: "hidden" }}>
                {user?.photoURL ? <img src={user.photoURL} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={24} />}
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", backgroundColor: COLORS.primary }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (selectedQuiz?.id || "")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary }}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ width: "40px", height: "40px", border: `4px solid ${COLORS.surfaceHigh}`, borderTop: `4px solid ${COLORS.accent}`, borderRadius: "50%" }}
        />
      </div>
    );
  }

  return user ? <ELearningPlatform /> : <LoginScreen />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
