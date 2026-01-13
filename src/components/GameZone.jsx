import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Play, RotateCcw, Gamepad2 } from 'lucide-react';

// GAME CONSTANTS
const GRID_SIZE = 20;
const SPEED = 100; // ms

export default function GameZone() {
  const { currentUser } = useAuth();
  
  // Game State
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [direction, setDirection] = useState('RIGHT');
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0); // Personal Best

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState([]);
  const gameLoopRef = useRef();

  // 1. INITIAL LOAD (Fetch Leaderboard & Personal Best)
  useEffect(() => {
    fetchLeaderboard();
    fetchPersonalBest();
  }, [currentUser]);

  const fetchLeaderboard = async () => {
    const q = query(collection(db, 'high_scores'), orderBy('score', 'desc'), limit(10));
    const snap = await getDocs(q);
    setLeaderboard(snap.docs.map(d => d.data()));
  };

  const fetchPersonalBest = async () => {
    if (!currentUser) return;
    const docRef = doc(db, 'high_scores', currentUser.id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setHighScore(docSnap.data().score);
    }
  };

  // 2. SAVE SCORE (Only if Personal Best)
  const handleGameOver = async (finalScore) => {
    setGameOver(true);
    setIsPlaying(false);
    clearInterval(gameLoopRef.current);

    if (finalScore > highScore) {
      setHighScore(finalScore);
      // Save to Firebase
      await setDoc(doc(db, 'high_scores', currentUser.id), {
        userId: currentUser.id,
        userName: currentUser.fullname,
        score: finalScore,
        date: new Date().toISOString()
      });
      // Refresh Leaderboard to show new champion
      fetchLeaderboard();
    }
  };

  // 3. GAME ENGINE
  const moveSnake = useCallback(() => {
    setSnake((prevSnake) => {
      const head = { ...prevSnake[0] };

      switch (direction) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
        default: break;
      }

      // Check Collisions (Walls or Self)
      if (
        head.x < 0 || head.x >= GRID_SIZE || 
        head.y < 0 || head.y >= GRID_SIZE ||
        prevSnake.some(segment => segment.x === head.x && segment.y === head.y)
      ) {
        handleGameOver(prevSnake.length - 1);
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      // Check Food
      if (head.x === food.x && head.y === food.y) {
        setScore(s => s + 1);
        generateFood();
      } else {
        newSnake.pop(); // Remove tail if not eating
      }

      return newSnake;
    });
  }, [direction, food]);

  useEffect(() => {
    if (isPlaying) {
      gameLoopRef.current = setInterval(moveSnake, SPEED);
    }
    return () => clearInterval(gameLoopRef.current);
  }, [isPlaying, moveSnake]);

  // 4. CONTROLS
  useEffect(() => {
    const handleKey = (e) => {
      if (!isPlaying) return;
      switch (e.key) {
        case 'ArrowUp': if (direction !== 'DOWN') setDirection('UP'); break;
        case 'ArrowDown': if (direction !== 'UP') setDirection('DOWN'); break;
        case 'ArrowLeft': if (direction !== 'RIGHT') setDirection('LEFT'); break;
        case 'ArrowRight': if (direction !== 'LEFT') setDirection('RIGHT'); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [direction, isPlaying]);

  const generateFood = () => {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    setFood({ x, y });
  };

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setScore(0);
    setDirection('RIGHT');
    setGameOver(false);
    setIsPlaying(true);
    generateFood();
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6 p-6 animate-in fade-in">
      
      {/* LEFT: GAME BOARD */}
      <div className="flex-1 bg-slate-900 rounded-3xl shadow-2xl border-4 border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Score Header */}
        <div className="absolute top-6 left-0 right-0 flex justify-center gap-10 text-white font-mono z-10">
          <div className="text-xl">SCORE: <span className="text-emerald-400 font-bold">{score}</span></div>
          <div className="text-xl opacity-50">BEST: {highScore}</div>
        </div>

        {/* The Grid */}
        <div 
          className="relative bg-black/50 border-2 border-slate-700 shadow-inner"
          style={{ width: `${GRID_SIZE * 25}px`, height: `${GRID_SIZE * 25}px` }}
        >
          {!isPlaying && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-white">
              <Gamepad2 size={64} className="mb-4 text-emerald-500" />
              <button onClick={startGame} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full font-bold text-lg transition-transform hover:scale-105 flex items-center gap-2">
                <Play fill="currentColor" /> START GAME
              </button>
              <p className="mt-4 text-sm text-slate-400">Use Arrow Keys to Move</p>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 z-20 text-white animate-in zoom-in">
              <h2 className="text-4xl font-black mb-2">GAME OVER</h2>
              <p className="text-xl mb-6">Final Score: {score}</p>
              <button onClick={startGame} className="bg-white text-red-600 px-8 py-3 rounded-full font-bold text-lg hover:bg-slate-100 flex items-center gap-2">
                <RotateCcw /> TRY AGAIN
              </button>
            </div>
          )}

          {/* Snake */}
          {snake.map((segment, i) => (
            <div
              key={i}
              className="absolute bg-emerald-400 rounded-sm shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              style={{
                left: `${segment.x * 25}px`,
                top: `${segment.y * 25}px`,
                width: '23px',
                height: '23px',
                opacity: i === 0 ? 1 : 0.6 // Head is brighter
              }}
            />
          ))}

          {/* Food */}
          <div
            className="absolute bg-rose-500 rounded-full animate-bounce shadow-[0_0_15px_rgba(244,63,94,0.8)]"
            style={{
              left: `${food.x * 25}px`,
              top: `${food.y * 25}px`,
              width: '23px',
              height: '23px',
            }}
          />
        </div>
      </div>

      {/* RIGHT: LEADERBOARD */}
      <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={24} className="text-yellow-300" />
            <h2 className="text-xl font-black tracking-wider">TOP PLAYERS</h2>
          </div>
          <p className="text-xs text-indigo-100 opacity-80">Can you beat the high score?</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {leaderboard.map((entry, index) => (
            <div key={index} className={`flex items-center p-3 mb-2 rounded-xl border ${index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                index === 0 ? 'bg-yellow-400 text-yellow-900' : 
                index === 1 ? 'bg-slate-300 text-slate-700' : 
                index === 2 ? 'bg-orange-200 text-orange-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800 text-sm">{entry.userName}</div>
                <div className="text-[10px] text-slate-400">Rank #{index + 1}</div>
              </div>
              <div className="font-mono font-bold text-indigo-600 text-lg">
                {entry.score}
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="text-center p-8 text-slate-400 italic text-sm">No scores yet. Be the first!</div>
          )}
        </div>
      </div>
    </div>
  );
}