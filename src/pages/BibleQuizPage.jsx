import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { soundEffects } from '../utils/audioEffects';
import { 
  Volume2, 
  VolumeX, 
  Flame, 
  Trophy, 
  RotateCcw, 
  Sparkles,
  CheckCircle2,
  XCircle,
  Send,
  Users
} from 'lucide-react';
import { fetchQuizQuestions, fetchQuizLeaderboard, submitQuizScore } from '../services/supabaseService';

const TIMER_SECONDS = 10;
const QUESTIONS_PER_ROUND = 10;

// Fisher-Yates uniform shuffle
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function BibleQuizPage() {
  const [questionsPool, setQuestionsPool] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [gameState, setGameState] = useState('home'); // 'home', 'playing', 'gameover'
  
  // Game metrics
  const [currentQuestions, setCurrentQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // Community Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('sugam_player_name') || '');
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);

  const timerRef = useRef(null);

  // Load High Score & Questions from Supabase
  useEffect(() => {
    const savedHighScore = localStorage.getItem('sugam_quiz_high_score');
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));

    const savedBestStreak = localStorage.getItem('sugam_quiz_best_streak');
    if (savedBestStreak) setBestStreak(parseInt(savedBestStreak, 10));

    // Fetch from Supabase
    fetchQuizQuestions(150)
      .then(list => {
        if (list && list.length > 0) {
          setQuestionsPool(list);
        }
      })
      .catch(err => {
        console.warn('Supabase questions fetch warning:', err);
      })
      .finally(() => setLoadingQuestions(false));

    // Load top leaderboard
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await fetchQuizLeaderboard(5);
      setLeaderboard(data);
    } catch (err) {
      console.warn('Leaderboard fetch warning:', err);
    }
  };

  const handleTimeOut = useCallback(() => {
    if (isAnswered) return;
    setIsAnswered(true);
    setCombo(0);
    soundEffects.playWrong();

    setTimeout(() => {
      handleNextQuestion();
    }, 1500);
  }, [isAnswered]);

  // Countdown timer effect
  useEffect(() => {
    if (gameState === 'playing' && !isAnswered) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, isAnswered, handleTimeOut]);

  const startGame = () => {
    if (questionsPool.length === 0) return;

    // Shuffle questions with Fisher-Yates algorithm
    const shuffled = shuffleArray(questionsPool);
    const selected = shuffled.slice(0, QUESTIONS_PER_ROUND);

    setCurrentQuestions(selected);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setCombo(0);
    setTimeLeft(TIMER_SECONDS);
    setSelectedOption(null);
    setIsAnswered(false);
    setScoreSubmitted(false);
    setGameState('playing');
  };

  const handleAnswer = (optionIndex) => {
    if (isAnswered) return;
    clearInterval(timerRef.current);

    setIsAnswered(true);
    setSelectedOption(optionIndex);

    const currentQ = currentQuestions[currentIndex];
    const isCorrect = optionIndex === currentQ.answer;

    if (isCorrect) {
      soundEffects.playCorrect();
      const points = 100 + (combo * 25) + (timeLeft * 5);
      const newScore = score + points;
      const newStreak = streak + 1;
      const newCombo = combo + 1;

      setScore(newScore);
      setStreak(newStreak);
      setCombo(newCombo);

      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
        localStorage.setItem('sugam_quiz_best_streak', newStreak.toString());
      }
      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('sugam_quiz_high_score', newScore.toString());
      }

      // Confetti on streaks
      if (newStreak % 3 === 0) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } else {
      soundEffects.playWrong();
      setCombo(0);
    }

    setTimeout(() => {
      handleNextQuestion();
    }, 1400);
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < currentQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTimeLeft(TIMER_SECONDS);
    } else {
      // Game Over
      setGameState('gameover');
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 }
      });
      loadLeaderboard();
    }
  };

  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    if (!playerName.trim() || scoreSubmitted) return;
    setSubmittingScore(true);
    try {
      localStorage.setItem('sugam_player_name', playerName.trim());
      await submitQuizScore(playerName.trim(), score, streak);
      setScoreSubmitted(true);
      await loadLeaderboard();
    } catch (err) {
      console.error('Failed to submit score:', err);
    } finally {
      setSubmittingScore(false);
    }
  };

  const toggleSound = () => {
    const newState = soundEffects.toggleSound();
    setSoundEnabled(newState);
  };

  const currentQ = currentQuestions[currentIndex];

  return (
    <div className="min-h-screen bg-[#060814] text-white flex flex-col items-center justify-center p-4 pt-28 sm:pt-32 pb-16 select-none relative overflow-hidden">
      
      {/* Background Neon Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />

      <section className="w-full max-w-lg church-glass-dark rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative z-10 animate-fade-in">
        
        {/* Top Sound & Mode Control */}
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs font-black uppercase tracking-[.2em] text-indigo-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Bible Trivia • Supabase Live
          </span>
          <button 
            onClick={toggleSound}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </div>

        {/* 1. HOME SCREEN */}
        {gameState === 'home' && (
          <div className="flex flex-col items-center text-center py-4 animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-4xl shadow-2xl animate-float mb-5 border border-white/20">
              📖
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-white mb-1">
              Bible Trivia
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-6">
              Streak &amp; Speed Challenge
            </p>

            <button
              onClick={startGame}
              disabled={loadingQuestions}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-black text-lg sm:text-xl shadow-lg shadow-indigo-600/40 hover:scale-[1.02] active:scale-95 transition disabled:opacity-40"
            >
              {loadingQuestions ? 'Connecting to Database...' : 'PLAY NOW ⚡'}
            </button>

            {/* Personal Metrics */}
            <div className="grid grid-cols-2 gap-3 mt-6 w-full">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-black flex items-center justify-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Personal Best</span>
                </div>
                <div className="text-xl font-black mt-1 text-amber-300">{highScore} pts</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-black flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Max Streak</span>
                </div>
                <div className="text-xl font-black mt-1 text-orange-400">{bestStreak} 🔥</div>
              </div>
            </div>

            {/* Live Community Top Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="mt-6 w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Church Leaderboard</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Live DB</span>
                </div>
                <div className="space-y-1.5">
                  {leaderboard.map((item, idx) => (
                    <div key={item.id || idx} className="flex justify-between items-center text-xs py-1">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-bold text-amber-400 w-4">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">{item.player_name}</span>
                      </div>
                      <span className="font-bold text-indigo-300 shrink-0">{item.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 mt-5">
              10 questions • 10 seconds each • build your longest streak
            </p>
          </div>
        )}

        {/* 2. PLAYING SCREEN */}
        {gameState === 'playing' && currentQ && (
          <div className="flex flex-col animate-fade-in">
            {/* Header Status */}
            <div className="px-2 py-3 border-b border-white/10 flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-black text-slate-400">Score</span>
                <p className="text-2xl font-black text-white">{score}</p>
              </div>

              <div className="text-center">
                <span className="text-[10px] uppercase font-black text-slate-400">Combo</span>
                <p className="text-lg font-black text-orange-400">
                  {combo > 0 ? `🔥 x${combo}` : '—'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-black text-slate-400">Question</span>
                <p className="text-sm font-bold text-indigo-300">
                  {currentIndex + 1} / {currentQuestions.length}
                </p>
              </div>
            </div>

            {/* Timer Progress Bar */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-6">
              <div 
                className={`h-full transition-all duration-1000 ${
                  timeLeft <= 3 ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                }`}
                style={{ width: `${(timeLeft / TIMER_SECONDS) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <div className="min-h-[85px] flex items-center justify-center text-center mb-6">
              <h2 className="text-lg sm:text-xl font-bold leading-snug text-slate-100">
                {currentQ.question}
              </h2>
            </div>

            {/* Options Grid */}
            <div className="flex flex-col gap-3">
              {currentQ.options.map((opt, idx) => {
                let btnStyle = "bg-white/5 border-white/10 hover:border-indigo-400/50 hover:bg-white/10 text-slate-200";
                
                if (isAnswered) {
                  if (idx === currentQ.answer) {
                    btnStyle = "bg-emerald-600/90 border-emerald-400 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]";
                  } else if (idx === selectedOption) {
                    btnStyle = "bg-rose-600/90 border-rose-400 text-white";
                  } else {
                    btnStyle = "bg-white/5 border-white/5 opacity-40";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleAnswer(idx)}
                    className={`w-full p-4 rounded-2xl border text-left font-semibold text-sm transition-all duration-200 flex items-center justify-between ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswered && idx === currentQ.answer && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
                    {isAnswered && idx === selectedOption && idx !== currentQ.answer && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Bible Verse Reference Note if answered */}
            {isAnswered && currentQ.reference && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-center text-xs text-indigo-300 animate-fade-in">
                📖 Reference: <span className="font-bold text-white">{currentQ.reference}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. GAME OVER SCREEN */}
        {gameState === 'gameover' && (
          <div className="flex flex-col items-center text-center py-4 animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center text-4xl shadow-xl mb-3">
              🏆
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
              Round Complete!
            </h2>
            <p className="text-xs text-indigo-300 uppercase font-bold tracking-widest mb-5">
              Faith &amp; Knowledge Challenge
            </p>

            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 space-y-2.5 text-left">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Final Score:</span>
                <span className="text-2xl font-black text-amber-300">{score}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Max Streak:</span>
                <span className="text-lg font-bold text-orange-400">{streak} 🔥</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-white/10 pt-2.5">
                <span className="text-slate-400">Personal Best:</span>
                <span className="text-lg font-bold text-emerald-400">{highScore}</span>
              </div>
            </div>

            {/* Leaderboard Submission Form */}
            {!scoreSubmitted ? (
              <form onSubmit={handleScoreSubmit} className="w-full mb-5 bg-indigo-950/40 border border-indigo-500/30 p-4 rounded-2xl">
                <label htmlFor="player-name-input" className="block text-xs font-bold text-indigo-200 mb-2 text-left">
                  Submit Score to Church Leaderboard:
                </label>
                <div className="flex gap-2">
                  <input
                    id="player-name-input"
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    aria-label="Enter your name"
                    required
                    maxLength={30}
                    className="flex-1 px-3.5 py-2.5 bg-white/10 border border-white/15 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={submittingScore || !playerName.trim()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingScore ? 'Saving...' : 'Submit'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="w-full mb-5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Score submitted to Supabase Leaderboard!</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={startGame}
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
              <button
                onClick={() => setGameState('home')}
                className="py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-sm text-slate-300 transition"
              >
                Home
              </button>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
