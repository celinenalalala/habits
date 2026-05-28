/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Droplets, 
  Footprints, 
  Dumbbell, 
  Home, 
  BarChart3, 
  ShoppingCart, 
  Settings, 
  Check, 
  Plus, 
  Flame,
  Camera,
  Moon,
  Sun,
  Layout,
  Clock,
  Sparkles,
  Zap,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  User,
  Star,
  Trophy,
  Lock,
  Package,
  Backpack as BackpackIcon,
  ShieldAlert,
  Scan,
  Activity,
  Cpu,
  LogOut,
  LogIn
} from 'lucide-react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, db, loginWithGoogle, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell
} from 'recharts';

// Using consistent naming for icons
const Archive = (props: any) => <Package {...props} />;

// --- Firebase Configuration (Hardcoded per user request) ---
const firebaseConfig = {
  apiKey: "AIzaSyA0_igtB6YNu7P893wJCbuGoqfficav__w",
  authDomain: "original-reality-wtpfc.firebaseapp.com",
  projectId: "original-reality-wtpfc",
  storageBucket: "original-reality-wtpfc.firebasestorage.app",
  messagingSenderId: "446559215079",
  appId: "1:446559215079:web:c8c45640c93ac7f3807142",
  databaseId: "ai-studio-031ddc67-63cf-441e-9734-ddc1763a2c3b"
};

// Types
interface Quest {
  id: string;
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  xpReward: number;
  completed: boolean;
  icon: any;
  progress?: number;
}

interface AiHabit {
  id: string;
  name: string;
  streak: number;
  progress: number;
  icon: any;
  aiMessage: string;
  completed: boolean;
  type: 'SLEEP' | 'NUTRITION';
  details?: string;
  statusText?: string;
}

interface SleepLog {
  id: string;
  date: string;
  bedtime: string; // "23:00"
  waketime: string; // "07:00"
  duration: number; // minutes
}

interface ToastMessage {
  id: string;
  text: string;
}

type View = 'home' | 'stats' | 'shop' | 'settings';

// --- Monster Data ---
const MONSTERS = {
  GLOOM_MITE: {
    id: 'GLOOM_MITE' as const,
    name: 'Gloom Mite',
    maxHp: 500,
    description: '"A lingering shadow that feeds on procrastination. Strike it down to reclaim your focus."',
    color: '#ffb4ab',
    bg: '#93000a'
  },
  STATIC_SERPENT: {
    id: 'STATIC_SERPENT' as const,
    name: 'Static Serpent',
    maxHp: 1200,
    description: '"A glitching anomaly from the digital void. Its presence destabilizes the flow of time."',
    color: '#deb7ff',
    bg: '#4a007f'
  },
  GLOOM_MONARCH: {
    id: 'GLOOM_MONARCH' as const,
    name: 'Gloom Monarch',
    maxHp: 3500,
    description: '"The ultimate manifestation of doubt and delay. Only the most disciplined warriors can withstand its shadow."',
    color: '#ff5252',
    bg: '#5c0000'
  }
};

