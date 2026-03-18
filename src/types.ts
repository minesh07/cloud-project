export type UserRole = 'admin' | 'student';

export interface Course {
  id: string | number;
  title: string;
  cat: string;
  instructor: string;
  duration: string;
  enrolled: number;
  rating: number;
  color: string;
  emoji: string;
  modules: number;
  level: string;
  videoUrl: string;
}

export interface Quiz {
  id: string | number;
  title: string;
  course: string;
  questions: number;
  time: number;
  passing: number;
  attempts: number;
  avgScore: number;
}

export interface UserProfile {
  id?: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: any;
}

export interface Stat {
  courses: number;
  students: number;
  quizzes: number;
  videos: number;
}
