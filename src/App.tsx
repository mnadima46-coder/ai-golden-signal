/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Check, Volume2, VolumeX, History, Activity, Minimize2, Sparkles, ExternalLink, Globe, Shield, Wifi, Cpu, Zap, Play, Cloud, CloudUpload, Key, LogIn, LogOut, RefreshCw, Database } from 'lucide-react';
import { initAuth, googleSignIn, logout } from './googleAuth';
import { findBackupFile, createBackupFile, updateBackupFile, downloadBackupFile } from './googleDrive';
import { testFirestoreConnection, saveBackupToFirestore, getBackupFromFirestore } from './firestoreSync';
import type { User } from 'firebase/auth';

interface SignalState {
  color: 'Red' | 'Green' | 'Violet';
  number: number;
  size: 'BIG' | 'SMALL';
}

interface MarketHistoryLog {
  id: number;
  prediction: 'BIG' | 'SMALL';
  result: 'WIN' | 'LOSS';
}

// Low-latency high fidelity clock offset/period synchronized generators
const getPeriodNumber = (mode: string = "30s", extraOffsetSec: number = 0, timeOffsetSec: number = 0): string => {
  const now = new Date();
  const offsetTime = new Date(now.getTime() + (timeOffsetSec + extraOffsetSec) * 1000);
  
  const year = offsetTime.getUTCFullYear();
  const month = String(offsetTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(offsetTime.getUTCDate()).padStart(2, '0');
  
  const hours = offsetTime.getUTCHours();
  const minutes = offsetTime.getUTCMinutes();
  const seconds = offsetTime.getUTCSeconds();
  
  let periodSeq = 0;
  if (mode === "30s") {
    periodSeq = hours * 120 + minutes * 2 + Math.floor(seconds / 30) + 1;
  } else if (mode === "1 Min") {
    periodSeq = hours * 60 + minutes + 1;
  } else if (mode === "3 Min") {
    periodSeq = Math.floor((hours * 60 + minutes) / 3) + 1;
  } else if (mode === "5 Min") {
    periodSeq = Math.floor((hours * 60 + minutes) / 5) + 1;
  } else if (mode === "10 Min") {
    periodSeq = Math.floor((hours * 60 + minutes) / 10) + 1;
  }
  
  const seqStr = String(periodSeq).padStart(4, '0');
  return `${year}${month}${day}01${seqStr}`;
};

const formatCountdown = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');
  return `${mStr}:${sStr}`;
};