export default function App() {
  // --- State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentView, setCurrentView] = useState<View>('home');
  const [processingHabitId, setProcessingHabitId] = useState<string | null>(null);
  const [xp, setXp] = useState(450);
  const [stardust, setStardust] = useState(250);
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(100);
  const [maxHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(142);
  const [maxEnemyHp, setMaxEnemyHp] = useState(500);
  const [monsterType, setMonsterType] = useState<'GLOOM_MITE' | 'STATIC_SERPENT' | 'GLOOM_MONARCH'>('GLOOM_MITE');
  const [multiplier, setMultiplier] = useState(1.0);
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [quests, setQuests] = useState<Quest[]>([
    { id: '1', name: '2L of Water', difficulty: 'EASY', xpReward: 5, completed: true, icon: Droplets },
    { id: '2', name: '10,000 Steps', difficulty: 'MEDIUM', xpReward: 15, completed: false, icon: Footprints, progress: 45 },
    { id: '3', name: '30-Min Workout', difficulty: 'HARD', xpReward: 25, completed: false, icon: Dumbbell }
  ]);

  const [aiHabits, setAiHabits] = useState<AiHabit[]>([
    { 
      id: 'ai-1', 
      name: 'Digital Sunset Optimizer', 
      streak: 5, 
      progress: 0, 
      icon: Moon, 
      aiMessage: 'Analyzing sleep patterns and circadian rhythm...',
      completed: false,
      type: 'SLEEP',
      details: 'Log sleep patterns to calculate your optimal sunset phase.',
      statusText: 'No Schedule Set'
    },
    { 
      id: 'ai-2', 
      name: 'Rainbow Nutrition Scan', 
      streak: 9, 
      progress: 0, 
      icon: Camera, 
      aiMessage: 'Analyzing meal colors and nutritional balance...',
      completed: false,
      type: 'NUTRITION',
      details: 'Scan your colorful meal for a rainbow energy boost.'
    }
  ]);

  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [showSleepLogger, setShowSleepLogger] = useState(false);
  const [recommendedSchedule, setRecommendedSchedule] = useState<{ sunset: string, bedtime: string } | null>(null);
  const [energyBoostActive, setEnergyBoostActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // --- Avatar Evolution Logic ---
  const getAvatarUrl = (lvl: number) => {
    // Evolution Thresholds (Stage 1–5):
    // Stage 1: Level 1–3
    // Stage 2: Level 4–6
    // Stage 3: Level 7–9
    // Stage 4: Level 10–14
    // Stage 5: Level 15+

    if (lvl <= 3) return "https://i.ibb.co/F4yY21DL/Untitled-design-3.png";
    if (lvl <= 6) return "https://i.ibb.co/21PkJLG3/Untitled-design-4.png";
    if (lvl <= 9) return "https://i.ibb.co/mVcmvZ8p/Untitled-design-5.png";
    if (lvl <= 14) return "https://i.ibb.co/JjX4gt5p/Untitled-design-6.png";
    return "https://i.ibb.co/PsyXggnD/Untitled-design-7.png";
  };

  const getRankName = (lvl: number) => {
    if (lvl >= 15) return "COSMIC";
    if (lvl >= 10) return "MASTER";
    if (lvl >= 7) return "ADVANCED";
    if (lvl >= 4) return "SKATER";
    return "STARTER";
  };

  const getRankColor = (lvl: number) => {
    if (lvl >= 15) return "#deb7ff"; // Cosmic
    if (lvl >= 10) return "#ffb4ab"; // Master
    if (lvl >= 7) return "#88d2e3"; // Advanced
    if (lvl >= 4) return "#ffd700"; // Skater
    return "#cdc3d0"; // Starter
  };

  const getRankIcon = (lvl: number) => {
    if (lvl >= 15) return Sparkles;
    if (lvl >= 10) return Trophy;
    if (lvl >= 7) return Star;
    if (lvl >= 4) return Zap;
    return ShieldAlert;
  };

  // --- Helper Helpers ---
  const syncUserDataToFirebase = useCallback(async (data: any) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error("Sync error:", err);
    }
  }, [user]);

  const addToast = (text: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // --- Automatic Level Up ---
  useEffect(() => {
    const calculatedLevel = Math.floor(xp / 500) + 1;
    if (calculatedLevel > level) {
      const oldLevel = level;
      setLevel(calculatedLevel);
      addToast(`RANK UP! NOW: ${getRankName(calculatedLevel)}`);
      
      if (user && oldLevel !== 0) { // Avoid sync on initial set if it was 0
        syncUserDataToFirebase({ level: calculatedLevel });
      }
    }
  }, [xp, level, user, syncUserDataToFirebase]);

  // --- Firebase Auth & Firestore Listener ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIsInitialLoad(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.xp !== undefined) setXp(data.xp);
        if (data.stardust !== undefined) setStardust(data.stardust);
        if (data.level !== undefined) setLevel(data.level);
        if (data.hp !== undefined) setHp(data.hp);
        if (data.enemyHp !== undefined) setEnemyHp(data.enemyHp);
        if (data.quests !== undefined) setQuests(data.quests);
        if (data.aiHabits !== undefined) setAiHabits(data.aiHabits);
        if (data.sleepLogs !== undefined) setSleepLogs(data.sleepLogs);
        if (data.multiplier !== undefined) setMultiplier(data.multiplier);
        if (data.lastActiveDate !== undefined) setLastActiveDate(data.lastActiveDate);
        if (data.monsterType !== undefined) setMonsterType(data.monsterType as any);
      } else {
        // Initialize new user
        syncUserDataToFirebase({
          xp, stardust, level, hp, enemyHp, monsterType, quests, aiHabits, sleepLogs, multiplier, lastActiveDate
        });
      }
      setIsInitialLoad(false);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
      setIsInitialLoad(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // --- Handlers ---
  const handleAttack = () => {
    const damage = 15;
    const newEnemyHp = Math.max(0, enemyHp - damage);
    const newXp = xp + 2;
    
    setEnemyHp(newEnemyHp);
    setXp(newXp);
    addToast('CRITICAL HIT! +2 XP');
    
    // Sync to Firebase
    if (user) {
      syncUserDataToFirebase({ enemyHp: newEnemyHp, xp: newXp });
    }
    
    // Reset enemy if "defeated"
    if (newEnemyHp <= 0) {
      setTimeout(() => {
        const currentMonster = MONSTERS[monsterType];
        let nextMonsterType: 'GLOOM_MITE' | 'STATIC_SERPENT' | 'GLOOM_MONARCH' = 'GLOOM_MITE';
        
        if (monsterType === 'GLOOM_MITE') nextMonsterType = 'STATIC_SERPENT';
        else if (monsterType === 'STATIC_SERPENT') nextMonsterType = 'GLOOM_MONARCH';
        else nextMonsterType = 'GLOOM_MITE';
        
        const nextMonster = MONSTERS[nextMonsterType];
        
        setMonsterType(nextMonsterType);
        setEnemyHp(nextMonster.maxHp);
        setMaxEnemyHp(nextMonster.maxHp);
        
        let reward = 50;
        if (monsterType === 'STATIC_SERPENT') reward = 150;
        if (monsterType === 'GLOOM_MONARCH') reward = 500;

        const newStardust = stardust + reward;
        setStardust(newStardust);
        setIsBossFighting(false);
        addToast(`${currentMonster.name.toUpperCase()} DEFEATED! +${reward} ✨`);
        
        if (user) {
          syncUserDataToFirebase({ 
            enemyHp: nextMonster.maxHp, 
            stardust: newStardust,
            monsterType: nextMonsterType 
          });
        }
      }, 1000);
    }
  };

  const toggleQuest = (id: string) => {
    const quest = quests.find(q => q.id === id);
    if (!quest || quest.completed) return;
    completeQuest(id);
  };

  const updateActivityMultiplier = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (lastActiveDate === today) return; // Already updated today

    if (lastActiveDate) {
      const lastDate = new Date(lastActiveDate);
      const todayDate = new Date(today);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day! Boost multiplier
        const newMultiplier = Math.min(2.0, multiplier + 0.1);
        setMultiplier(newMultiplier);
        addToast(`STREAK CONTINUED! Multiplier: ${newMultiplier.toFixed(1)}x`);
      } else {
        // Missed a day
        setMultiplier(1.0);
        addToast('STREAK RESET. Multiplier returned to 1.0x');
      }
    }
    setLastActiveDate(today);
    if (user) {
      syncUserDataToFirebase({ lastActiveDate: today, multiplier: (lastActiveDate && (Math.ceil(Math.abs(new Date(today).getTime() - new Date(lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)) === 1)) ? Math.min(2.0, multiplier + 0.1) : 1.0 });
    }
  }, [lastActiveDate, multiplier, user, syncUserDataToFirebase]);

  useEffect(() => {
    if (user && isInitialLoad === false) {
      updateActivityMultiplier();
    }
  }, [user, isInitialLoad]);

  const completeQuest = (id: string) => {
    setQuests(prev => {
      const newQuests = prev.map(q => {
        if (q.id === id) {
          const baseReward = q.xpReward;
          const boostedXp = Math.floor(baseReward * multiplier);
          const boostedStardust = Math.floor(5 * multiplier);
          
          setXp(xp + boostedXp);
          setStardust(stardust + boostedStardust);
          addToast(`${q.name} COMPLETED! +${boostedXp} XP (${multiplier.toFixed(1)}x Boost)`);
          
          return { ...q, completed: true };
        }
        return q;
      });

      if (user) {
        const quest = newQuests.find(q => q.id === id);
        if (quest) {
          syncUserDataToFirebase({
             xp: xp + Math.floor(quest.xpReward * multiplier), 
             stardust: stardust + Math.floor(5 * multiplier), 
             quests: newQuests 
          });
        }
      }

      return newQuests;
    });
  };

  const [isBossFighting, setIsBossFighting] = useState(false);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addToast('Camera not supported on this device/browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err: any) {
      console.error('Camera access denied:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        addToast('Camera permission denied. Please enable it in browser settings.');
      } else {
        addToast(`Camera error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleSleepLog = (bedtime: string, waketime: string) => {
    const [bH, bM] = bedtime.split(':').map(Number);
    const [wH, wM] = waketime.split(':').map(Number);
    
    // Simple duration calc (assumes sleep starts before midnight and ends after, or same day)
    let bTotal = bH * 60 + bM;
    let wTotal = wH * 60 + wM;
    if (wTotal < bTotal) wTotal += 24 * 60; // Next day
    
    const duration = wTotal - bTotal;
    const newLog: SleepLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      bedtime,
      waketime,
      duration
    };

    const newLogs = [newLog, ...sleepLogs].slice(0, 7); // Keep last 7 days
    setSleepLogs(newLogs);
    
    // Sync to Firebase
    if (user) {
      syncUserDataToFirebase({ sleepLogs: newLogs });
    }
    
    // Algorithm: Determine target bedtime based on wake pattern
    // We target 8 hours of sleep. Sunset starts 2 hours before bedtime.
    const avgWakeMinute = newLogs.reduce((acc, log) => {
       const [h, m] = log.waketime.split(':').map(Number);
       return acc + (h * 60 + m);
    }, 0) / newLogs.length;

    const targetBedtimeMinute = (avgWakeMinute - (8 * 60) + (24 * 60)) % (24 * 60);
    const sunsetMinute = (targetBedtimeMinute - (2 * 60) + (24 * 60)) % (24 * 60);

    const formatTime = (min: number) => {
      const h = Math.floor(min / 60);
      const m = Math.floor(min % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const schedule = {
      bedtime: formatTime(targetBedtimeMinute),
      sunset: formatTime(sunsetMinute)
    };

    setRecommendedSchedule(schedule);
    setShowSleepLogger(false);
    
    // Map to habit update
    const habitId = 'ai-1';
    setProcessingHabitId(habitId);
    setTimeout(() => {
      completeHabit(habitId, `Schedule Optimized: Sunset starts at ${schedule.sunset}`);
      setAiHabits(prev => prev.map(h => h.id === habitId ? { ...h, statusText: `Sunset: ${schedule.sunset}` } : h));
      setProcessingHabitId(null);
    }, 1500);
  };

  const toggleHabit = (id: string) => {
    const habit = aiHabits.find(h => h.id === id);
    if (!habit || habit.completed) return;

    if (habit.type === 'NUTRITION') {
      startCamera();
      setProcessingHabitId(id);
    } else if (habit.type === 'SLEEP') {
      setShowSleepLogger(true);
    } else {
      setProcessingHabitId(id);
      setTimeout(() => {
        completeHabit(id);
        setProcessingHabitId(null);
      }, 2000);
    }
  };

  const captureMeal = () => {
    if (!processingHabitId) return;
    
    // Stay in processing state but now show "Analyzing..."
    // We simulate the analysis result here
    setTimeout(() => {
      stopCamera();
      const rewards = [
        "+2 Rainbow Colors Collected!",
        "Protein Boost Detected!",
        "Hydration Bonus! +15 Stardust",
        "Vibrant Greens Found! +20 XP"
      ];
      const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
      setEnergyBoostActive(true);
      completeHabit(processingHabitId, randomReward);
      setProcessingHabitId(null);
      
      // Energy boost lasts for 30 seconds
      setTimeout(() => setEnergyBoostActive(false), 30000);
    }, 2000);
  };

  const completeHabit = (id: string, customMessage?: string) => {
    setAiHabits(prev => {
      const newHabits = prev.map(h => {
        if (h.id === id) {
          const xpReward = Math.floor(50 * multiplier); 
          const stardustReward = Math.floor(20 * multiplier);
          
          setXp(xp + xpReward);
          setStardust(stardust + stardustReward);
          addToast(customMessage || `${h.name} VERIFIED! +${xpReward} XP (${multiplier.toFixed(1)}x)`);
          
          return { ...h, completed: true, streak: h.streak + 1, progress: 100 };
        }
        return h;
      });

      if (user) {
        const habit = newHabits.find(h => h.id === id);
        if (habit) {
          syncUserDataToFirebase({
            xp: xp + Math.floor(50 * multiplier),
            stardust: stardust + Math.floor(20 * multiplier),
            aiHabits: newHabits
          });
        }
      }

      return newHabits;
    });
  };


  if (isInitialLoad) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a0935] text-[#ecdcff]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mb-4"
        >
          <Sparkles className="w-12 h-12 text-[#deb7ff]" />
        </motion.div>
        <p className="font-mono text-xs uppercase tracking-widest animate-pulse">Initializing Virtual World...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a0935] p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-12"
        >
          {/* Logo / Brand Section */}
          <div className="space-y-6">
            <div className="relative inline-block">
               <div className="absolute inset-0 bg-[#deb7ff] blur-2xl opacity-20 rounded-full" />
               <motion.div
                 animate={{ y: [0, -10, 0] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
               >
                 <img src="https://i.ibb.co/F4yY21DL/Untitled-design-3.png" alt="Hero" className="w-40 h-40 object-contain drop-shadow-2xl" />
               </motion.div>
            </div>
            
            <div className="space-y-2">
              <h1 className="font-display text-4xl text-[#ecdcff] uppercase tracking-tighter drop-shadow-lg">
                RAINBOW <span className="text-[#deb7ff]">RUN</span>
              </h1>
              <p className="font-mono text-xs text-[#cdc3d0] uppercase tracking-[0.2em] opacity-60">
                AI Powered RPG Habit Tracker
              </p>
            </div>
          </div>

          {/* Login Action Area */}
          <div className="space-y-8">
            <div className="p-6 bg-[#240046] rounded-2xl border border-[#deb7ff]/30 shadow-2xl space-y-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-[#deb7ff]/5 rounded-full blur-3xl" />
               <p className="text-sm text-[#cdc3d0] leading-relaxed">
                 Sync your progress to the cloud, evolve your warrior, and conquer the Gloom Mites.
               </p>
               <button 
                onClick={loginWithGoogle}
                className="w-full py-4 bg-white text-[#1a0935] rounded-xl font-display text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                <LogIn className="w-5 h-5" />
                CONNECT GOOGLE ACCOUNT
              </button>
            </div>

            <p className="font-mono text-[9px] text-[#cdc3d0] opacity-40 uppercase tracking-widest">
              Secured with Firebase Authentication
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#1a0935] text-[#ecdcff]">
      {/* Mobile Container Middleware */}
      <div className="relative w-full max-w-md min-h-screen flex flex-col bg-[#1a0935] shadow-2xl overflow-hidden border-x border-[#3d2c58]">
        
        {/* --- Sticky Header HUD --- */}
        <header className="fixed top-0 w-full max-w-md z-50 bg-[#1a0935]/95 backdrop-blur-md border-b-2 border-[#deb7ff] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-[#dbb8ff] bg-[#240046] flex items-center justify-center relative overflow-hidden">
                <CharacterSprite level={level} getAvatarUrl={getAvatarUrl} size="sm" />
                {level >= 5 && (
                  <div className="absolute inset-0 bg-gradient-to-t from-[#dbb8ff]/20 to-transparent pointer-events-none" />
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  {(() => {
                    const RankIcon = getRankIcon(level);
                    return <RankIcon className="w-2.5 h-2.5" style={{ color: getRankColor(level) }} />;
                  })()}
                  <h1 className="font-display text-[10px] tracking-tighter leading-none uppercase" style={{ color: getRankColor(level) }}>
                    {getRankName(level)}
                  </h1>
                </div>
                <h2 className="font-display text-sm tracking-tighter text-[#ecdcff] uppercase mt-0.5 flex items-center gap-1">
                  LV.{level} <span className="text-[#deb7ff]/50">|</span> <span className="text-[11px]">RAINBOW RUN</span>
                </h2>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                {multiplier > 1.0 && (
                  <div className="px-2 py-0.5 bg-[#deb7ff] text-[#1a0935] rounded-full font-mono text-[9px] font-bold animate-pulse">
                    {multiplier.toFixed(1)}x BOOST
                  </div>
                )}
                <div className="flex items-center gap-2 bg-[#271642] px-3 py-1 rounded-full border border-[#4b444f]">
                  <span className="text-xs font-mono text-[#deb7ff] whitespace-nowrap">{stardust} ✨</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* HP Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-display text-[#ffb4ab]">HP</span>
                <span className="text-[8px] font-mono text-[#ffb4ab]">{hp}/{maxHp}</span>
              </div>
              <div className="h-2 w-full bg-[#93000a]/20 border border-[#ffb4ab]/40 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(hp / maxHp) * 100}%` }}
                  className="h-full bg-gradient-to-r from-[#93000a] to-[#ffb4ab]"
                />
              </div>
            </div>
            {/* XP Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-display text-[#88d2e3]">XP</span>
                <span className="text-[8px] font-mono text-[#88d2e3]">{xp % 500}/500</span>
              </div>
              <div className="h-2 w-full bg-[#001a1f] border border-[#88d2e3]/40 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(xp % 500) / 5}%` }}
                  className="h-full bg-gradient-to-r from-[#004e5b] to-[#88d2e3]"
                />
              </div>
            </div>
          </div>
        </header>

        {/* --- Scrollable Content --- */}
        <main className="flex-1 pt-32 pb-32 px-4 space-y-6 overflow-y-auto">
          {currentView === 'home' && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Hero Profile Section */}
              <section className="relative px-2 py-4 flex flex-col items-center">
                 <div className="relative z-10 w-full flex flex-col items-center">
                   <div className="relative mb-8">
                     <CharacterSprite 
                       level={level} 
                       getAvatarUrl={getAvatarUrl} 
                       size="lg" 
                       energyBoost={energyBoostActive} 
                     />
                   </div>

                   <div className="w-full space-y-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="px-4 py-1.5 rounded-full bg-[#240046]/80 border-2 border-[#deb7ff]/30 flex items-center gap-2 ring-1 ring-white/5 shadow-2xl backdrop-blur-md">
                          {(() => {
                            const RankIcon = getRankIcon(level);
                            return <RankIcon className="w-4 h-4" style={{ color: getRankColor(level) }} />;
                          })()}
                          <span className="font-display text-[14px] tracking-[0.2em] uppercase font-black" style={{ color: getRankColor(level) }}>{getRankName(level)}</span>
                        </div>
                        <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-[#deb7ff]/40 to-transparent" />
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="font-display text-3xl text-[#ecdcff] uppercase tracking-tighter drop-shadow-lg">Rainbow Warrior</h3>
                        <div className="flex items-center justify-center gap-2">
                          <Activity className="w-4 h-4 text-[#deb7ff]/60" />
                          <span className="font-mono text-xs text-[#cdc3d0] uppercase tracking-wider">Level {level} • Vanguard Unit</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-4">
                         <div className="flex -space-x-2">
                            {[...Array(5)].map((_, i) => {
                               const isActive = (level >= 1) && (
                                 (i === 0) || 
                                 (i === 1 && level >= 4) || 
                                 (i === 2 && level >= 7) || 
                                 (i === 3 && level >= 10) || 
                                 (i === 4 && level >= 15)
                               );
                               return (
                                <Star 
                                  key={i} 
                                  className={`w-5 h-5 ${isActive ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-white/5'}`} 
                                />
                               );
                            })}
                         </div>
                      </div>
                   </div>
                 </div>
                 
                 {/* Scenic Background Glows */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#dbb8ff]/20 rounded-full blur-[100px] -z-10" />
              </section>

              {/* AI Habits Section (Carousel) */}
              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h2 className="font-display text-xs text-[#88d2e3] flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    AI POWERED HABITS
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const el = document.getElementById('habit-carousel');
                        if (el) el.scrollBy({ left: -260, behavior: 'smooth' });
                      }}
                      className="p-1 rounded-full bg-[#3d2c58] hover:bg-[#6a17ad] transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#deb7ff]" />
                    </button>
                    <button 
                      onClick={() => {
                        const el = document.getElementById('habit-carousel');
                        if (el) el.scrollBy({ left: 260, behavior: 'smooth' });
                      }}
                      className="p-1 rounded-full bg-[#3d2c58] hover:bg-[#6a17ad] transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-[#deb7ff]" />
                    </button>
                  </div>
                </div>

                <div 
                  id="habit-carousel"
                  className="flex gap-4 overflow-x-auto pb-4 px-1 scroll-smooth no-scrollbar"
                  style={{ scrollSnapType: 'x mandatory' }}
                >
                  {aiHabits.map((habit) => (
                    <motion.div 
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      style={{ scrollSnapAlign: 'start' }}
                      className={`relative min-w-[260px] h-[180px] bg-gradient-to-br from-[#3d2c58] to-[#23123d] rounded-2xl p-5 border border-[#88d2e3]/30 shadow-xl overflow-hidden cursor-pointer group flex flex-col justify-between transition-all active:scale-95
                        ${habit.completed ? 'opacity-70 grayscale-[0.5]' : 'hover:border-[#88d2e3]'}`}
                    >
                      {/* Glassmorphic Background Polish */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#dbb8ff]/5 rounded-full blur-3xl -mr-16 -mt-16" />
                      
                      {/* AI Processing Overlay */}
                      <AnimatePresence>
                        {processingHabitId === habit.id && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-[#1a0935]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center"
                          >
                            <div className="scanning-laser" />
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                              className="mb-3"
                            >
                              <Cpu className="w-10 h-10 text-[#88d2e3] drop-shadow-[0_0_8px_#88d2e3]" />
                            </motion.div>
                            <p className="font-mono text-[10px] text-[#88d2e3] animate-pulse leading-tight">
                              {habit.aiMessage}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex justify-between items-start">
                        <div className="w-12 h-12 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-inner">
                          <habit.icon className="w-7 h-7 text-[#88d2e3]" />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono text-[#cdc3d0] uppercase tracking-widest">Streak</span>
                          <span className="text-xl font-display text-[#deb7ff]">{habit.streak}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-display text-[11px] text-[#ecdcff] uppercase">{habit.name}</h3>
                          <p className="font-mono text-[9px] text-[#cdc3d0] leading-tight opacity-80">{habit.details}</p>
                          {habit.type === 'SLEEP' && recommendedSchedule && (
                            <div className="flex items-center gap-2 mt-1">
                              <Moon className="w-3 h-3 text-amber-400" />
                              <span className="font-mono text-[10px] text-amber-400">Sunset Phase: {recommendedSchedule.sunset}</span>
                            </div>
                          )}
                          {habit.statusText && !habit.completed && (
                            <div className="flex items-center gap-1 mt-1">
                               <Sparkles className="w-2.5 h-2.5 text-[#deb7ff]" />
                               <span className="font-mono text-[8px] text-[#deb7ff] uppercase">{habit.statusText}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-black/30 rounded-full border border-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${habit.progress}%` }}
                              className={`h-full bg-gradient-to-r ${habit.type === 'SLEEP' ? 'from-amber-400 to-orange-600' : 'from-[#88d2e3] to-[#dbb8ff]'} rounded-full`}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-[#88d2e3]">{habit.progress}%</span>
                        </div>
                      </div>

                      {/* Completed Badge */}
                      {habit.completed && (
                        <div className="absolute top-4 right-4 bg-[#deb7ff] p-1 rounded-full text-black">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Battle Arena */}
              <section className="relative pixel-border bg-[#32214d] rounded-terminal p-4 min-h-[260px] flex flex-col justify-between overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#1a0935_90%)] opacity-40 pointer-events-none" />
                
                {/* Enemy Meta */}
                <div className="relative z-10 flex flex-col gap-1">
                  <div className="flex justify-between items-center" style={{ color: MONSTERS[monsterType].color }}>
                    <span className="font-display text-xs">{MONSTERS[monsterType].name}</span>
                    <span className="font-mono text-sm leading-none">HP: {enemyHp}/{maxEnemyHp}</span>
                  </div>
                  {!isBossFighting && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-mono text-[10px] mt-1 italic leading-tight"
                      style={{ color: `${MONSTERS[monsterType].color}cc` }}
                    >
                      {MONSTERS[monsterType].description}
                    </motion.p>
                  )}
                  <div 
                    className="w-full h-3 border rounded-sm overflow-hidden mt-2"
                    style={{ 
                      backgroundColor: `${MONSTERS[monsterType].bg}33`, 
                      borderColor: MONSTERS[monsterType].color 
                    }}
                  >
                    <motion.div 
                      initial={{ width: '100%' }}
                      animate={{ width: `${(enemyHp / maxEnemyHp) * 100}%` }}
                      className="h-full"
                      style={{ backgroundColor: MONSTERS[monsterType].color }}
                    />
                  </div>
                </div>

                {/* Combat Visuals */}
                <div className="relative z-10 flex justify-between items-center py-4 px-2 min-h-[140px]">
                  {/* Player Beaver - Only shows when fighting */}
                  <div className="w-24 h-24 flex items-center justify-center">
                    <AnimatePresence>
                      {isBossFighting && (
                        <motion.div
                          initial={{ x: -100, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -100, opacity: 0 }}
                          className="flex flex-col items-center"
                        >
                           <CharacterSprite level={level} getAvatarUrl={getAvatarUrl} size="md" energyBoost={energyBoostActive} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* VS Indicator - Only shows when fighting */}
                  <div className="shrink-0">
                    <AnimatePresence>
                      {isBossFighting && (
                        <motion.div 
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 0.4 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="font-display text-lg text-[#deb7ff] italic font-black tracking-tighter"
                        >
                          VS
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Enemy Visual */}
                  <div className="relative w-[100px] h-[100px] flex items-center justify-center">
                    {monsterType === 'GLOOM_MITE' && (
                      <motion.div 
                        animate={{ 
                          y: [0, -8, 0],
                          scale: [1, 1.05, 1],
                          filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="relative cursor-pointer active:scale-90 transition-transform"
                        onClick={handleAttack}
                      >
                        <svg width="80" height="auto" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_15px_rgba(123,47,190,0.4)]">
                          <path d="M4 8H6V6H4V8ZM8 6H10V4H8V6ZM14 4H16V6H14V4ZM18 6H20V8H18V6ZM22 8V10H20V12H18V14H16V16H8V14H6V12H4V10H2V8H4V6H6V4H8V2H10V4H14V2H16V4H18V6H20V8H22ZM8 10V12H10V10H8ZM14 10V12H16V10H14ZM10 14H14V16H10V14Z" fill="#7B2FBE" />
                          <path d="M8 10H10V12H8V10ZM14 10H16V12H14V10ZM10 13H14V14H10V13Z" fill="#ff0000" />
                        </svg>
                      </motion.div>
                    )}

                    {monsterType === 'STATIC_SERPENT' && (
                      <motion.div 
                        animate={{ 
                          y: [0, -4, 0],
                          x: [0, 2, -2, 0],
                          filter: [
                            "hue-rotate(0deg) brightness(1)", 
                            "hue-rotate(90deg) brightness(1.5)", 
                            "hue-rotate(180deg) brightness(1)",
                            "hue-rotate(270deg) brightness(1.5)",
                            "hue-rotate(360deg) brightness(1)"
                          ]
                        }}
                        transition={{ 
                          duration: 4, 
                          repeat: Infinity, 
                          ease: "linear"
                        }}
                        className="relative cursor-pointer active:scale-90 transition-transform"
                        onClick={handleAttack}
                      >
                        {/* Glitch Overlay Effects */}
                        <motion.div 
                          animate={{ 
                            opacity: [0, 0.4, 0, 0.2, 0],
                            x: [0, -2, 4, -4, 0],
                            y: [0, 2, -2, 0, 1]
                          }}
                          transition={{ duration: 0.2, repeat: Infinity, repeatType: "mirror" }}
                          className="absolute inset-0 z-10 pointer-events-none mix-blend-screen"
                        >
                           <img 
                            src="https://i.ibb.co.com/XxDm4XGx/Screenshot-2026-05-28-at-11-29-17-removebg-preview.png" 
                            alt="Static Serpent Glitch" 
                            className="w-full h-full object-contain opacity-50 scale-105 saturate-200" 
                          />
                        </motion.div>
                        
                        <img 
                          src="https://i.ibb.co.com/XxDm4XGx/Screenshot-2026-05-28-at-11-29-17-removebg-preview.png" 
                          alt="Static Serpent" 
                          className="w-24 h-24 object-contain drop-shadow-[0_0_20px_#deb7ff]" 
                        />
                      </motion.div>
                    )}

                    {monsterType === 'GLOOM_MONARCH' && (
                      <motion.div 
                        animate={{ 
                          y: [0, -12, 0],
                          scale: [1, 1.1, 1],
                          filter: ["brightness(1) drop-shadow(0 0 10px #ff5252)", "brightness(1.5) drop-shadow(0 0 25px #ff5252)", "brightness(1) drop-shadow(0 0 10px #ff5252)"]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="relative cursor-pointer active:scale-95 transition-transform"
                        onClick={handleAttack}
                      >
                         <img 
                          src="https://i.ibb.co.com/CCH68Xd/Screenshot-2026-05-28-at-11-37-25-removebg-preview.png" 
                          alt="Gloom Monarch" 
                          className="w-40 h-40 object-contain" 
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="relative z-10 flex justify-center px-2">
                  {!isBossFighting ? (
                    <button 
                      onClick={() => setIsBossFighting(true)}
                      className="w-full py-4 bg-[#deb7ff] border-2 border-[#88d2e3] rounded-xl font-display text-xl text-[#402061] font-black uppercase tracking-widest shadow-[0_4px_0_#4a007f] active:translate-y-1 active:shadow-none transition-all pulse-glow"
                    >
                      BATTLE START!
                    </button>
                  ) : (
                    <button 
                      onClick={handleAttack}
                      className="w-full py-3 bg-gradient-to-r from-[#dbb8ff] to-[#deb7ff] border-2 border-[#88d2e3] rounded-xl font-display text-xl text-[#402061] font-black uppercase tracking-widest shadow-[0_4px_0_#4a007f] active:translate-y-1 active:shadow-none transition-all"
                    >
                      FIGHT!
                    </button>
                  )}
                </div>
              </section>

              {/* Daily Quests */}
              <section className="space-y-4">
                <h2 className="font-display text-sm flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#dbb8ff]" />
                  DAILY QUESTS
                </h2>
                <div className="grid gap-4">
                  {quests.map(quest => (
                    <div 
                      key={quest.id}
                      onClick={() => toggleQuest(quest.id)}
                      className={`pixel-border bg-[#271642] rounded-terminal p-4 flex items-center justify-between cursor-pointer transition-all active:scale-95 min-h-[80px] relative overflow-hidden
                        ${quest.completed ? 'opacity-60 border-[#dbb8ff]/30' : 'hover:border-[#88d2e3]'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center
                          ${quest.completed ? 'bg-[#6a17ad]/20 border-[#deb7ff]' : 'bg-[#1a0935] border-[#4b444f]'}`}>
                          <quest.icon className={`w-8 h-8 ${quest.completed ? 'text-[#deb7ff]' : 'text-[#cdc3d0]'}`} />
                        </div>
                        <div>
                          <p className={`text-xl leading-tight ${quest.completed ? 'line-through text-[#cdc3d0]' : 'text-[#ecdcff]'}`}>
                            {quest.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.25 rounded text-xs font-mono
                              ${quest.difficulty === 'EASY' ? 'bg-[#6a17ad]/30 text-[#deb7ff]' : quest.difficulty === 'MEDIUM' ? 'bg-[#3d2c58] text-[#cdc3d0]' : 'bg-[#93000a]/20 text-[#ffb4ab]'}`}>
                              {quest.difficulty}
                            </span>
                            <span className="text-xs font-mono text-[#88d2e3]">+{quest.xpReward} XP</span>
                          </div>
                        </div>
                      </div>
                      <div className={`w-10 h-10 border-4 rounded-lg flex items-center justify-center transition-colors
                        ${quest.completed ? 'bg-[#6a17ad] border-[#deb7ff]' : 'bg-transparent border-[#4b444f]'}`}>
                        {quest.completed && <Check className="w-6 h-6 text-[#d4a5ff] stroke-[3px]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pixel-border bg-[#240046] p-4 rounded-xl border-dashed flex items-center gap-4 text-[#ecdcff]">
                <Flame className="w-10 h-10 text-[#deb7ff] animate-pulse" />
                <p className="text-lg leading-tight">
                  Complete remaining quests to earn a <span className="rainbow-text inline-block font-bold">STREAK BONUS!</span>
                </p>
              </div>
            </motion.div>
          )}

          {currentView === 'stats' && <StatsView level={level} getAvatarUrl={getAvatarUrl} />}
          {currentView === 'shop' && <ShopView stardust={stardust} />}
          {currentView === 'settings' && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
              <div className="w-20 h-20 bg-[#240046] rounded-full border-2 border-[#deb7ff] flex items-center justify-center shadow-xl">
                {user ? (
                  <img src={user.photoURL || undefined} alt={user.displayName || 'Profile'} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-[#cdc3d0]" />
                )}
              </div>
              
              <div className="space-y-2">
                <h2 className="font-display text-lg uppercase tracking-tighter">
                  {user ? user.displayName : 'Vanguard Unit'}
                </h2>
                <p className="font-mono text-xs text-[#cdc3d0]">
                  {user ? user.email : 'Authentication Required'}
                </p>
              </div>

              <div className="w-full pt-6">
                {!user ? (
                  <button 
                    onClick={loginWithGoogle}
                    className="w-full py-4 bg-white text-black rounded-xl font-display text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
                  >
                    <LogIn className="w-5 h-5" />
                    SIGN IN WITH GOOGLE
                  </button>
                ) : (
                  <button 
                    onClick={() => signOut(auth)}
                    className="w-full py-4 bg-[#93000a]/20 border border-[#ffb4ab] text-[#ffb4ab] rounded-xl font-display text-sm flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    SIGN OUT
                  </button>
                ) }
              </div>

              <p className="font-mono text-[9px] text-[#cdc3d0] opacity-40 uppercase tracking-widest pt-8">
                Cloud Version 1.2.0 • Region Asia-SE1
              </p>
            </div>
          )}
          
          <div className="h-24" />
        </main>

        {/* --- Fixed Bottom Nav --- */}
        <nav className="fixed bottom-0 w-full max-w-md z-50 h-20 bg-[#3d2c58] border-t-4 border-[#dbb8ff] flex justify-around items-center px-4 pb-2">
          <NavButton icon={Home} label="HOME" active={currentView === 'home'} onClick={() => setCurrentView('home')} />
          <NavButton icon={BarChart3} label="STATS" active={currentView === 'stats'} onClick={() => setCurrentView('stats')} />
          <NavButton icon={ShoppingCart} label="SHOP" active={currentView === 'shop'} onClick={() => setCurrentView('shop')} />
          <NavButton icon={Settings} label="SETTINGS" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
          
          {/* FAB - Add Quest */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute -top-10 right-4 w-14 h-14 bg-[#dbb8ff] text-[#402061] rounded-xl shadow-lg border-2 border-white/20 flex items-center justify-center z-50"
          >
            <Plus className="w-8 h-8" />
          </motion.button>
        </nav>

        {/* --- Sleep Logger Overlay --- */}
        <AnimatePresence>
          {showSleepLogger && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-[#23123d] border-2 border-[#deb7ff] rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col gap-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-display text-sm text-[#deb7ff] uppercase">LOG RECENT SLEEP</h3>
                  <button onClick={() => setShowSleepLogger(false)} className="text-[#cdc3d0] hover:text-white">
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>

                <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="font-mono text-[10px] text-[#88d2e3] uppercase">Bedtime (Last Night)</label>
                     <input 
                       id="bedtime-input"
                       type="time" 
                       defaultValue="23:00"
                       className="w-full bg-[#1a0935] border border-[#3d2c58] rounded-xl p-3 text-white font-mono focus:border-[#deb7ff] outline-none"
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="font-mono text-[10px] text-[#88d2e3] uppercase">Wake Time (Today)</label>
                     <input 
                       id="waketime-input"
                       type="time" 
                       defaultValue="07:00"
                       className="w-full bg-[#1a0935] border border-[#3d2c58] rounded-xl p-3 text-white font-mono focus:border-[#deb7ff] outline-none"
                     />
                   </div>
                </div>

                <div className="bg-[#1a0935] p-3 rounded-xl border border-dashed border-[#4b444f]">
                  <p className="font-mono text-[10px] text-[#cdc3d0] leading-relaxed">
                    AI will analyze this pattern to establish your <span className="text-[#deb7ff]">Circadian Baseline</span>.
                  </p>
                </div>

                <button 
                  onClick={() => {
                    const b = (document.getElementById('bedtime-input') as HTMLInputElement).value;
                    const w = (document.getElementById('waketime-input') as HTMLInputElement).value;
                    handleSleepLog(b, w);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-[#88d2e3] to-[#deb7ff] rounded-2xl text-[#1a0935] font-display text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Confirm & Analyze
                </button>
              </motion.div>
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={() => setShowSleepLogger(false)} />
            </div>
          )}
        </AnimatePresence>

        {/* --- Camera Overlay for Nutrition Scan --- */}
        <AnimatePresence>
          {showCamera && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-between pointer-events-auto max-w-md mx-auto"
            >
              <div className="w-full p-4 flex justify-between items-center bg-black/50 backdrop-blur-md">
                <span className="font-display text-xs text-[#88d2e3]">RAINBOW NUTRITION SCANNER</span>
                <button onClick={stopCamera} className="p-2 rounded-full bg-white/10 text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="relative flex-1 w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
                <video 
                  autoPlay 
                  playsInline 
                  ref={(el) => {
                    if (el && cameraStream && el.srcObject !== cameraStream) {
                      el.srcObject = cameraStream;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                
                {/* HUD Elements */}
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40" />
                <div className="absolute inset-x-12 inset-y-24 border-2 border-[#88d2e3]/40 border-dashed rounded-3xl" />
                
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                  <div className="scanning-laser !w-64" />
                  <span className="font-mono text-[10px] text-[#88d2e3] animate-pulse">ALIGN MEAL WITHIN FRAME</span>
                </div>
              </div>

              <div className="w-full p-8 bg-black/80 flex flex-col items-center gap-6">
                 <button 
                   onClick={captureMeal}
                   className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-all"
                 >
                   <div className="w-16 h-16 rounded-full bg-[#88d2e3] glow-cyan" />
                 </button>
                 <p className="font-mono text-[10px] text-[#cdc3d0]">TAP TO IDENTIFY RAINBOW COLORS</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Energy Boost HUD Overlay --- */}
        <AnimatePresence>
          {energyBoostActive && (
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="fixed top-40 right-2 z-[60] bg-black/80 border-2 border-[#deb7ff] p-2 rounded-xl flex items-center gap-2 pointer-events-none"
            >
               <div className="rainbow-glow p-1 bg-[#240046] rounded-lg">
                 <Sparkles className="w-5 h-5 text-[#deb7ff]" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-display text-[#deb7ff] leading-none uppercase">Energy Boost</span>
                 <span className="text-[8px] font-mono text-cyan-400">SPEED +25%</span>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Toasts --- */}
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none space-y-2 w-full max-w-xs px-4">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-[#23123d] border-2 border-[#88d2e3] p-3 rounded-lg flex items-center gap-3 glow-cyan"
              >
                <Zap className="w-5 h-5 text-[#88d2e3]" />
                <span className="text-sm font-mono text-[#ecdcff] uppercase tracking-wide">{toast.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

// --- Sub-components ---

function CharacterSprite({ level, getAvatarUrl, size = "md", energyBoost = false }: { 
  level: number, 
  getAvatarUrl: (lvl: number) => string, 
  size?: "xs" | "sm" | "md" | "lg" | "xl",
  energyBoost?: boolean
}) {
  const sizeClasses = {
    xs: "w-8 h-8",
    sm: "w-12 h-12",
    md: "w-24 h-24",
    lg: "w-[130px] h-[130px]",
    xl: "w-48 h-48"
  };

  const avatarUrl = getAvatarUrl(level);
  const isMaster = level >= 10;
  const isCosmic = level >= 15;

  return (
    <div className={`relative flex flex-col items-center justify-end ${sizeClasses[size]}`}>
      {/* Shadow Layer */}
      <div className="absolute bottom-0 w-2/3 h-2 bg-black/40 rounded-full blur-[2px] shadow-animate" />
      
      {/* Character Layer */}
      <motion.div
        className="relative z-20 w-full h-full flex items-center justify-center pointer-events-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <img 
          src={avatarUrl}
          alt="Beaver Sprite"
          className={`w-full h-full object-contain pixel-art sprite-float bg-transparent
            ${isCosmic || energyBoost ? 'rainbow-glow' : ''}
            ${isMaster ? 'drop-shadow-[0_10px_20px_rgba(219,184,255,0.4)]' : 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]'}
          `}
        />
        
        {/* Level Up Effects */}
        <AnimatePresence>
          {energyBoost && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 0.8 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 border-2 border-[#88d2e3] rounded-full pulse-ring pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Decorative Aura for high levels */}
      {(isMaster || isCosmic) && (
        <div className="absolute inset-0 -z-10 animate-pulse">
          <div className={`absolute inset-4 rounded-full blur-2xl opacity-20 ${isCosmic ? 'bg-gradient-to-t from-transparent via-[#deb7ff] to-[#88d2e3]' : 'bg-[#deb7ff]'}`} />
        </div>
      )}
    </div>
  );
}

function StatsView({ level, getAvatarUrl }: { level: number, getAvatarUrl: (lvl: number) => string }) {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const chartData = [
    { day: 'MON', xp: 45 },
    { day: 'TUE', xp: 70 },
    { day: 'WED', xp: 30 },
    { day: 'THU', xp: 95 },
    { day: 'FRI', xp: 55 },
    { day: 'SAT', xp: 20 },
    { day: 'SUN', xp: 10 }
  ];
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Avatar Evolution Panel */}
      <section className="bg-gradient-to-br from-[#1a0935] to-[#240046] p-6 rounded-3xl border-2 border-[#dbb8ff]/20 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="font-display text-sm text-[#deb7ff] uppercase tracking-widest">Evolution Tree</h2>
          <span className="font-mono text-[10px] text-[#88d2e3] uppercase">Stage 1 → 5</span>
        </div>
        
        <div className="relative flex justify-between items-end gap-2 overflow-x-auto pb-4 no-scrollbar">
          {[1, 4, 7, 10, 15].map((lvl, idx) => (
            <div key={lvl} className="flex flex-col items-center gap-3 min-w-[80px]">
              <div className={`relative w-20 h-20 rounded-2xl border-2 flex items-center justify-center p-2 transition-all duration-500
                ${level >= lvl ? 'bg-[#3d2c58] border-[#deb7ff] shadow-[0_0_20px_rgba(219,184,255,0.3)]' : 'bg-[#1a0935]/50 border-white/5 opacity-30 scale-90'}`}>
                <CharacterSprite level={lvl} getAvatarUrl={getAvatarUrl} size="sm" />
                {level >= lvl && level < (idx === 4 ? 999 : [1, 4, 7, 10, 15][idx+1]) && idx < 5 && (
                  <motion.div 
                    layoutId="evolution-active-indicator"
                    className="absolute -top-3 bg-[#deb7ff] text-[#1a0935] px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-lg"
                  >
                    ACTIVE
                  </motion.div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className={`font-display text-[10px] uppercase font-bold ${level >= lvl ? 'text-[#ecdcff]' : 'text-[#cdc3d0]'}`}>
                  Stage {idx + 1}
                </span>
                <span className="font-mono text-[8px] text-[#cdc3d0]/60">LV.{lvl}+</span>
              </div>
            </div>
          ))}
          
          {/* Progress Connector */}
          <div className="absolute bottom-[44px] left-[40px] right-[40px] h-1 bg-white/5 -z-10 rounded-full">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${Math.min(100, (([1, 4, 7, 10, 15].filter(v => level >= v).length - 1) / 4) * 100)}%` }}
               className="h-full bg-gradient-to-r from-[#88d2e3] via-[#deb7ff] to-[#dbb8ff] rounded-full"
            />
          </div>
        </div>
      </section>

      <section className="pixel-border bg-[#240046] p-5 rounded-none border-[#7B2FBE] relative">
        <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-[#A3EDFF]" />
        <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-[#A3EDFF]" />
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display text-sm text-[#dbb8ff]">WEEKLY XP</h2>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-[#deb7ff]" />
            <div className="w-2 h-2 bg-[#88d2e3]" />
          </div>
        </div>
        
        <div className="h-56 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#cdc3d0', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis 
                hide 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(219, 184, 255, 0.1)' }}
                contentStyle={{ 
                  backgroundColor: '#23123d', 
                  border: '1px solid #deb7ff',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontFamily: 'monospace'
                }}
                itemStyle={{ color: '#deb7ff' }}
                labelStyle={{ color: '#88d2e3', marginBottom: '4px' }}
              />
              <RechartsBar dataKey="xp" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 3 ? '#deb7ff' : '#705093'} 
                    className={index === 3 ? 'drop-shadow-[0_0_8px_#deb7ff]' : ''}
                  />
                ))}
              </RechartsBar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="pixel-border bg-[#240046] p-5 space-y-4">
        <h2 className="font-display text-xs text-[#88d2e3]">STREAKS</h2>
        <div className="space-y-3">
          <StreakItem icon={Droplets} label="WATER" count={5} color="text-blue-400" borderColor="border-blue-400" />
          <StreakItem icon={Footprints} label="STEPS" count={3} color="text-orange-400" borderColor="border-orange-400" />
          <StreakItem icon={Dumbbell} label="WORKOUT" count={2} color="text-red-400" borderColor="border-red-400" />
        </div>
      </section>

      <section className="pixel-border bg-gradient-to-br from-[#240046] to-[#1a0935] p-5">
        <h2 className="font-display text-xs text-[#deb7ff] mb-4">HALL OF FAME</h2>
        <div className="space-y-4">
          <div className="flex flex-col">
            <span className="font-mono text-xs text-[#cdc3d0]">PERFECT DAYS</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl text-[#deb7ff]">12</span>
              <Star className="w-5 h-5 text-[#deb7ff] fill-current" />
            </div>
          </div>
          <div className="h-px bg-[#3d2c58]" />
          <div className="flex flex-col">
            <span className="font-mono text-xs text-[#cdc3d0]">BEST STREAK</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl text-[#88d2e3]">8</span>
              <span className="font-mono text-sm text-[#88d2e3]">DAYS</span>
            </div>
          </div>
          <div className="mt-4 p-3 border border-dashed border-[#4b444f] text-center">
            <p className="font-mono text-xs text-[#cdc3d0]">
              SYSTEM STATUS: <span className="text-[#deb7ff]">ACTIVE_</span>
            </p>
          </div>
        </div>
      </section>

      <section className="pixel-border bg-[#240046] p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-xs text-[#ecdcff]">BADGES</h2>
          <button className="font-mono text-xs text-[#dbb8ff] underline">VIEW ALL</button>
        </div>
        <div className="flex justify-around items-center py-2 overflow-x-auto gap-4">
          <Badge icon={Trophy} label="EARLY BIRD" active />
          <Badge icon={Flame} label="ON FIRE" active />
          <Badge icon={Lock} label="MARATHON" />
          <Badge icon={Lock} label="ZEN" />
        </div>
      </section>
    </motion.div>
  );
}

function ShopView({ stardust }: { stardust: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4">
        <div className="bg-[#32214d] border-2 border-[#dbb8ff] p-4 flex items-center gap-4 rounded-xl">
          <Zap className="w-8 h-8 text-[#dbb8ff]" />
          <div>
            <div className="font-mono text-xs text-[#dbb8ff] uppercase tracking-tighter">Stardust Balance</div>
            <div className="font-display text-lg text-[#ecdcff]">{stardust}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <ShopCard category="COMMON" icon={Zap} title="Star Hair Clip" desc="Sparkles when gaining XP" price={30} />
          <ShopCard category="RARE" icon={BackpackIcon} title="Moon Backpack" desc="Saves 1 missed habit" price={75} />
          <ShopCard category="EPIC" icon={ShieldAlert} title="Galaxy Tail Armor" desc="Keeps streak multiplier" price={100} />
          <ShopCard category="LEGENDARY" icon={Zap} title="Nebula Wings" desc="Rare, doubles XP" price={250} owned />
        </div>

        <section className="bg-[#23123d] border-2 border-[#dbb8ff] rounded-2xl p-6 space-y-4">
           <h2 className="font-display text-xs text-[#dbb8ff] uppercase">Current Loadout</h2>
           <div className="flex gap-4">
              <div className="w-14 h-14 bg-[#3d2c58] rounded-xl border border-[#deb7ff] flex items-center justify-center">
                <Archive className="w-6 h-6 text-[#deb7ff]" />
              </div>
              <div className="w-14 h-14 bg-[#3d2c58] rounded-xl border border-[#deb7ff] flex items-center justify-center">
                <Archive className="w-6 h-6 text-[#deb7ff]" />
              </div>
              <div className="w-14 h-14 bg-[#3d2c58] rounded-xl border-2 border-[#88d2e3] flex items-center justify-center glow-cyan">
                <Star className="w-6 h-6 text-[#88d2e3]" />
              </div>
              <div className="w-14 h-14 bg-[#1a0935]/50 rounded-xl border border-dashed border-[#4b444f] flex items-center justify-center">
                <Plus className="w-6 h-6 text-[#4b444f]" />
              </div>
           </div>
           <div className="pt-4">
              <div className="flex justify-between text-xs font-mono text-[#cdc3d0] mb-1">
                <span>XP MULTIPLIER ACTIVE</span>
                <span className="text-[#88d2e3]">2.5X</span>
              </div>
              <div className="h-3 bg-[#3d2c58] rounded-full overflow-hidden border border-[#4b444f]">
                <div className="h-full rainbow-gradient w-3/4 animate-pulse" />
              </div>
           </div>
        </section>

        <section className="bg-gradient-to-br from-[#6a17ad] to-[#240046] border-2 border-[#deb7ff] rounded-2xl p-6 text-center space-y-3">
          <Package className="w-12 h-12 text-[#d4a5ff] mx-auto" />
          <h3 className="font-display text-sm">Cosmic Lootbox</h3>
          <p className="font-mono text-xs text-[#d4a5ff]/80">Try your luck for 500 ✨</p>
          <button className="px-6 py-2 bg-[#d4a5ff] text-[#402061] font-mono text-sm rounded-lg active:scale-95 transition-all">
            OPEN
          </button>
        </section>
      </div>
    </motion.div>
  );
}

function StreakItem({ icon: Icon, label, count, color, borderColor }: any) {
  return (
    <div className={`flex items-center justify-between bg-[#32214d] p-3 border-l-4 ${borderColor}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="font-mono text-sm text-[#ecdcff]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-display text-sm ${color}`}>{count}</span>
        <span className="font-mono text-[10px] text-[#cdc3d0]">DAYS</span>
      </div>
    </div>
  );
}

function Badge({ icon: Icon, label, active = false }: any) {
  return (
    <div className={`flex flex-col items-center gap-1 shrink-0 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 
        ${active ? 'bg-[#6a17ad] border-[#deb7ff] shadow-[0_0_10px_rgba(219,184,255,0.4)]' : 'bg-[#271642] border-[#4b444f]'}`}>
        <Icon className={`w-6 h-6 ${active ? 'text-[#d4a5ff]' : 'text-[#cdc3d0]'}`} />
      </div>
      <span className="font-mono text-[8px] text-center leading-tight whitespace-nowrap">{label}</span>
    </div>
  );
}

function ShopCard({ category, icon: Icon, title, desc, price, owned = false }: any) {
  return (
    <div className={`bg-[#271642] border-[3px] rounded-none group relative overflow-hidden
      ${owned ? 'border-[#88d2e3]' : 'border-[#deb7ff] hover:border-[#88d2e3]'}`}>
      {owned && (
        <div className="absolute inset-0 bg-[#1a0935]/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-[#88d2e3] text-[#00363f] font-mono text-sm px-4 py-1 rotate-[-5deg] border-2 border-[#00363f] font-bold">
            OWNED
          </div>
        </div>
      )}
      <div className="bg-[#6a17ad] p-1.5 px-3 border-b-[3px] border-[#deb7ff] flex justify-between items-center">
        <span className="font-mono text-[10px] text-[#d4a5ff]">{category}</span>
        <Zap className="w-3 h-3 text-[#d4a5ff]" />
      </div>
      <div className="p-5 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-[#3d2c58] rounded-xl flex items-center justify-center mb-3">
          <Icon className="w-8 h-8 text-[#deb7ff]" />
        </div>
        <h3 className="font-display text-[10px] text-[#ecdcff] mb-1">{title}</h3>
        <p className="font-mono text-[10px] text-[#cdc3d0] h-6">{desc}</p>
        <button 
          disabled={owned}
          className={`w-full mt-4 py-2 font-mono text-sm rounded-xl border-2 transition-all active:scale-95
            ${owned ? 'bg-[#4b444f] border-[#cdc3d0] text-[#cdc3d0]' : 'bg-gradient-to-r from-[#dbb8ff] to-[#deb7ff] border-[#88d2e3] text-[#402061] shadow-[3px_3px_0_#4a007f]'}`}
        >
          {owned ? 'PURCHASED' : `${price} ✨`}
        </button>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center px-3 py-1 rounded-xl transition-all active:scale-95
      ${active ? 'bg-[#6a17ad] text-[#d4a5ff] shadow-[0_0_10px_rgba(219,184,255,0.3)]' : 'text-[#cdc3d0] hover:text-[#88d2e3]'}`}>
      <Icon className={`w-6 h-6 ${active ? 'fill-current' : ''}`} />
      <span className="text-[10px] font-mono mt-1 tracking-widest">{label}</span>
    </button>
  );
}
