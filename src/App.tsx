import React, { useState, useEffect, useRef, createContext, useContext, Component } from "react";
import { 
  LayoutDashboard, BookOpen, Video, ClipboardList, Users, Settings, LogOut, 
  Search, Bell, ChevronRight, Star, Clock, Play, CheckCircle, Upload, Plus, 
  Trash2, Edit, ArrowLeft, Award, Target, Zap, TrendingUp, User, ChevronDown,
  Menu, X, Filter, MoreVertical, ExternalLink, Download, Share2, Info, VideoOff,
  Home, Compass, Library, PlaySquare, History, ThumbsUp, Youtube, FileText, Save,
  PlayCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import Markdown from "react-markdown";
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
  login: (role?: UserRole) => Promise<void>;
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

  const login = async (preferredRole?: UserRole) => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      // If it's a new user and they chose a role, save it
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const defaultRole: UserRole = firebaseUser.email === "vilvanathanvbmpk@gmail.com" ? "admin" : (preferredRole || "student");
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
  const [view, setView] = useState<"choice" | "student" | "admin">("choice");

  const renderChoice = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <button 
        onClick={() => setView("student")}
        style={{
          width: "100%", padding: "20px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text,
          borderRadius: "16px", border: `1px solid ${COLORS.border}`, fontWeight: 700, fontSize: "16px",
          cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "16px"
        }}
      >
        <div style={{ width: "48px", height: "48px", backgroundColor: `${COLORS.emerald}20`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald }}>
          <BookOpen size={24} />
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>Student Portal</div>
          <div style={{ fontSize: "13px", color: COLORS.textMuted, fontWeight: 400 }}>Access courses and quizzes</div>
        </div>
        <ChevronRight size={20} style={{ marginLeft: "auto", color: COLORS.textDim }} />
      </button>

      <button 
        onClick={() => setView("admin")}
        style={{
          width: "100%", padding: "20px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text,
          borderRadius: "16px", border: `1px solid ${COLORS.border}`, fontWeight: 700, fontSize: "16px",
          cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "16px"
        }}
      >
        <div style={{ width: "48px", height: "48px", backgroundColor: `${COLORS.accent}20`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.accent }}>
          <LayoutDashboard size={24} />
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>Admin Portal</div>
          <div style={{ fontSize: "13px", color: COLORS.textMuted, fontWeight: 400 }}>Manage courses and students</div>
        </div>
        <ChevronRight size={20} style={{ marginLeft: "auto", color: COLORS.textDim }} />
      </button>
    </div>
  );

  const renderLogin = (role: UserRole) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <button 
        onClick={() => setView("choice")}
        style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, padding: 0 }}
      >
        <ArrowLeft size={16} /> Back to selection
      </button>

      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <div style={{ 
          width: "80px", height: "80px", backgroundColor: role === "admin" ? `${COLORS.accent}15` : `${COLORS.emerald}15`, 
          borderRadius: "24px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
          color: role === "admin" ? COLORS.accent : COLORS.emerald
        }}>
          {role === "admin" ? <Users size={40} /> : <User size={40} />}
        </div>
        <h2 style={{ color: COLORS.text, fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
          {role === "admin" ? "Admin Access" : "Student Access"}
        </h2>
        <p style={{ color: COLORS.textMuted, fontSize: "14px" }}>
          {role === "admin" ? "Authorized personnel only" : "Welcome back, learner!"}
        </p>
      </div>

      <button 
        onClick={() => login(role)}
        style={{
          width: "100%", padding: "16px", backgroundColor: "white", color: "#1f2937",
          borderRadius: "12px", border: "none", fontWeight: 700, fontSize: "16px",
          cursor: "pointer", transition: "transform 0.1s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
        }}
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: "20px", height: "20px" }} />
        Sign in with Google
      </button>
      
      {role === "admin" && (
        <p style={{ color: COLORS.textDim, fontSize: "12px", textAlign: "center", fontStyle: "italic" }}>
          Note: Admin roles are verified by email address.
        </p>
      )}
    </div>
  );

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
          maxWidth: "460px",
          padding: "48px",
          backgroundColor: COLORS.surface,
          borderRadius: "32px",
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
          <p style={{ color: COLORS.textMuted }}>Your gateway to knowledge</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {view === "choice" ? renderChoice() : renderLogin(view as UserRole)}
          </motion.div>
        </AnimatePresence>

        <p style={{ color: COLORS.textDim, fontSize: "12px", textAlign: "center", marginTop: "32px" }}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
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
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                  <div>
                    <p style={{ color: COLORS.text, fontWeight: 600 }}>{user.displayName || "Anonymous User"}</p>
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
    if (confirm("Add mock quizzes to Firestore? This will update existing quizzes with the same IDs.")) {
      try {
        for (const quiz of QUIZZES) {
          const { id, ...quizData } = quiz;
          await setDoc(doc(db, "quizzes", id.toString()), {
            ...quizData,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        alert("Mock quizzes updated!");
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
          <button 
            onClick={handleAddMockQuizzes}
            style={{ padding: "12px 24px", backgroundColor: `${COLORS.accent}15`, color: COLORS.accent, border: `1px solid ${COLORS.accent}30`, borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Zap size={18} /> Sync with Defaults
          </button>
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
                        onClick={() => quiz.id && handleDeleteQuiz(String(quiz.id))}
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

interface VideoCardProps {
  course: Course;
  onClick: () => void;
  key?: any;
}

const VideoCard = ({ course, onClick }: VideoCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: "12px", overflow: "hidden", backgroundColor: course.color }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>
          {course.emoji}
        </div>
        <div style={{ position: "absolute", bottom: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.8)", color: "white", padding: "2px 6px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>
          {course.duration || "12:45"}
        </div>
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: COLORS.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <User size={20} color={COLORS.textDim} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: COLORS.text, marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.4" }}>
            {course.title}
          </h3>
          <p style={{ fontSize: "13px", color: COLORS.textDim, marginBottom: "2px" }}>{course.instructor}</p>
          <p style={{ fontSize: "13px", color: COLORS.textDim }}>
            {course.enrolled || 0} views • 2 days ago
          </p>
        </div>
        <button style={{ padding: "4px", color: COLORS.textDim }}>
          <MoreVertical size={18} />
        </button>
      </div>
    </motion.div>
  );
};

const HomeFeedPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: courses } = useFirestoreCollection<Course>("courses");
  const { data: progress } = useFirestoreCollection<any>("progress", [where("uid", "==", user?.uid || "")]);
  const categories = ["All", "Development", "Design", "Business", "Marketing", "Music", "Photography"];
  const [activeCat, setActiveCat] = useState("All");

  const continueLearning = courses.filter(c => progress.some(p => p.courseId === c.id?.toString()))
    .map(c => {
      const p = progress.find(prog => prog.courseId === c.id?.toString());
      return { ...c, progress: p?.percent || 0, lastAccessed: p?.lastAccessed };
    })
    .sort((a, b) => (b.lastAccessed?.toMillis() || 0) - (a.lastAccessed?.toMillis() || 0))
    .slice(0, 3);

  const filteredCourses = activeCat === "All" 
    ? courses 
    : courses.filter(c => c.cat === activeCat);

  return (
    <div style={{ padding: "24px 40px" }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 800, color: COLORS.text, marginBottom: "8px" }}>
          Welcome back, {user?.displayName?.split(" ")[0] || "Learner"}! 👋
        </h1>
        <p style={{ color: COLORS.textMuted, fontSize: "16px" }}>Ready to continue your learning journey?</p>
      </div>

      {/* Continue Learning Section */}
      {continueLearning.length > 0 && (
        <section style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <PlayCircle size={24} color={COLORS.accent} />
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Continue Learning</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
            {continueLearning.map(course => (
              <motion.div
                key={course.id}
                whileHover={{ y: -5 }}
                onClick={() => onSelectCourse(course)}
                style={{ 
                  backgroundColor: COLORS.surface, 
                  borderRadius: "20px", 
                  border: `1px solid ${COLORS.border}`, 
                  padding: "20px", 
                  cursor: "pointer",
                  display: "flex",
                  gap: "16px",
                  alignItems: "center"
                }}
              >
                <div style={{ 
                  width: "80px", height: "80px", borderRadius: "12px", backgroundColor: course.color, 
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", flexShrink: 0 
                }}>
                  {course.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.title}</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: COLORS.textDim }}>{course.progress}% Complete</span>
                  </div>
                  <ProgressBar progress={course.progress} color={course.color} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Category Pills */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            style={{
              padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
              backgroundColor: activeCat === cat ? COLORS.text : COLORS.surfaceHigh,
              color: activeCat === cat ? COLORS.primary : COLORS.text,
              fontSize: "14px", fontWeight: 600, transition: "all 0.2s"
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px 16px" }}>
        {filteredCourses.map(course => (
          <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
        ))}
      </div>
    </div>
  );
};

const ExplorePage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: courses, loading: coursesLoading } = useFirestoreCollection<Course>("courses");
  const { data: progress, loading: progressLoading } = useFirestoreCollection<any>("progress", [where("uid", "==", user?.uid || "")]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const enrolledCourseIds = progress.map(p => p.courseId);
  const displayCourses = courses.length > 0 ? courses : COURSES;
  const loading = coursesLoading || progressLoading;

  const handleEnroll = async (course: Course) => {
    if (!user) {
      alert("Please sign in to enroll.");
      return;
    }
    if (!course.id) return;

    try {
      await addDoc(collection(db, "progress"), {
        uid: user.uid,
        courseId: course.id.toString(),
        percent: 0,
        lastAccessed: serverTimestamp()
      });
      
      // Increment enrolled count in course document
      const courseRef = doc(db, "courses", course.id.toString());
      const courseSnap = await getDoc(courseRef);
      if (courseSnap.exists()) {
        await updateDoc(courseRef, {
          enrolled: (courseSnap.data().enrolled || 0) + 1
        });
      }
      
      // Immediately play the course
      onSelectCourse(course);
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
    <div style={{ padding: "24px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Compass size={28} color={COLORS.accent} />
          <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 800 }}>Explore</h2>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: COLORS.textDim }} />
            <input 
              type="text" 
              placeholder="Search courses..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "10px 12px 10px 40px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", color: COLORS.text, outline: "none", width: "240px", fontSize: "14px" }}
            />
          </div>
          <button style={{ padding: "10px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", color: COLORS.text }}><Filter size={18} /></button>
        </div>
      </div>

      {/* Trending Section */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <TrendingUp size={24} color={COLORS.rose} />
          <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Trending Courses</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
          {displayCourses.slice(0, 4).map(course => (
            <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700 }}>All Courses</h2>
        <p style={{ color: COLORS.textDim, fontSize: "14px" }}>{filteredCourses.length} courses available</p>
      </div>

      {loading && courses.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Loading catalog...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px 16px" }}>
          {filteredCourses.map(course => (
            <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
          ))}
        </div>
      )}
    </div>
  );
};

const SubscriptionsPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: progress } = useFirestoreCollection<any>("progress", [where("uid", "==", user?.uid || "")]);
  const { data: courses } = useFirestoreCollection<Course>("courses");
  
  const enrolledCourses = courses.filter(c => progress.some(p => p.courseId === c.id?.toString()));
  
  return (
    <div style={{ padding: "24px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <Youtube size={24} color="#FF0000" fill="#FF0000" />
        <h2 style={{ fontSize: "24px", fontWeight: 700 }}>Your Subscriptions</h2>
      </div>
      
      {enrolledCourses.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px 16px" }}>
          {enrolledCourses.map(course => (
            <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 0", color: COLORS.textMuted }}>
          <VideoOff size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
          <p style={{ fontSize: "18px", fontWeight: 600, color: COLORS.text }}>No subscriptions yet</p>
          <p style={{ fontSize: "14px", marginTop: "8px" }}>Explore courses and enroll to see them here.</p>
        </div>
      )}
    </div>
  );
};

const LikedVideosPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: likes } = useFirestoreCollection<any>("likes", [where("uid", "==", user?.uid || "")]);
  const { data: courses } = useFirestoreCollection<Course>("courses");
  
  const likedCourses = courses.filter(c => likes.some(l => l.courseId === c.id?.toString()));

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "16px", backgroundColor: `${COLORS.emerald}20`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald }}>
          <ThumbsUp size={24} fill={COLORS.emerald} />
        </div>
        <div>
          <h2 style={{ fontSize: "28px", fontWeight: 700 }}>Liked Videos</h2>
          <p style={{ color: COLORS.textDim }}>{likedCourses.length} videos you've liked</p>
        </div>
      </div>

      {likedCourses.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px" }}>
          {likedCourses.map(course => (
            <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 40px", backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
          <ThumbsUp size={48} color={COLORS.textDim} style={{ marginBottom: "20px" }} />
          <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>No liked videos yet</h3>
          <p style={{ color: COLORS.textDim, maxWidth: "400px", margin: "0 auto" }}>
            When you like a video, it will appear here for easy access.
          </p>
        </div>
      )}
    </div>
  );
};

const ResearchHistoryPage = () => {
  const { user } = useAuth();
  const { data: research } = useFirestoreCollection<any>("savedResearch", [where("uid", "==", user?.uid || "")]);

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "16px", backgroundColor: `${COLORS.sky}20`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.sky }}>
          <TrendingUp size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: "28px", fontWeight: 700 }}>AI Research Library</h2>
          <p style={{ color: COLORS.textDim }}>{research.length} saved research reports</p>
        </div>
      </div>

      {research.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
          {research.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).map(item => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: COLORS.text, marginBottom: "4px" }}>{item.courseTitle}</h3>
                  <p style={{ color: COLORS.textDim, fontSize: "12px" }}>Generated on {item.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={async () => {
                    if (confirm("Are you sure you want to delete this research?")) {
                      await deleteDoc(doc(db, "savedResearch", item.id));
                    }
                  }}
                  style={{ color: COLORS.rose, background: "none", border: "none", cursor: "pointer" }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="markdown-body" style={{ color: COLORS.textMuted, fontSize: "14px", maxHeight: "300px", overflowY: "auto", padding: "16px", backgroundColor: COLORS.surfaceHigh, borderRadius: "12px" }}>
                <Markdown>{item.content}</Markdown>
              </div>
              {item.sources && item.sources.length > 0 && (
                <div style={{ marginTop: "20px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {item.sources.map((source: any, idx: number) => (
                    <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: COLORS.sky, textDecoration: "none", backgroundColor: `${COLORS.sky}10`, padding: "4px 8px", borderRadius: "6px" }}>
                      {source.title || "Source"}
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 40px", backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
          <Search size={48} color={COLORS.textDim} style={{ marginBottom: "20px" }} />
          <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Your research library is empty</h3>
          <p style={{ color: COLORS.textDim, maxWidth: "400px", margin: "0 auto" }}>
            Use the AI Research tool in any course to generate insights and save them here.
          </p>
        </div>
      )}
    </div>
  );
};

const LibraryPage = ({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) => {
  const { user } = useAuth();
  const { data: progress } = useFirestoreCollection<any>("progress", [where("uid", "==", user?.uid || "")]);
  const { data: likes } = useFirestoreCollection<any>("likes", [where("uid", "==", user?.uid || "")]);
  const { data: watchLater } = useFirestoreCollection<any>("watchLater", [where("uid", "==", user?.uid || "")]);
  const { data: courses } = useFirestoreCollection<Course>("courses");
  
  const history = courses.filter(c => progress.some(p => p.courseId === c.id?.toString()))
    .sort((a, b) => {
      const pA = progress.find(p => p.courseId === a.id?.toString());
      const pB = progress.find(p => p.courseId === b.id?.toString());
      return (pB?.lastAccessed?.toMillis() || 0) - (pA?.lastAccessed?.toMillis() || 0);
    });

  const likedCourses = courses.filter(c => likes.some(l => l.courseId === c.id?.toString()));
  const watchLaterCourses = courses.filter(c => watchLater.some(w => w.courseId === c.id?.toString()));

  return (
    <div style={{ padding: "24px 40px" }}>
      <section style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <History size={24} color={COLORS.accent} />
          <h2 style={{ fontSize: "24px", fontWeight: 700 }}>History</h2>
        </div>
        
        {history.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "24px" }}>
            {history.slice(0, 6).map(course => (
              <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
            ))}
          </div>
        ) : (
          <p style={{ color: COLORS.textDim }}>No history yet.</p>
        )}
      </section>

      <section style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <Clock size={24} color={COLORS.rose} />
          <h2 style={{ fontSize: "24px", fontWeight: 700 }}>Watch Later</h2>
        </div>
        {watchLaterCourses.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "24px" }}>
            {watchLaterCourses.map(course => (
              <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", backgroundColor: COLORS.surface, borderRadius: "16px", border: `1px solid ${COLORS.border}` }}>
            <p style={{ color: COLORS.textDim }}>Videos you save for later will appear here.</p>
          </div>
        )}
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <ThumbsUp size={24} color={COLORS.emerald} />
          <h2 style={{ fontSize: "24px", fontWeight: 700 }}>Liked Videos</h2>
        </div>
        {likedCourses.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "24px" }}>
            {likedCourses.map(course => (
              <VideoCard key={course.id} course={course} onClick={() => onSelectCourse(course)} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", backgroundColor: COLORS.surface, borderRadius: "16px", border: `1px solid ${COLORS.border}` }}>
            <p style={{ color: COLORS.textDim }}>Your liked videos will appear here.</p>
          </div>
        )}
      </section>
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
  const { user } = useAuth();
  const [videoUrl, setVideoUrl] = useState(course.videoUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [playerTab, setPlayerTab] = useState<"overview" | "research" | "guide" | "quiz" | "notes">("overview");
  
  const { data: likes } = useFirestoreCollection<any>("likes", [where("uid", "==", user?.uid || "")]);
  const { data: watchLater } = useFirestoreCollection<any>("watchLater", [where("uid", "==", user?.uid || "")]);
  const { data: notesData } = useFirestoreCollection<any>("notes", [
    where("uid", "==", user?.uid || ""),
    where("courseId", "==", course.id?.toString() || "")
  ]);

  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [noteSummary, setNoteSummary] = useState("");

  const isLiked = likes.some(l => l.courseId === course.id?.toString());
  const isWatchLater = watchLater.some(w => w.courseId === course.id?.toString());

  useEffect(() => {
    if (notesData.length > 0) {
      setNotes(notesData[0].content || "");
      setNoteSummary(notesData[0].summary || "");
    }
  }, [notesData]);

  const handleSaveNotes = async () => {
    if (!user || !course.id) return;
    setIsSavingNotes(true);
    try {
      const existing = notesData[0];
      if (existing) {
        await updateDoc(doc(db, "notes", existing.id), {
          content: notes,
          summary: noteSummary,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "notes"), {
          uid: user.uid,
          courseId: course.id.toString(),
          courseTitle: course.title,
          content: notes,
          summary: noteSummary,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error saving notes:", error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAiSummarizeNotes = async () => {
    if (!notes.trim()) return;
    setIsSummarizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Summarize these study notes for the course "${course.title}". Make it concise and highlight key takeaways:\n\n${notes}`,
      });
      setNoteSummary(response.text || "");
    } catch (error) {
      console.error("AI Summarization error:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleToggleLike = async () => {
    if (!user) return;
    const existingLike = likes.find(l => l.courseId === course.id?.toString());
    if (existingLike) {
      await deleteDoc(doc(db, "likes", existingLike.id));
    } else {
      await addDoc(collection(db, "likes"), {
        uid: user.uid,
        courseId: course.id?.toString(),
        createdAt: serverTimestamp()
      });
    }
  };

  const handleToggleWatchLater = async () => {
    if (!user) return;
    const existing = watchLater.find(w => w.courseId === course.id?.toString());
    if (existing) {
      await deleteDoc(doc(db, "watchLater", existing.id));
    } else {
      await addDoc(collection(db, "watchLater"), {
        uid: user.uid,
        courseId: course.id?.toString(),
        createdAt: serverTimestamp()
      });
    }
  };

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

  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [studyGuide, setStudyGuide] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [aiQuiz, setAiQuiz] = useState<any | null>(null);
  const [quizStep, setQuizStep] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<string | null>(null);
  const [researchSources, setResearchSources] = useState<any[]>([]);
  const [isSavingResearch, setIsSavingResearch] = useState(false);

  const handleResearch = async () => {
    setIsResearching(true);
    setResearchResult(null);
    setResearchSources([]);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide an exhaustive, high-level research summary for the course: "${course.title}" in the field of ${course.cat}. 
        Include:
        1. Current global industry state in 2026 with market statistics.
        2. Top 5 emerging technologies or methodologies disrupting the field.
        3. Detailed career outlook, including specific job roles and salary benchmarks (Junior to Lead).
        4. A 6-month advanced learning roadmap beyond this course.
        5. Potential ethical considerations or future challenges.
        Format with professional headings, bullet points, and bold key terms.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      setResearchResult(response.text || "No research found.");
      
      // Extract URLs from grounding metadata
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        setResearchSources(chunks.map((chunk: any) => chunk.web).filter(Boolean));
      }
    } catch (error) {
      console.error("Research error:", error);
      alert("Failed to perform AI research.");
    } finally {
      setIsResearching(false);
    }
  };

  const handleSaveResearch = async () => {
    if (!user || !researchResult) return;
    setIsSavingResearch(true);
    try {
      await addDoc(collection(db, "savedResearch"), {
        uid: user.uid,
        courseId: course.id?.toString(),
        courseTitle: course.title,
        content: researchResult,
        sources: researchSources,
        createdAt: serverTimestamp()
      });
      alert("Research saved to your library!");
    } catch (error) {
      console.error("Save research error:", error);
      alert("Failed to save research.");
    } finally {
      setIsSavingResearch(false);
    }
  };

  const handleGenerateStudyGuide = async () => {
    setIsGeneratingGuide(true);
    setStudyGuide(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a professional, structured study guide for the course: "${course.title}". 
        Sections:
        - Executive Summary
        - Core Concepts (Detailed)
        - Key Terminology
        - Practical Applications
        - 5 Advanced Review Questions
        Format in Markdown with bold headers and clean lists.`,
      });
      setStudyGuide(response.text || "Failed to generate guide.");
    } catch (error) {
      console.error("Study guide error:", error);
      alert("Failed to generate study guide.");
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    setAiQuiz(null);
    setQuizStep(0);
    setQuizScore(0);
    setQuizFinished(false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a 5-question multiple choice quiz based on the course title: "${course.title}". 
        Return ONLY a JSON object with this structure:
        {
          "title": "AI Generated Quiz",
          "questions": [
            {
              "question": "...",
              "options": ["...", "...", "...", "..."],
              "correctIndex": 0
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const quizData = JSON.parse(response.text || "{}");
      setAiQuiz(quizData);
    } catch (error) {
      console.error("Quiz generation error:", error);
      alert("Failed to generate AI quiz.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizAnswer = (optIdx: number) => {
    if (!aiQuiz) return;
    const currentQ = aiQuiz.questions[quizStep];
    if (optIdx === currentQ.correctIndex) {
      setQuizScore(prev => prev + 1);
    }
    
    if (quizStep < aiQuiz.questions.length - 1) {
      setQuizStep(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "8px", color: COLORS.textMuted, background: "none", border: "none", cursor: "pointer", marginBottom: "32px", fontWeight: 600 }}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
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
              <div style={{ flex: 1 }}>
                <Badge color={course.color}>{course.cat}</Badge>
                <h2 style={{ color: COLORS.text, fontSize: "28px", fontWeight: 700, marginTop: "12px", marginBottom: "8px" }}>{course.title}</h2>
                <p style={{ color: COLORS.textMuted }}>Instructor: {course.instructor}</p>
                
                <div style={{ display: "flex", gap: "16px", marginTop: "20px" }}>
                  <button 
                    onClick={handleToggleLike}
                    style={{ 
                      display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", 
                      color: isLiked ? COLORS.accent : COLORS.textDim, cursor: "pointer", fontWeight: 600, fontSize: "14px" 
                    }}
                  >
                    <ThumbsUp size={20} fill={isLiked ? COLORS.accent : "none"} /> {isLiked ? "Liked" : "Like"}
                  </button>
                  <button 
                    onClick={handleToggleWatchLater}
                    style={{ 
                      display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", 
                      color: isWatchLater ? COLORS.rose : COLORS.textDim, cursor: "pointer", fontWeight: 600, fontSize: "14px" 
                    }}
                  >
                    <Clock size={20} fill={isWatchLater ? COLORS.rose : "none"} /> {isWatchLater ? "Added" : "Watch Later"}
                  </button>
                  <button 
                    style={{ 
                      display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", 
                      color: COLORS.textDim, cursor: "pointer", fontWeight: 600, fontSize: "14px" 
                    }}
                  >
                    <Share2 size={20} /> Share
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: COLORS.gold, fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
                    <Star size={18} fill={COLORS.gold} /> {course.rating}
                  </div>
                  <p style={{ color: COLORS.textDim, fontSize: "14px" }}>{course.enrolled.toLocaleString()} Students</p>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button 
                    onClick={handleResearch}
                    disabled={isResearching}
                    style={{ 
                      padding: "10px 20px", 
                      backgroundColor: isResearching ? COLORS.surfaceHigh : `${COLORS.sky}20`, 
                      color: COLORS.sky, 
                      border: `1px solid ${COLORS.sky}40`, 
                      borderRadius: "10px", 
                      fontWeight: 700, 
                      fontSize: "13px",
                      cursor: isResearching ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Search size={16} /> {isResearching ? "Researching..." : "AI Research"}
                  </button>
                  <button 
                    onClick={handleGenerateStudyGuide}
                    disabled={isGeneratingGuide}
                    style={{ 
                      padding: "10px 20px", 
                      backgroundColor: isGeneratingGuide ? COLORS.surfaceHigh : `${COLORS.emerald}20`, 
                      color: COLORS.emerald, 
                      border: `1px solid ${COLORS.emerald}40`, 
                      borderRadius: "10px", 
                      fontWeight: 700, 
                      fontSize: "13px",
                      cursor: isGeneratingGuide ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <ClipboardList size={16} /> {isGeneratingGuide ? "Generating..." : "Study Guide"}
                  </button>
                  <button 
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    style={{ 
                      padding: "10px 20px", 
                      backgroundColor: isGeneratingQuiz ? COLORS.surfaceHigh : `${COLORS.gold}20`, 
                      color: COLORS.gold, 
                      border: `1px solid ${COLORS.gold}40`, 
                      borderRadius: "10px", 
                      fontWeight: 700, 
                      fontSize: "13px",
                      cursor: isGeneratingQuiz ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Target size={16} /> {isGeneratingQuiz ? "Creating..." : "Quiz Me"}
                  </button>
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

        {/* Tabs Navigation */}
        <div style={{ display: "flex", gap: "8px", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: "1px" }}>
          {[
            { id: "overview", label: "Overview", icon: Info },
            { id: "research", label: "AI Research", icon: Search },
            { id: "guide", label: "Study Guide", icon: ClipboardList },
            { id: "quiz", label: "Quiz", icon: Target },
            { id: "notes", label: "My Notes", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPlayerTab(tab.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                backgroundColor: playerTab === tab.id ? COLORS.surface : "transparent",
                color: playerTab === tab.id ? COLORS.accent : COLORS.textDim,
                border: "none",
                borderBottom: `2px solid ${playerTab === tab.id ? COLORS.accent : "transparent"}`,
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                borderRadius: "12px 12px 0 0"
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: "400px" }}>
          {/* Overview Tab */}
          {playerTab === "overview" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "24px 0" }}
            >
              <div style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>Course Description</h3>
                <p style={{ color: COLORS.textMuted, lineHeight: "1.7", fontSize: "16px" }}>
                  Welcome to {course.title}. This comprehensive course is designed to take you from the basics to advanced concepts in {course.cat}. 
                  Led by {course.instructor}, you'll explore key principles, practical applications, and industry best practices.
                </p>
              </div>
              
              <div style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>What you'll learn</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {[
                    "Master core fundamentals and advanced techniques",
                    "Build real-world projects and case studies",
                    "Understand industry-standard tools and workflows",
                    "Develop problem-solving skills for complex challenges"
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", color: COLORS.textMuted }}>
                      <CheckCircle size={18} style={{ color: COLORS.emerald }} />
                      <span style={{ fontSize: "14px" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* AI Research Result */}
          {playerTab === "research" && (
            <div style={{ padding: "24px 0" }}>
              {!researchResult && !isResearching ? (
                <div style={{ textAlign: "center", padding: "60px", backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                  <Search size={48} style={{ color: COLORS.textDim, margin: "0 auto 20px", opacity: 0.5 }} />
                  <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>Deep AI Research</h3>
                  <p style={{ color: COLORS.textMuted, marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
                    Generate a comprehensive research report about this topic including market trends, career outlook, and future predictions.
                  </p>
                  <button 
                    onClick={handleResearch}
                    style={{ padding: "12px 32px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Start Research
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.sky}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.sky }}>
                        <Search size={20} />
                      </div>
                      <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700 }}>AI Research Insights</h3>
                    </div>
                    {researchResult && (
                      <button 
                        onClick={handleSaveResearch}
                        disabled={isSavingResearch}
                        style={{ 
                          padding: "8px 16px", 
                          backgroundColor: COLORS.surfaceHigh, 
                          color: COLORS.sky, 
                          border: `1px solid ${COLORS.sky}30`, 
                          borderRadius: "8px", 
                          fontSize: "12px", 
                          fontWeight: 600, 
                          cursor: isSavingResearch ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        <Library size={14} /> {isSavingResearch ? "Saving..." : "Save to Library"}
                      </button>
                    )}
                  </div>
                  
                  {isResearching ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ height: "20px", width: "100%", backgroundColor: COLORS.surfaceHigh, borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: "20px", width: "90%", backgroundColor: COLORS.surfaceHigh, borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: "20px", width: "95%", backgroundColor: COLORS.surfaceHigh, borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                    </div>
                  ) : (
                    <>
                      <div style={{ color: COLORS.textMuted, lineHeight: "1.6", fontSize: "15px", whiteSpace: "pre-wrap", marginBottom: "24px" }}>
                        {researchResult}
                      </div>
                      {researchSources.length > 0 && (
                        <div style={{ paddingTop: "24px", borderTop: `1px solid ${COLORS.border}` }}>
                          <p style={{ color: COLORS.text, fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Sources & Further Reading:</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                            {researchSources.map((source, idx) => (
                              <a 
                                key={idx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                  display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", 
                                  backgroundColor: COLORS.surfaceHigh, borderRadius: "8px", color: COLORS.sky, 
                                  fontSize: "12px", textDecoration: "none", border: `1px solid ${COLORS.border}`
                                }}
                              >
                                <ExternalLink size={12} /> {source.title || "Source"}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* AI Study Guide */}
          {playerTab === "guide" && (
            <div style={{ padding: "24px 0" }}>
              {!studyGuide && !isGeneratingGuide ? (
                <div style={{ textAlign: "center", padding: "60px", backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                  <ClipboardList size={48} style={{ color: COLORS.textDim, margin: "0 auto 20px", opacity: 0.5 }} />
                  <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>AI Study Guide</h3>
                  <p style={{ color: COLORS.textMuted, marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
                    Generate a structured study guide with core concepts, terminology, and review questions.
                  </p>
                  <button 
                    onClick={handleGenerateStudyGuide}
                    style={{ padding: "12px 32px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Generate Guide
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.emerald}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald }}>
                        <ClipboardList size={20} />
                      </div>
                      <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700 }}>AI Study Guide</h3>
                    </div>
                    {studyGuide && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(studyGuide);
                          alert("Study guide copied to clipboard!");
                        }}
                        style={{ padding: "8px 16px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                      >
                        <Download size={14} /> Copy to Clipboard
                      </button>
                    )}
                  </div>
                  
                  {isGeneratingGuide ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ height: "20px", width: "100%", backgroundColor: COLORS.surfaceHigh, borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: "20px", width: "90%", backgroundColor: COLORS.surfaceHigh, borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
                    </div>
                  ) : (
                    <div className="markdown-body" style={{ color: COLORS.textMuted, fontSize: "15px" }}>
                      <Markdown>{studyGuide}</Markdown>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* AI Quiz */}
          {playerTab === "quiz" && (
            <div style={{ padding: "24px 0" }}>
              {!aiQuiz && !isGeneratingQuiz ? (
                <div style={{ textAlign: "center", padding: "60px", backgroundColor: COLORS.surface, borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                  <Target size={48} style={{ color: COLORS.textDim, margin: "0 auto 20px", opacity: 0.5 }} />
                  <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>AI Practice Quiz</h3>
                  <p style={{ color: COLORS.textMuted, marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
                    Test your knowledge with a dynamically generated quiz based on this course.
                  </p>
                  <button 
                    onClick={handleGenerateQuiz}
                    style={{ padding: "12px 32px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}
                  >
                    Start Quiz
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.gold }}>
                      <Target size={20} />
                    </div>
                    <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700 }}>AI Practice Quiz</h3>
                  </div>
                  
                  {isGeneratingQuiz ? (
                    <div style={{ textAlign: "center", padding: "40px" }}>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        style={{ width: "40px", height: "40px", border: `3px solid ${COLORS.surfaceHigh}`, borderTop: `3px solid ${COLORS.gold}`, borderRadius: "50%", margin: "0 auto 16px" }}
                      />
                      <p style={{ color: COLORS.textMuted }}>Generating your personalized quiz...</p>
                    </div>
                  ) : quizFinished ? (
                    <div style={{ textAlign: "center", padding: "40px" }}>
                      <div style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: `${COLORS.emerald}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.emerald, margin: "0 auto 24px" }}>
                        <Award size={40} />
                      </div>
                      <h4 style={{ fontSize: "24px", fontWeight: 700, color: COLORS.text, marginBottom: "8px" }}>Quiz Completed!</h4>
                      <p style={{ fontSize: "18px", color: COLORS.textMuted, marginBottom: "24px" }}>You scored <span style={{ color: COLORS.emerald, fontWeight: 800 }}>{quizScore}</span> out of {aiQuiz.questions.length}</p>
                      <button 
                        onClick={handleGenerateQuiz}
                        style={{ padding: "12px 24px", backgroundColor: COLORS.accent, color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Retake Quiz
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ color: COLORS.textDim, fontSize: "14px", fontWeight: 600 }}>Question {quizStep + 1} of {aiQuiz.questions.length}</p>
                        <div style={{ height: "6px", width: "100px", backgroundColor: COLORS.surfaceHigh, borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${((quizStep + 1) / aiQuiz.questions.length) * 100}%`, backgroundColor: COLORS.gold }} />
                        </div>
                      </div>
                      
                      <div style={{ padding: "32px", backgroundColor: COLORS.surfaceHigh, borderRadius: "20px", border: `1px solid ${COLORS.border}` }}>
                        <p style={{ color: COLORS.text, fontSize: "18px", fontWeight: 600, marginBottom: "24px", lineHeight: 1.5 }}>{aiQuiz.questions[quizStep].question}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                          {aiQuiz.questions[quizStep].options.map((opt: string, optIdx: number) => (
                            <button 
                              key={optIdx}
                              onClick={() => handleQuizAnswer(optIdx)}
                              style={{ 
                                padding: "16px 20px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, 
                                borderRadius: "12px", color: COLORS.text, fontSize: "15px", cursor: "pointer", textAlign: "left",
                                transition: "all 0.2s", display: "flex", alignItems: "center", gap: "12px"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.gold}
                              onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.border}
                            >
                              <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `2px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: COLORS.textDim }}>
                                {String.fromCharCode(65 + optIdx)}
                              </div>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* My Notes Tab */}
          {playerTab === "notes" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ padding: "24px 0" }}
            >
              <div style={{ backgroundColor: COLORS.surface, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.accent }}>
                      <FileText size={20} />
                    </div>
                    <h3 style={{ color: COLORS.text, fontSize: "20px", fontWeight: 700 }}>My Study Notes</h3>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button 
                      onClick={handleAiSummarizeNotes}
                      disabled={isSummarizing || !notes.trim()}
                      style={{ 
                        padding: "8px 16px", backgroundColor: COLORS.surfaceHigh, color: COLORS.accent, 
                        border: `1px solid ${COLORS.accent}30`, borderRadius: "8px", fontSize: "12px", 
                        fontWeight: 600, cursor: (isSummarizing || !notes.trim()) ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: "8px"
                      }}
                    >
                      <Zap size={14} /> {isSummarizing ? "Summarizing..." : "AI Summarize"}
                    </button>
                    <button 
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      style={{ 
                        padding: "8px 16px", backgroundColor: COLORS.accent, color: "white", 
                        border: "none", borderRadius: "8px", fontSize: "12px", 
                        fontWeight: 600, cursor: isSavingNotes ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: "8px"
                      }}
                    >
                      <Save size={14} /> {isSavingNotes ? "Saving..." : "Save Notes"}
                    </button>
                  </div>
                </div>

                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Start taking notes here... Your progress is saved automatically."
                  style={{ 
                    width: "100%", height: "300px", backgroundColor: COLORS.surfaceHigh, 
                    border: `1px solid ${COLORS.border}`, borderRadius: "16px", padding: "20px",
                    color: COLORS.text, fontSize: "16px", lineHeight: "1.6", resize: "none",
                    outline: "none", transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.accent}
                  onBlur={(e) => e.target.style.borderColor = COLORS.border}
                />

                {noteSummary && (
                  <div style={{ marginTop: "32px", padding: "24px", backgroundColor: `${COLORS.accent}05`, borderRadius: "16px", border: `1px dashed ${COLORS.accent}30` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: COLORS.accent }}>
                      <Zap size={16} />
                      <span style={{ fontWeight: 700, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Summary</span>
                    </div>
                    <p style={{ color: COLORS.textMuted, fontSize: "15px", lineHeight: "1.6" }}>{noteSummary}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
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
        const { id, ...updateData } = formData as Course;
        await updateDoc(doc(db, "courses", String(id)), {
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
    if (confirm("Add mock courses to Firestore? This will update existing courses with the same IDs.")) {
      try {
        for (const course of COURSES) {
          const { id, ...courseData } = course;
          await setDoc(doc(db, "courses", id.toString()), {
            ...courseData,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        alert("Mock data updated successfully!");
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
          <button 
            onClick={handleAddMockData}
            style={{ padding: "12px 24px", backgroundColor: `${COLORS.accent}15`, color: COLORS.accent, border: `1px solid ${COLORS.accent}30`, borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Zap size={18} /> Sync with Defaults
          </button>
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
          await setDoc(doc(db, "courses", id.toString()), {
            ...courseData,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        alert("Mock data updated successfully!");
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
          {courses.length === 0 ? (
            <button 
              onClick={handleAddMockData}
              disabled={updatingId === "seeding"}
              style={{ padding: "12px 24px", backgroundColor: COLORS.surfaceHigh, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              {updatingId === "seeding" ? "Seeding..." : "Seed Data to Firestore"}
            </button>
          ) : (
            <button 
              onClick={handleAddMockData}
              disabled={updatingId === "seeding"}
              style={{ padding: "12px 24px", backgroundColor: `${COLORS.accent}20`, color: COLORS.accent, border: `1px solid ${COLORS.accent}40`, borderRadius: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Zap size={18} /> {updatingId === "seeding" ? "Syncing..." : "Sync All Videos"}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const globalFilteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cat.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.instructor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const adminNav = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "courses", label: "Manage Courses", icon: PlaySquare },
    { id: "videos", label: "Video Assets", icon: Video },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
    { id: "users", label: "Students", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const studentNav = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "catalog", label: "Explore", icon: Compass },
    { id: "subscriptions", label: "Subscriptions", icon: Youtube },
    { id: "liked", label: "Liked Videos", icon: ThumbsUp },
    { id: "research", label: "AI Library", icon: TrendingUp },
    { id: "quizzes", label: "Quizzes", icon: ClipboardList },
    { id: "achievements", label: "Library", icon: Library },
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
        case "dashboard": return <HomeFeedPage onSelectCourse={setSelectedCourse} />;
        case "catalog": return <ExplorePage onSelectCourse={setSelectedCourse} />;
        case "subscriptions": return <SubscriptionsPage onSelectCourse={setSelectedCourse} />;
        case "liked": return <LikedVideosPage onSelectCourse={setSelectedCourse} />;
        case "research": return <ResearchHistoryPage />;
        case "quizzes": return <QuizListPage onSelectQuiz={setSelectedQuiz} />;
        case "achievements": return <LibraryPage onSelectCourse={setSelectedCourse} />;
        default: return <div style={{ padding: "40px", color: COLORS.text }}>Page under construction</div>;
      }
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: COLORS.primary, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: "240px", backgroundColor: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", padding: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", padding: "12px" }}>
          <Menu size={24} style={{ cursor: "pointer" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <Zap size={28} color={COLORS.accent} fill={COLORS.accent} />
              <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.05em", color: COLORS.text }}>educloud</h2>
            </motion.div>
          </div>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSelectedQuiz(null); setSelectedCourse(null); }}
              style={{
                display: "flex", alignItems: "center", gap: "24px", padding: "10px 12px", borderRadius: "10px", border: "none", cursor: "pointer",
                backgroundColor: activeTab === item.id ? COLORS.surfaceHigh : "transparent",
                color: activeTab === item.id ? COLORS.text : COLORS.textMuted,
                fontWeight: activeTab === item.id ? 600 : 400,
                transition: "all 0.1s"
              }}
            >
              <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span style={{ fontSize: "14px" }}>{item.label}</span>
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

          <div style={{ position: "relative", width: "400px" }}>
            <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: COLORS.textDim }} />
            <input 
              type="text" 
              placeholder="Search courses, instructors..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(e.target.value.length > 0);
              }}
              onFocus={() => searchQuery.length > 0 && setIsSearchOpen(true)}
              style={{ width: "100%", padding: "12px 16px 12px 48px", backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "12px", color: COLORS.text, outline: "none", fontSize: "14px" }}
            />
            
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{ position: "absolute", top: "100%", left: 0, width: "100%", marginTop: "8px", backgroundColor: COLORS.surface, borderRadius: "16px", border: `1px solid ${COLORS.border}`, boxShadow: "0 10px 25px rgba(0,0,0,0.2)", overflow: "hidden", zIndex: 100 }}
                >
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {globalFilteredCourses.length > 0 ? (
                      globalFilteredCourses.map(course => (
                        <div 
                          key={course.id} 
                          onClick={() => handleSelectCourse(course)}
                          style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}
                          className="hover:bg-white/5"
                        >
                          <div style={{ width: "40px", height: "40px", borderRadius: "8px", backgroundColor: course.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                            {course.emoji}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, fontSize: "14px" }}>{course.title}</p>
                            <p style={{ color: COLORS.textDim, fontSize: "12px" }}>{course.cat} • {course.instructor}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: "24px", textAlign: "center", color: COLORS.textDim }}>
                        No courses found for "{searchQuery}"
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