export default function App() {
  // Dual-workspace web platform integration states
  const [targetUrl, setTargetUrl] = useState("https://dkwin9.com/#/login");
  const [urlInput, setUrlInput] = useState("https://dkwin9.com/#/login");
  const [isControlBarOpen, setIsControlBarOpen] = useState(true);

  // Advanced game state tracking
  const [wingoMode, setWingoMode] = useState<'30s' | '1 Min' | '3 Min' | '5 Min' | '10 Min'>('30s');
  const [seconds, setSeconds] = useState(30);
  const [timeOffset, setTimeOffset] = useState(0); // clock calibration offset in seconds
  const [periodNumber, setPeriodNumber] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [winCount, setWinCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);
  const [historyLogs, setHistoryLogs] = useState<MarketHistoryLog[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Advanced Self-Learning AI tracking series
  const [trueMarketHistory, setTrueMarketHistory] = useState<('BIG' | 'SMALL')[]>([]);
  const [detectedPattern, setDetectedPattern] = useState<string>("স্ট্যাটিস্টিক প্রজেকশন মোড");

  // default live prediction signal
  const [liveSignal, setLiveSignal] = useState<SignalState>({
    color: 'Red',
    number: 6,
    size: 'BIG'
  });

  // Real-time market results synchronization states
  const [processedPeriods, setProcessedPeriods] = useState<string[]>([]);
  const [predictionRegistry, setPredictionRegistry] = useState<Record<string, SignalState>>({});

  // Google Drive integrations & auth states
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string>("সক্ষম");
  const [backupFileId, setBackupFileId] = useState<string | null>(null);
  const [hasCloudBackup, setHasCloudBackup] = useState<boolean>(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Firebase Firestore integration states
  const [firebaseBackupStatus, setFirebaseBackupStatus] = useState<string>("সক্ষম");
  const [lastFirebaseBackupTime, setLastFirebaseBackupTime] = useState<string | null>(null);
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState<boolean>(false);
  const [hasFirebaseBackup, setHasFirebaseBackup] = useState<boolean>(false);

  // Check if a backup exists in Firestore
  const checkFirestoreBackupExistence = async (userId: string) => {
    setIsFirebaseSyncing(true);
    try {
      const data = await getBackupFromFirestore(userId);
      if (data) {
        setHasFirebaseBackup(true);
        if (data.backupTime) {
          setLastFirebaseBackupTime(data.backupTime);
        }
      } else {
        setHasFirebaseBackup(false);
        setLastFirebaseBackupTime(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  // Backup state/logs to Firebase Firestore
  const handleBackupToFirestore = async () => {
    if (!user) return;
    setFirebaseBackupStatus("ব্যাকআপ হচ্ছে...");
    setIsFirebaseSyncing(true);
    try {
      const backupObj = {
        winCount,
        lossCount,
        historyLogs,
        trueMarketHistory,
        wingoMode,
        timeOffset,
        targetUrl,
        backupTime: new Date().toLocaleString('bn-BD'),
        processedPeriods
      };

      const success = await saveBackupToFirestore(user.uid, backupObj);
      if (success) {
        setFirebaseBackupStatus("ব্যাকআপ সম্পন্ন!");
        setHasFirebaseBackup(true);
        setLastFirebaseBackupTime(backupObj.backupTime);
      } else {
        setFirebaseBackupStatus("ত্রুটি ঘটেছে");
      }
    } catch (err) {
      setFirebaseBackupStatus("ত্রুটি ঘটেছে");
      console.error(err);
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  // Restore state/logs from Firebase Firestore
  const handleRestoreFromFirestore = async () => {
    if (!user) return;
    const confirmRestore = window.confirm("ফায়ারবেস ডাটাবেস ব্যাকআপ থেকে সমস্ত ডেটা রিস্টোর করতে চান? আপনার বর্তমান সেশনের ডেটা পরিবর্তিত হয়ে যাবে।");
    if (!confirmRestore) return;

    setFirebaseBackupStatus("রিস্টোর হচ্ছে...");
    setIsFirebaseSyncing(true);
    try {
      const data = await getBackupFromFirestore(user.uid);
      if (data) {
        setWinCount(data.winCount || 0);
        setLossCount(data.lossCount || 0);
        setHistoryLogs(data.historyLogs || []);
        setTrueMarketHistory(data.trueMarketHistory || []);
        setWingoMode(data.wingoMode || '30s');
        setTimeOffset(data.timeOffset || 0);
        setTargetUrl(data.targetUrl || "https://dkwin9.com/#/login");
        setUrlInput(data.targetUrl || "https://dkwin9.com/#/login");
        if (data.processedPeriods) {
          setProcessedPeriods(data.processedPeriods);
        }
        setFirebaseBackupStatus("রিস্টোর সফল!");
      } else {
        setFirebaseBackupStatus("ব্যাকআপ পাওয়া যায়নি");
      }
    } catch (err) {
      setFirebaseBackupStatus("ত্রুটি ঘটেছে");
      console.error(err);
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  // Check if a backup file exists in Google Drive
  const checkDriveBackupExistence = async (token: string) => {
    setIsSyncing(true);
    try {
      const fileId = await findBackupFile(token);
      setBackupFileId(fileId);
      if (fileId) {
        setHasCloudBackup(true);
        // Let's download metadata/content to get the backupTime
        const backupObj = await downloadBackupFile(token, fileId);
        if (backupObj && backupObj.backupTime) {
          setLastBackupTime(backupObj.backupTime);
        }
      } else {
        setHasCloudBackup(false);
        setLastBackupTime(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Login handler
  const handleCloudLogin = async () => {
    setBackupStatus("লগইন হচ্ছে...");
    setFirebaseBackupStatus("লগইন হচ্ছে...");
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setBackupStatus("লগইন সফল!");
        setFirebaseBackupStatus("লগইন সফল!");
        await checkDriveBackupExistence(res.accessToken);
        await checkFirestoreBackupExistence(res.user.uid);
      }
    } catch (err) {
      setBackupStatus("লগইন ব্যর্থ");
      setFirebaseBackupStatus("লগইন ব্যর্থ");
    }
  };

  // Logout handler
  const handleCloudLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setBackupFileId(null);
    setHasCloudBackup(false);
    setLastBackupTime(null);
    setBackupStatus("লগআউট সম্পন্ন");

    // Reset Firebase Firestore states
    setHasFirebaseBackup(false);
    setLastFirebaseBackupTime(null);
    setFirebaseBackupStatus("অসংযুক্ত");
  };

  // Backup state/logs to Google Drive
  const handleBackupToCloud = async () => {
    if (!accessToken) return;
    setBackupStatus("ব্যাকআপ হচ্ছে...");
    setIsSyncing(true);
    try {
      const backupObj = {
        winCount,
        lossCount,
        historyLogs,
        trueMarketHistory,
        wingoMode,
        timeOffset,
        targetUrl,
        backupTime: new Date().toLocaleString('bn-BD'),
        processedPeriods
      };

      let fileId = backupFileId;
      if (fileId) {
        const confirmUpdate = window.confirm("গুগল ড্রাইভে পূর্বের ব্যাকআপ ফাইলটি ওভাররাইট (নতুন ডেটা দিয়ে পরিবর্তন) করতে চান?");
        if (!confirmUpdate) {
          setBackupStatus("বাতিল করা হয়েছে");
          setIsSyncing(false);
          return;
        }
        
        const success = await updateBackupFile(accessToken, fileId, backupObj);
        if (success) {
          setBackupStatus("ব্যাকআপ সম্পন্ন!");
          setLastBackupTime(backupObj.backupTime);
        } else {
          setBackupStatus("ত্রুটি ঘটেছে");
        }
      } else {
        const newId = await createBackupFile(accessToken, backupObj);
        if (newId) {
          setBackupFileId(newId);
          setHasCloudBackup(true);
          setLastBackupTime(backupObj.backupTime);
          setBackupStatus("ব্যাকআপ সম্পন্ন!");
        } else {
          setBackupStatus("ত্রুটি ঘটেছে");
        }
      }
    } catch (err) {
      setBackupStatus("ত্রুটি ঘটেছে");
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore state/logs from Google Drive
  const handleRestoreFromCloud = async () => {
    if (!accessToken || !backupFileId) return;
    
    const confirmRestore = window.confirm("গুগল ড্রাইভের ব্যাকআপ থেকে সমস্ত ডেটা রিস্টোর করতে চান? আপনার বর্তমান সেশনের ডেটা পরিবর্তিত হয়ে যাবে।");
    if (!confirmRestore) return;
    
    setBackupStatus("রিস্টোর হচ্ছে...");
    setIsSyncing(true);
    try {
      const backupObj = await downloadBackupFile(accessToken, backupFileId);
      if (backupObj) {
        setWinCount(backupObj.winCount);
        setLossCount(backupObj.lossCount);
        setHistoryLogs(backupObj.historyLogs);
        setTrueMarketHistory(backupObj.trueMarketHistory);
        setWingoMode(backupObj.wingoMode);
        setTimeOffset(backupObj.timeOffset);
        setTargetUrl(backupObj.targetUrl);
        setUrlInput(backupObj.targetUrl);
        if (backupObj.processedPeriods) {
          setProcessedPeriods(backupObj.processedPeriods);
        }
        setBackupStatus("রিস্টোর সফল!");
      } else {
        setBackupStatus("রিস্টোর ব্যর্থ");
      }
    } catch (err) {
      setBackupStatus("ত্রুটি ঘটেছে");
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-authenticate subscription on mount
  useEffect(() => {
    // Validate Firestore live connection
    testFirestoreConnection();

    const unsubscribe = initAuth(
      (firebaseUser, token) => {
        setUser(firebaseUser);
        setAccessToken(token);
        checkDriveBackupExistence(token);
        checkFirestoreBackupExistence(firebaseUser.uid);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setBackupFileId(null);
        setHasCloudBackup(false);
        setLastBackupTime(null);
        
        setHasFirebaseBackup(false);
        setLastFirebaseBackupTime(null);
        setFirebaseBackupStatus("অসংযুক্ত");
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // Keep a ref of hasVoted for state bypasses
  const hasVotedRef = useRef(hasVoted);
  useEffect(() => {
    hasVotedRef.current = hasVoted;
  }, [hasVoted]);

  // Widget drifting positions
  const [position, setPosition] = useState({ x: 30, y: 130 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Safety refs to bypass effect restarts
  const isVoiceMutedRef = useRef(isVoiceMuted);
  useEffect(() => {
    isVoiceMutedRef.current = isVoiceMuted;
  }, [isVoiceMuted]);

  const liveSignalRef = useRef(liveSignal);
  useEffect(() => {
    liveSignalRef.current = liveSignal;
  }, [liveSignal]);

  // Self-Learning Prediction calculation engine using historical user feedback
  const getLearnedPrediction = (history: ('BIG' | 'SMALL')[]): { size: 'BIG' | 'SMALL'; patternName: string; confidence: number } => {
    if (history.length === 0) {
      const isBig = Math.random() >= 0.5;
      return {
        size: isBig ? 'BIG' : 'SMALL',
        patternName: "স্ট্যাটিস্টিক প্রজেকশন",
        confidence: 94.5
      };
    }

    // Pattern A: Multi-Round Streak (Dragon Trend) with breaking check
    let consecutiveSame = 1;
    const firstType = history[0];
    for (let i = 1; i < history.length; i++) {
      if (history[i] === firstType) {
        consecutiveSame++;
      } else {
        break;
      }
    }

    if (consecutiveSame >= 3) {
      if (consecutiveSame >= 5) {
        // Trend reversal when a streak is excessively long
        const reversed = firstType === 'BIG' ? 'SMALL' : 'BIG';
        return {
          size: reversed,
          patternName: `মেজর রিভার্সাল ট্রেন্ড`,
          confidence: 97.4
        };
      } else {
        // Continue short streak
        return {
          size: firstType,
          patternName: `${firstType === 'BIG' ? 'বিগ' : 'স্মল'} ড্রাগন ট্রেন্ড`,
          confidence: 98.2
        };
      }
    }

    // Pattern B: Alternating Sequence (BIG -> SMALL -> BIG)
    let isAlternating = true;
    const limit = Math.min(history.length - 1, 4);
    for (let i = 0; i < limit; i++) {
      if (history[i] === history[i + 1]) {
        isAlternating = false;
        break;
      }
    }
    if (isAlternating && history.length >= 2) {
      const nextAlternating = history[0] === 'BIG' ? 'SMALL' : 'BIG';
      return {
        size: nextAlternating,
        patternName: `পর্যায়ক্রমিক ট্রেন্ড (${nextAlternating === 'BIG' ? 'বিগ' : 'স্মল'})`,
        confidence: 99.1
      };
    }

    // Pattern C: Balanced state check
    const bigs = history.filter((x) => x === 'BIG').length;
    const smalls = history.length - bigs;
    if (Math.abs(bigs - smalls) >= 3) {
      const lessFrequent = bigs > smalls ? 'SMALL' : 'BIG';
      return {
        size: lessFrequent,
        patternName: "ভারসাম্য অনুপাত প্রজেকশন",
        confidence: 96.5
      };
    }

    // Default Fallback: Random but balanced rotation
    const lastOutcome = history[0];
    const shouldKeep = Math.random() < 0.45;
    const nextSize = shouldKeep ? lastOutcome : (lastOutcome === 'BIG' ? 'SMALL' : 'BIG');
    return {
      size: nextSize,
      patternName: "স্ট্যাটিস্টিক ডিস্ট্রিবিউশন",
      confidence: 95.0
    };
  };

  // Automated algorithmic live signal generation
  const generateNextSignal = (targetPeriod?: string) => {
    setTrueMarketHistory((prev) => {
      // If user hasn't voted of the previous round, append a random choice to prevent self-reinforcing loops
      const updatedHistory = hasVotedRef.current ? prev : [(Math.random() >= 0.5 ? 'BIG' : 'SMALL'), ...prev];
      const trimmedHistory = updatedHistory.slice(0, 15);
      
      // Calculate next size using our advanced self-learning trend predictor
      const learnedResult = getLearnedPrediction(trimmedHistory);
      setDetectedPattern(learnedResult.patternName);

      const randomNum = learnedResult.size === 'BIG' 
        ? [5, 6, 7, 8, 9][Math.floor(Math.random() * 5)]
        : [0, 1, 2, 3, 4][Math.floor(Math.random() * 5)];

      const assignedColor = (randomNum === 0 || randomNum === 5) ? 'Violet' : (randomNum % 2 === 0 ? 'Red' : 'Green');

      const nextSignal: SignalState = { color: assignedColor, number: randomNum, size: learnedResult.size };
      setLiveSignal(nextSignal);

      // Register the prediction for calculation reference when real-time results lock
      if (targetPeriod) {
        setPredictionRegistry((prevRegistry) => ({
          ...prevRegistry,
          [targetPeriod]: nextSignal
        }));
      }

      // AI Verbal sound report in Bengali
      if (!isVoiceMutedRef.current && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const vocalSentence = `সংখ্যা ${randomNum}, আসবে ${learnedResult.size === 'BIG' ? 'বিগ' : 'স্মল'}`;
        const utterance = new SpeechSynthesisUtterance(vocalSentence);
        utterance.lang = 'bn-BD';
        utterance.rate = 1.05;
        utterance.pitch = 1.25;
        window.speechSynthesis.speak(utterance);
      }

      return trimmedHistory;
    });
  };

  const lastPredictionPeriodRef = useRef<string>("");

  useEffect(() => {
    const updateTimer = () => {
      const nowMs = Date.now();
      // Apply offset parameter (timeOffset is in seconds)
      const adjustedTimeMs = nowMs + timeOffset * 1000;
      
      // Calculate how many ms in a single cycle for the current mode
      let cycleMs = 60000;
      if (wingoMode === '30s') {
        cycleMs = 30000;
      } else if (wingoMode === '1 Min') {
        cycleMs = 60000;
      } else if (wingoMode === '3 Min') {
        cycleMs = 180000;
      } else if (wingoMode === '5 Min') {
        cycleMs = 300000;
      } else if (wingoMode === '10 Min') {
        cycleMs = 600000;
      }
      
      const elapsedMsInCycle = adjustedTimeMs % cycleMs;
      const remainingMs = cycleMs - elapsedMsInCycle;
      
      // Traditional Wingo displays remaining seconds as (duration - 1) down to 0
      const remainingSeconds = Math.floor(remainingMs / 1000);
      setSeconds(remainingSeconds);
      
      // Lock phase is exactly the last 5 seconds of the countdown (when remainingSeconds is 0, 1, 2, 3, or 4)
      const isLockPhase = remainingSeconds < 5;
      
      // If we are in the lock phase, we predict for the UPCOMING period.
      // E.g. we add the full cycle duration in seconds if in lock phase.
      const targetOffsetSec = isLockPhase ? (cycleMs / 1000) : 0;
      
      const currentPeriod = getPeriodNumber(wingoMode, targetOffsetSec, timeOffset);
      setPeriodNumber(currentPeriod);
      
      // Trigger prediction exactly when we enter the lock phase (last 5 seconds)
      if (isLockPhase) {
        if (lastPredictionPeriodRef.current !== currentPeriod) {
          lastPredictionPeriodRef.current = currentPeriod;
          setHasVoted(false);
          generateNextSignal(currentPeriod);
        }
      }
    };

    // Run immediately
    updateTimer();
    
    // Low latency check/update every 100ms to ensure 150% real-time responsive sync without any lag
    const timerId = setInterval(updateTimer, 100);
    return () => clearInterval(timerId);
  }, [wingoMode, timeOffset]);

  // Keep a ref of current predictions, processed periods, and true history to prevent async race conditions
  const processedPeriodsRef = useRef<string[]>([]);
  useEffect(() => {
    processedPeriodsRef.current = processedPeriods;
  }, [processedPeriods]);

  const predictionRegistryRef = useRef<Record<string, SignalState>>({});
  useEffect(() => {
    predictionRegistryRef.current = predictionRegistry;
  }, [predictionRegistry]);

  const trueMarketHistoryRef = useRef<('BIG' | 'SMALL')[]>([]);
  useEffect(() => {
    trueMarketHistoryRef.current = trueMarketHistory;
  }, [trueMarketHistory]);

  // Periodic poll of real market results from the server proxy
  useEffect(() => {
    const handleRealMarketSync = async () => {
      try {
        const response = await fetch("/api/real-market");
        if (!response.ok) return;
        const data = await response.json();
        
        if (data.success && Array.isArray(data.history) && data.history.length > 0) {
          const latestResults = data.history;
          
          let updatedProcessed = [...processedPeriodsRef.current];
          let updatedWins = 0;
          let updatedLosses = 0;
          let newHistoryLogs: MarketHistoryLog[] = [];
          let hasChange = false;
          let updatedTrueHistory = [...trueMarketHistoryRef.current];

          // Iterate through results chronologically (oldest to newest) to process properly
          const sortedResultsDesc = [...latestResults].sort((a, b) => a.period.localeCompare(b.period));

          for (const realRes of sortedResultsDesc) {
            const periodKey = realRes.period;
            
            // If we haven't processed this period's result yet
            if (!processedPeriodsRef.current.includes(periodKey)) {
              // Mark as processed
              updatedProcessed.push(periodKey);
              hasChange = true;

              // Check if we predicted for this period
              const prediction = predictionRegistryRef.current[periodKey];
              if (prediction) {
                // Determine actual outcome vs prediction
                const isWin = prediction.size === realRes.size;
                
                if (isWin) {
                  updatedWins++;
                } else {
                  updatedLosses++;
                }

                // Add to history log
                newHistoryLogs.push({
                  id: Date.now() + Math.floor(Math.random() * 1000), // unique temporary ID
                  prediction: prediction.size,
                  result: isWin ? 'WIN' : 'LOSS'
                });

                // Voice notification about the real-time feedback
                if ('speechSynthesis' in window && !isVoiceMutedRef.current) {
                  window.speechSynthesis.cancel();
                  const vocal = isWin 
                    ? `পিরিয়ড ${periodKey.slice(-4)} সফল হয়েছে। বিগ উইন!`
                    : `পিরিয়ড ${periodKey.slice(-4)} এর ফলাফল বিপরীত হয়েছে। ডাটা রেকর্ড করা হয়েছে।`;
                  const utterance = new SpeechSynthesisUtterance(vocal);
                  utterance.lang = 'bn-BD';
                  window.speechSynthesis.speak(utterance);
                }
              }

              // Append this actual outcome to trueMarketHistory so learning model learns from real data!
              updatedTrueHistory = [realRes.size, ...updatedTrueHistory].slice(0, 15);
            }
          }

          if (hasChange) {
            setProcessedPeriods(updatedProcessed);
            
            if (updatedWins > 0) {
              setWinCount(prev => prev + updatedWins);
            }
            if (updatedLosses > 0) {
              setLossCount(prev => prev + updatedLosses);
            }
            if (newHistoryLogs.length > 0) {
              setHistoryLogs(prev => [...newHistoryLogs, ...prev]);
            }
            
            setTrueMarketHistory(updatedTrueHistory);
            
            // If the market has updated with new data, trigger next period’s prediction immediately!
            // This ensures our prediction is always calculated based on the latest real data!
            const upcomingPeriod = getPeriodNumber(wingoMode, 0, timeOffset);
            generateNextSignal(upcomingPeriod);
          }
        }
      } catch (err) {
        // Silently catch network or parsing exceptions
      }
    };

    // Poll every 3 seconds to ensure real-time responsiveness without network strain
    const intervalId = setInterval(handleRealMarketSync, 3000);
    return () => clearInterval(intervalId);
  }, [wingoMode, timeOffset]);

  // Draggable gesture helpers
  const handleStart = (clientX: number, clientY: number) => {
    isDragging.current = true;
    dragStart.current = { x: clientX - position.x, y: clientY - position.y };
  };

  // Dynamic window position move tracking
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const nextX = Math.max(8, Math.min(window.innerWidth - 170, e.clientX - dragStart.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 250, e.clientY - dragStart.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      const nextX = Math.max(8, Math.min(window.innerWidth - 170, touch.clientX - dragStart.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 250, touch.clientY - dragStart.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const handleGlobalEnd = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [position]);

  // Vote verification feedback reporter
  const submitFeedback = (status: 'WIN' | 'LOSS') => {
    if (hasVoted) return;

    // Harvest exact actual size observed in the real market to feed the self-learning prediction algorithm
    const actualOutcome = status === 'WIN' 
      ? liveSignalRef.current.size 
      : (liveSignalRef.current.size === 'BIG' ? 'SMALL' : 'BIG');

    setTrueMarketHistory((prev) => [actualOutcome, ...prev].slice(0, 15));

    if (status === 'WIN') {
      setWinCount((prev) => prev + 1);
    } else {
      setLossCount((prev) => prev + 1);
      if ('speechSynthesis' in window && !isVoiceMutedRef.current) {
        window.speechSynthesis.cancel();
        const notification = new SpeechSynthesisUtterance(`বুঝতে পেরেছি, মার্কেটে বিপরীত সিগন্যাল এসেছে। ডেটা সেভ করা হলো।`);
        notification.lang = 'bn-BD';
        window.speechSynthesis.speak(notification);
      }
    }

    setHistoryLogs((prev) => [
      { id: prev.length + 1, prediction: liveSignalRef.current.size, result: status },
      ...prev
    ]);
    setHasVoted(true);
  };

  const displaySeconds = seconds % 60;

  return (
    <div className="relative min-h-screen w-full bg-[#070a12] font-sans text-white select-none overflow-hidden">
      
      {/* 100% Full-Screen Interactive Web-View Proxy (Self-learning background layer) */}
      <iframe 
        src={`/api/webview-tunnel?url=${encodeURIComponent(targetUrl)}`} 
        className="absolute inset-0 w-full h-full border-none bg-[#070a12] z-0 pointer-events-auto"
        title="Betting Portal Frame"
      />

        {/* 🛸 চারকোনা গর্জিয়াস ভাসমান হ্যাক উইজেট */}
        {isMinimized ? (
          <div 
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onClick={() => setIsMinimized(false)}
            className={`absolute bg-gradient-to-r from-cyan-600 via-[#101726] to-[#0d1321] border-2 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.9)] px-3 py-1.5 flex items-center gap-2 z-50 cursor-grab active:cursor-grabbing hover:scale-105 transition-all select-none ${
              seconds < 5 ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.9)]' : 'border-cyan-400'
            }`}
            title="হ্যাপ প্যানেল ফেরত আনতে চাপ দিন"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${seconds < 5 ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${seconds < 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-white text-[10px] font-bold font-mono tracking-wider">
              {seconds < 5 ? 'VOTE' : 'LIVE'}: {formatCountdown(seconds)}
            </span>
            <span className={`text-[9px] font-black tracking-widest px-1 py-0.5 rounded leading-none bg-amber-400 text-slate-950`}>
              {liveSignal.size}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              className="text-[9px] font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-1 py-0.5 rounded transition-colors cursor-pointer font-sans"
            >
              OPEN
            </button>
          </div>
        ) : (
          <div 
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            className={`absolute w-[180px] bg-gradient-to-b from-[#131a2e] via-[#0f1526] to-[#0b101d] border-2 rounded-2xl p-3 flex flex-col items-center space-y-2.5 z-50 cursor-grab active:cursor-grabbing select-none transition-all duration-300 ${
              seconds < 5 
                ? 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.9)]' 
                : 'border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
            }`}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          >
            {/* Dynamic header / control zone */}
            <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-1.5 font-mono">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${seconds < 5 ? 'bg-amber-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
                <span className={`text-xs font-black font-mono ${seconds < 5 ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {seconds < 5 ? "VOTE" : "LIVE"}: {formatCountdown(seconds)}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setIsSettingsOpen(true); 
                  }} 
                  className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="কনফিগারেশন"
                >
                  <Settings size={13} />
                </button>
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setIsMinimized(true); 
                  }} 
                  className="p-1 text-slate-400 hover:text-rose-450 transition-colors cursor-pointer"
                  title="মিনিমাইজ"
                >
                  <Minimize2 size={13} />
                </button>
              </div>
            </div>

            {/* Subtitle / Status Badge */}
            <div className="text-[10px] font-bold text-center leading-tight flex flex-col gap-1 w-full">
              {seconds < 5 ? (
                <span className="text-amber-300 font-black uppercase tracking-wider animate-pulse flex items-center gap-1 justify-center">
                  ⏱️ নতুন সিগন্যাল লোড হচ্ছে...
                </span>
              ) : (
                <span className="text-cyan-300 font-medium flex items-center gap-1 justify-center animate-pulse">
                  ⏳ সিগন্যাল লাইভ রয়েছে...
                </span>
              )}
            </div>

            {/* Period Number Marker */}
            <div className="text-[9px] font-mono text-slate-400 text-center bg-slate-950/40 py-0.5 px-1.5 rounded border border-slate-900/30 w-full select-text">
              পিরিয়ড: <span className="text-cyan-400 font-bold font-mono text-[10px]">{periodNumber}</span>
            </div>

            {/* Dynamic Signal Central Panel */}
            <div className={`w-full py-2.5 rounded-xl text-center shadow-inner flex flex-col items-center justify-center transition-all duration-300 ${
              seconds < 5 
                ? 'bg-[#1e1b10]/90 border border-amber-500/40 shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]' 
                : 'bg-[#070a12] border border-slate-900/60'
            }`}>
              <span className="text-[8px] text-slate-450 uppercase font-mono tracking-wider">এআই সিগন্যাল প্রেডিকশন</span>
              <span className={`text-2xl font-black font-mono tracking-normal mt-0.5 ${
                liveSignal.color === 'Red' ? 'text-rose-500' : liveSignal.color === 'Green' ? 'text-emerald-450' : 'text-purple-400'
              }`}>
                {liveSignal.number}
              </span>
              <span className={`text-[9.5px]/none font-black tracking-widest uppercase mt-1 px-3 py-1 rounded-md ${
                liveSignal.size === 'BIG' ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-gradient-to-r from-cyan-500 to-blue-650 text-white shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              }`}>
                {liveSignal.size}
              </span>
            </div>

            {/* Transition Loader */}
            <div className="w-full">
              {seconds < 5 && (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                    <div 
                      className="bg-cyan-400 h-full transition-all duration-500 animate-pulse" 
                      style={{ width: `${(seconds / 4) * 100}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-cyan-300 text-center font-bold animate-pulse uppercase tracking-wider leading-none">
                    নতুন পিরিয়ড সিগন্যাল লোডড্
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* ⚙️ সেটিংস ও এনালাইটিক্স এক্সপ্যান্ডেড প্যানেল */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in select-text">
          <div className="bg-[#0e1424] border-2 border-cyan-500/40 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl relative">
            
            {/* Header portion */}
            <div className="bg-[#141d34] p-3 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={14} className="animate-pulse" /> HACK SYSTEM PANEL
              </span>
              <div className="flex items-center gap-1.5">
                {/* Header level Minimize Trigger */}
                <button 
                  type="button"
                  onClick={() => {
                    setIsMinimized(true);
                    setIsSettingsOpen(false);
                  }} 
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                  title="উইজেট মিনিমাইজ করুন"
                >
                  <Minimize2 size={13} />
                </button>
                <button 
                  type="button"
                  onClick={() => setIsSettingsOpen(false)} 
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                  title="সেটিংস বন্ধ করুন"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Dashboard details */}
            <div className="p-3 space-y-3.5">
              {/* Voice triggers */}
              <div className="flex items-center justify-between bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-xs text-slate-300 font-sans">ভয়েস সিগন্যাল ও এলার্ট</span>
                <button 
                  type="button"
                  onClick={() => setIsVoiceMuted(!isVoiceMuted)} 
                  className={`px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                    isVoiceMuted 
                      ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' 
                      : 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/50'
                  }`}
                >
                  {isVoiceMuted ? <VolumeX size={11} /> : <Volume2 size={11} />} {isVoiceMuted ? "OFF" : "ON"}
                </button>
              </div>

              {/* URL Customization configuration */}
              <div className="flex flex-col gap-1.5 bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">প্ল্যাটফর্ম লিংক পরিবর্তন</span>
                  <span className="text-[10px] text-cyan-400 font-bold font-mono">Live Link</span>
                </div>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setTargetUrl(e.target.value);
                  }}
                  className="w-full bg-[#0e1424] text-slate-200 border border-slate-700 rounded p-1.5 text-[11px] focus:outline-none focus:border-cyan-500 font-mono select-text"
                  placeholder="ওয়েব অ্যাড্রেস এখানে দিন..."
                />
              </div>

              {/* Widget Minimization Option */}
              <div className="flex items-center justify-between bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60 font-sans">
                <span className="text-xs text-slate-300 flex items-center gap-1.5">
                  <Minimize2 size={13} className="text-rose-400" /> উইজেট মিনিমাইজ (X)
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    setIsMinimized(true);
                    setIsSettingsOpen(false);
                  }} 
                  className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-black cursor-pointer transition-all flex items-center gap-1"
                >
                  <X size={11} /> আকৃতি ছোট করুন
                </button>
              </div>

              {/* Wingo Game Mode Selector */}
              <div className="flex flex-col gap-1.5 bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">উইনগো গেম মোড</span>
                  <span className="text-[10px] text-cyan-400 font-bold font-mono">কালার ট্রেডিং</span>
                </div>
                <div className="grid grid-cols-5 gap-1 mt-1">
                  {(['30s', '1 Min', '3 Min', '5 Min', '10 Min'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWingoMode(mode)}
                      className={`py-1 text-[9px] font-black rounded transition-all cursor-pointer ${
                        wingoMode === mode 
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.6)]' 
                          : 'bg-[#0e1424] text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Sync Timing Calibration */}
              <div className="flex flex-col gap-1.5 bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">টাইমিং এডজাস্টমেন্ট (Sync)</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">
                    {timeOffset === 0 ? "পারফেক্ট সিঙ্ক" : `${timeOffset > 0 ? "+" : ""}${timeOffset}s এডজাস্ট`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button 
                    type="button"
                    onClick={() => {
                      setTimeOffset((prev) => prev - 1);
                    }} 
                    className="py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    -১ সেকেন্ড
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setTimeOffset((prev) => prev + 1);
                    }} 
                    className="py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    +১ সেকেন্ড
                  </button>
                </div>
              </div>

              {/* Google Drive Sync Integration Area */}
              <div className="flex flex-col gap-2 bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60 font-sans">
                <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase">
                  <span className="flex items-center gap-1.5">
                    <Cloud size={12} className={user ? "text-cyan-400 animate-pulse" : "text-slate-500"} />
                    গুগল ড্রাইভ ক্লাউড সিঙ্ক
                  </span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${user ? 'bg-cyan-500/10 text-cyan-400 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                    {user ? "সংযুক্ত" : "অসংযুক্ত"}
                  </span>
                </div>

                {user ? (
                  <div className="space-y-2 mt-1">
                    <div className="text-[10px] text-slate-450 leading-tight">
                      <div className="flex justify-between text-slate-400">
                        <span>ব্যবহারকারী:</span>
                        <span className="text-slate-200 select-all truncate max-w-[120px]">{user.email}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 mt-1">
                        <span>অবস্থা:</span>
                        <span className="text-cyan-450 font-bold font-sans">{backupStatus}</span>
                      </div>
                      {lastBackupTime && (
                        <div className="flex justify-between text-slate-400 mt-1">
                          <span>সর্বশেষ ব্যাকআপ:</span>
                          <span className="text-emerald-400 font-bold">{lastBackupTime}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={handleBackupToCloud}
                        disabled={isSyncing}
                        className="py-1 rounded bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-550/20 text-[9px] font-bold cursor-pointer flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                        title="গুগল ড্রাইভে ব্যাকআপ সেভ করুন"
                      >
                        <CloudUpload size={11} /> ডেটা আপলোড
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleRestoreFromCloud}
                        disabled={isSyncing || !hasCloudBackup}
                        className="py-1 rounded bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-550/20 text-[9px] font-bold cursor-pointer flex items-center justify-center gap-1 transition-all disabled:opacity-30"
                        title="গুগল ড্রাইভ থেকে আগের ডেটা ফেরত আনুন"
                      >
                        <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} /> ডেটা রিস্টোর
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCloudLogout}
                      className="w-full py-1 mt-1 text-[9px] font-semibold bg-rose-955/20 hover:bg-rose-955/35 text-rose-450 border border-rose-900/30 rounded cursor-pointer transition-colors"
                    >
                      গুগল ড্রাইভ সংযোগ বিচ্ছিন্ন করুন
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 mt-1">
                    <p className="text-[10px] text-slate-400 leading-normal text-left font-sans">
                      আপনার উইনগো হ্যাক প্রজেকশন, উইন/লস স্ট্যাটিস্টিক এবং গেম সেটিংস গুগল ড্রাইভে নিরাপদে ক্লাউড ব্যাকআপ রাখুন।
                    </p>
                    <button
                      type="button"
                      onClick={handleCloudLogin}
                      className="flex items-center gap-1.5 justify-center w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-slate-950 rounded-lg text-[10px] font-bold transition-all cursor-pointer font-sans"
                    >
                      <Cloud size={12} className="animate-pulse" /> Drive এআই ব্যাকআপ চালু করুন
                    </button>
                  </div>
                )}
              </div>

              {/* Firebase Firestore Cloud Database Sync Area */}
              <div className="flex flex-col gap-2 bg-[#070a12] p-2.5 rounded-xl border border-slate-800/60 font-sans">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase">
                  <span className="flex items-center gap-1.5">
                    <Database size={12} className={user ? "text-emerald-400 animate-pulse" : "text-slate-500"} />
                    ফায়ারবেস ডাটাবেস সিঙ্ক
                  </span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${user ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'bg-slate-800 text-slate-500'}`}>
                    {user ? "সংযুক্ত" : "অসংযুক্ত"}
                  </span>
                </div>

                {user ? (
                  <div className="space-y-2 mt-1">
                    <div className="text-[10px] text-slate-450 leading-tight">
                      <div className="flex justify-between text-slate-400">
                        <span>ডাটাবেস:</span>
                        <span className="text-slate-200 select-all truncate max-w-[120px]">Firestore DB</span>
                      </div>
                      <div className="flex justify-between text-slate-400 mt-1">
                        <span>অবস্থা:</span>
                        <span className="text-emerald-450 font-bold font-sans">{firebaseBackupStatus}</span>
                      </div>
                      {lastFirebaseBackupTime && (
                        <div className="flex justify-between text-slate-400 mt-1">
                          <span>সর্বশেষ সিঙ্ক:</span>
                          <span className="text-emerald-450 font-bold">{lastFirebaseBackupTime}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={handleBackupToFirestore}
                        disabled={isFirebaseSyncing}
                        className="py-1 rounded bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-550/20 text-[9px] font-bold cursor-pointer flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                        title="ফায়ারবেস ডাটাবেসে সেভ করুন"
                      >
                        <CloudUpload size={11} /> DB আপলোড
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleRestoreFromFirestore}
                        disabled={isFirebaseSyncing || !hasFirebaseBackup}
                        className="py-1 rounded bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-550/20 text-[9px] font-bold cursor-pointer flex items-center justify-center gap-1 transition-all disabled:opacity-30"
                        title="ফায়ারবেস ডাটাবেস থেকে রিস্টোর করুন"
                      >
                        <RefreshCw size={11} className={isFirebaseSyncing ? "animate-spin" : ""} /> DB রিস্টোর
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 mt-1">
                    <p className="text-[10px] text-slate-400 leading-normal text-left font-sans">
                      আপনার লাইভ প্রজেকশন এবং স্ট্যাটস ডাটা রিয়েল-টাইমে গুগল ফায়ারবেস ক্লাউড ফায়ারস্টোর ডাটাবেসে সুরক্ষিতভাবে সেভ রাখুন।
                    </p>
                    <button
                      type="button"
                      onClick={handleCloudLogin}
                      className="flex items-center gap-1.5 justify-center w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-slate-950 rounded-lg text-[10px] font-bold transition-all cursor-pointer font-sans"
                    >
                      <Database size={12} className="animate-pulse" /> Firebase সিঙ্ক চালু করুন
                    </button>
                  </div>
                )}
              </div>

              {/* Self-Learning AI trend monitor */}
              <div className="bg-[#070a12] rounded-xl p-2.5 border border-slate-800/60 font-sans text-xs">
                <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold mb-1.5 uppercase">
                  <span className="flex items-center gap-1">
                    <Sparkles size={11} className="animate-pulse text-amber-400" /> AI সেলফ-লার্নিং সিস্টেম
                  </span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-normal">Active</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span>শনাক্তকৃত ট্রেন্ড:</span>
                    <span className="text-emerald-400 font-bold">{detectedPattern}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>সংশোধিত ডেটা সাইকেল:</span>
                    <span className="text-cyan-450 font-mono font-bold">{trueMarketHistory.length} রাউন্ডস</span>
                  </div>
                </div>
              </div>

              {/* Total correct/incorrect stats */}
              <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs select-none">
                <div className="bg-[#070a12] border border-emerald-950 p-2 rounded-xl">
                  <span className="text-[9px] text-slate-500 block">सहীহ সিগন্যাল</span>
                  <span className="text-lg font-black text-emerald-400">{winCount}</span>
                </div>
                <div className="bg-[#070a12] border border-rose-950 p-2 rounded-xl">
                  <span className="text-[9px] text-slate-500 block">ভুল সিগন্যাল</span>
                  <span className="text-lg font-black text-rose-400">{lossCount}</span>
                </div>
              </div>

              {/* Draw logging entries */}
              <div className="bg-[#070a12] rounded-xl p-2.5 border border-slate-800/60 font-mono">
                <span className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase flex items-center gap-1 font-sans">
                  <History size={10} className="text-cyan-400 animate-pulse" /> সাম্প্রতিক রাউন্ড হিস্ট্রি
                </span>
                
                <div className="space-y-1.5 max-h-32 overflow-y-auto text-[11px] font-mono pr-0.5 custom-scrollbar text-gray-300">
                  {historyLogs.length === 0 ? (
                    <div className="text-center py-6 text-slate-600 text-[11px]">
                      কোনো হিস্ট্রি ডাটা রেকর্ড হয়নি
                    </div>
                  ) : (
                    historyLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between bg-[#0e1424]/60 p-1.5 rounded border border-slate-800/40">
                        <span className="text-slate-500 font-sans">INDEX #{log.id}</span>
                        <span className="text-slate-200 font-bold font-mono text-center">{log.prediction}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          log.result === 'WIN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {log.result === 'WIN' ? 'উইন ✔' : 'লস ❌'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div className="bg-[#070a12] p-2 text-center border-t border-slate-800/80 text-[9px] text-slate-500 tracking-wider">
              DEVELOPED FOR NADIM • LIVE SYNC ACTIVE
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
