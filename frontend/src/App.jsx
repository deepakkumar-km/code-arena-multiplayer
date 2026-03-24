import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const templates = {
  python: 'class Solution:\n    def twoSum(self, nums, target):\n        # Write your code here\n        pass',
  java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}',
  c: 'int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    // Write your code here\n    *returnSize = 2;\n    int* res = (int*)malloc(2 * sizeof(int));\n    return res;\n}'
};

const DIFFICULTY_MAP = {
  'Easy': 'easy', 'Medium': 'medium', 'Hard': 'hard', 'Extreme': 'extreme', 'Complex': 'extreme'
};

export default function App() {
  const [currentDifficulty, setCurrentDifficulty] = useState('easy');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editorVisible, setEditorVisible] = useState(false);
  const [lang, setLang] = useState('python');
  const [codeValue, setCodeValue] = useState(templates['python']);
  const [resultHTML, setResultHTML] = useState('<p class="result-placeholder">Run your code to see test results here.</p>');
  const [runBtnDisabled, setRunBtnDisabled] = useState(false);
  const [submitBtnDisabled, setSubmitBtnDisabled] = useState(false);
  const [runBtnLabel, setRunBtnLabel] = useState('run');
  const [submitBtnLabel, setSubmitBtnLabel] = useState('submit');
  const [problems, setProblems] = useState({ easy: [], medium: [], hard: [], extreme: [] });
  const [loading, setLoading] = useState(true);
  const [opponentName, setOpponentName] = useState('');
  const [myCharacter, setMyCharacter] = useState('samuraiMack');
  // gameOver: null | { message, youWin }
  const [gameOver, setGameOver] = useState(null);

  const socketRef = useRef(null);
  const gameOverRef = useRef(false); // prevent double-firing

  const username = sessionStorage.getItem('ca_username') || 'Player';
  const roomId = sessionStorage.getItem('ca_roomId') || '';
  const character = sessionStorage.getItem('ca_character') || 'samuraiMack';
  const playersRaw = sessionStorage.getItem('ca_players');
  const players = playersRaw ? JSON.parse(playersRaw) : [];

  // ── Reload / tab-close warning ────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameOverRef.current) return; // game already ended, allow leaving
      e.preventDefault();
      e.returnValue = ''; // triggers browser's native "Leave site?" dialog
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Listen for GAME_OVER postMessage from the iframe ─────
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'GAME_OVER') {
        handleLocalGameOver(event.data);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function handleLocalGameOver({ winner, playerHealth, enemyHealth }) {
    if (gameOverRef.current) return;
    gameOverRef.current = true;

    const youWin = winner === 'player';
    const message = youWin ? 'You Win! 🏆' : (winner === 'tie' ? 'It\'s a Tie!' : 'You Lose 💀');
    setGameOver({ message, youWin });

    // Tell the server, which relays to the opponent
    if (socketRef.current) {
      socketRef.current.emit('game_over', {
        roomId,
        winner: youWin ? username : 'opponent',
        playerHealth,
        enemyHealth
      });
    }
  }

  function freezeGame(reason) {
    const gameFrame = document.getElementById('gameFrame');
    if (gameFrame && gameFrame.contentWindow) {
      gameFrame.contentWindow.postMessage({ type: 'END_GAME', reason }, '*');
    }
  }

  // ── Socket setup ─────────────────────────────────────────
  useEffect(() => {
    const opponent = players.find(p => p.username !== username);
    if (opponent) setOpponentName(opponent.username);
    setMyCharacter(character);

    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', { username, roomId });
    });

    socket.on('opponent_attack', ({ damage }) => {
      const gameFrame = document.getElementById('gameFrame');
      if (gameFrame && gameFrame.contentWindow) {
        gameFrame.contentWindow.postMessage({ type: 'ENEMY_ATTACK', damage }, '*');
      }
    });

    // Opponent's game ended (their HP hit 0) → I won
    socket.on('opponent_game_over', ({ winnerUsername }) => {
      if (gameOverRef.current) return;
      gameOverRef.current = true;

      const youWin = winnerUsername === username;
      const message = youWin ? 'You Win! 🏆' : 'You Lose 💀';
      setGameOver({ message, youWin });
      freezeGame(message);
    });

    // Opponent disconnected (reloaded / closed tab)
    socket.on('opponent_left', ({ message }) => {
      if (gameOverRef.current) return;
      gameOverRef.current = true;

      const msg = '🏆 Opponent left — You Win!';
      setGameOver({ message: msg, youWin: true });
      freezeGame(msg);
    });

    return () => { socket.disconnect(); };
  }, []);

  // ── Load questions ────────────────────────────────────────
  useEffect(() => {
    fetch('/questions.json')
      .then(res => res.json())
      .then(data => {
        const grouped = { easy: [], medium: [], hard: [], extreme: [] };
        data.filter(q => q.status === true).forEach(q => {
          const tabKey = DIFFICULTY_MAP[q.difficulty];
          if (tabKey) grouped[tabKey].push(q);
        });
        setProblems(grouped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const problem = problems[currentDifficulty]?.[currentIndex];

  function handleTabClick(d) { setCurrentDifficulty(d); setCurrentIndex(0); }
  function handlePrevious() { if (currentIndex > 0) setCurrentIndex(i => i - 1); }
  function handleNext() { const list = problems[currentDifficulty]; if (currentIndex < list.length - 1) setCurrentIndex(i => i + 1); }
  function handleCompile() { setEditorVisible(true); setCodeValue(templates[lang]); }
  function handleLangChange(e) { const l = e.target.value; setLang(l); setCodeValue(templates[l] || ''); }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function handleRunCode() {
    if (gameOver) return;
    setRunBtnLabel('running'); setRunBtnDisabled(true);
    setResultHTML('<p class="result-placeholder">⏳ Compiling and running your code...</p>');
    try {
      const response = await fetch('/api/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeValue, language: lang }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if (data.error) {
        setResultHTML(`<div class="result-fail"><p><strong>❌ Error:</strong></p><pre style="white-space:pre-wrap;margin-top:8px;font-size:13px;color:#ff6b6b;">${escapeHtml(data.error)}</pre></div>`);
      } else {
        setResultHTML(`<div class="result-pass"><p><strong>✅ Output:</strong></p><pre style="white-space:pre-wrap;margin-top:8px;font-size:13px;color:#a8ff78;">${escapeHtml(data.output)}</pre></div>`);
      }
    } catch (err) {
      setResultHTML(`<div class="result-fail"><p><strong>❌ Connection Error:</strong></p><pre style="white-space:pre-wrap;margin-top:8px;font-size:13px;color:#ff6b6b;">Could not reach the compiler server.\nMake sure the backend is running on port 4000.\n\n${escapeHtml(err.message)}</pre></div>`);
    } finally { setRunBtnLabel('run'); setRunBtnDisabled(false); }
  }

  async function handleSubmitCode() {
    if (!problem || gameOver) return;
    setSubmitBtnLabel('submitting'); setSubmitBtnDisabled(true);
    setResultHTML('<p class="result-placeholder">⏳ Validating your solution with AI...</p>');
    try {
      const response = await fetch('/api/check-solution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: problem.title, description: problem.description, expectedOutput: problem.expectedOutput, code: codeValue, damage: problem.damage }),
      });
      const data = await response.json();
      if (data.result === 'PASS') {
        setResultHTML('<p class="result-pass">✅ PASS — All test cases passed! Attacking opponent...</p>');

        const gameFrame = document.getElementById('gameFrame');
        if (gameFrame && gameFrame.contentWindow) {
          gameFrame.contentWindow.postMessage({ type: 'PLAYER_ATTACK', damage: problem.damage }, '*');
        }
        if (socketRef.current) {
          socketRef.current.emit('player_attack', { damage: problem.damage });
        }

        setTimeout(() => {
          setProblems(prev => {
            const updated = { ...prev };
            const list = [...(updated[currentDifficulty] || [])];
            list.splice(currentIndex, 1);
            updated[currentDifficulty] = list;
            return updated;
          });
          setCurrentIndex(i => Math.max(0, i - 1));
          setEditorVisible(false);
        }, 1500);
      } else {
        const errorMsg = data.result || 'ERROR: Unknown error.';
        setResultHTML('<div class="result-fail"><p><strong>❌ Wrong Answer</strong></p><pre style="white-space:pre-wrap;margin-top:8px;font-size:13px;color:#ff6b6b;">' + escapeHtml(errorMsg.replace(/^ERROR:\s*/, '')) + '</pre></div>');
      }
    } catch (err) {
      setResultHTML('<div class="result-fail"><p><strong>❌ Connection Error</strong></p><pre style="white-space:pre-wrap;margin-top:8px;font-size:13px;color:#ff6b6b;">Could not reach the backend.\nMake sure the server is running on port 4000.\n\n' + escapeHtml(err.message) + '</pre></div>');
    } finally { setSubmitBtnLabel('submit'); setSubmitBtnDisabled(false); }
  }

  function handleResultTabClick() {
    const div = document.getElementById('resultContent');
    if (div && !div.querySelector('.result-pass, .result-fail')) {
      setResultHTML('<p class="result-placeholder">Run your code to see test results here.</p>');
    }
  }

  const myCharDisplay = myCharacter === 'samuraiMack' ? 'Samurai Mack' : 'Kenji';
  const opponentDisplay = myCharacter === 'samuraiMack' ? 'Kenji' : 'Samurai Mack';

  return (
    <div className="app-container">

      {/* ── Game Over Overlay ── */}
      {gameOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '20px'
        }}>
          <div style={{
            fontSize: '36px', fontWeight: 'bold',
            color: gameOver.youWin ? '#00ff88' : '#ff4444',
            textShadow: gameOver.youWin ? '0 0 30px #00ff88' : '0 0 30px #ff4444',
            textAlign: 'center'
          }}>
            {gameOver.message}
          </div>
          <div style={{ color: '#888', fontSize: '14px' }}>The game has ended.</div>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              marginTop: '10px', padding: '12px 32px',
              background: '#00ff88', border: 'none', borderRadius: '8px',
              fontWeight: 'bold', fontSize: '14px', cursor: 'pointer'
            }}
          >
            Back to Lobby
          </button>
        </div>
      )}

      <div className="left-panel" id="leftPanel">
        <div className="tabs-bar">
          <div className="tabs-left">
            {['easy', 'medium', 'hard', 'extreme'].map((d) => (
              <button
                key={d}
                className={`tab${currentDifficulty === d ? ' active' : ''}`}
                data-difficulty={d}
                id={`tab${d.charAt(0).toUpperCase() + d.slice(1)}`}
                onClick={() => handleTabClick(d)}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <div className="tabs-right">
            <button className="nav-btn" id="btnPrevious" onClick={handlePrevious}>Previous</button>
            <button className="nav-btn" id="btnNext" onClick={handleNext}>Next</button>
          </div>
        </div>

        {/* Player vs Player banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px', background: '#0a121a', borderBottom: '1px solid #1c2b3a', fontSize: '12px' }}>
          <span style={{ color: '#818cf8' }}>⚔️ {username} <span style={{ opacity: 0.6 }}>({myCharDisplay})</span></span>
          <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '11px' }}>VS</span>
          <span style={{ color: '#f97316' }}>{opponentName || '...'} <span style={{ opacity: 0.6 }}>({opponentDisplay})</span></span>
        </div>

        <div className="problem-content" id="problemContent" style={editorVisible ? { flex: '0 0 40%' } : {}}>
          {loading ? (
            <p>Loading questions...</p>
          ) : problem ? (
            <>
              <h2 className="problem-title">{problem.title}</h2>
              <p className="problem-description">{problem.description}</p>
              <div className="example">
                <h4>Expected Output:</h4>
                <pre>{problem.expectedOutput}</pre>
              </div>
            </>
          ) : (
            <p>No problems available for this difficulty.</p>
          )}
        </div>

        {editorVisible && (
          <div className="editor-section" id="editorSection" style={{ display: 'flex' }}>
            <div className="editor-header">
              <div className="language-selector">
                <select id="langSelect" value={lang} onChange={handleLangChange}>
                  <option value="python">Python3</option>
                  <option value="java">Java</option>
                  <option value="c">C</option>
                </select>
                <span className="auto-label">Auto</span>
              </div>
              <div className="editor-actions">
                <button className="editor-btn run-btn" id="btnRunCode" onClick={handleRunCode} disabled={runBtnDisabled || !!gameOver}>
                  {runBtnLabel === 'running' ? 'Running...' : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Run</>
                  )}
                </button>
                <button className="editor-btn submit-btn" id="btnSubmitCode" onClick={handleSubmitCode} disabled={submitBtnDisabled || !!gameOver}>
                  {submitBtnLabel === 'submitting' ? 'Submitting...' : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg> Submit</>
                  )}
                </button>
              </div>
            </div>
            <div className="editor-body">
              <textarea id="codeEditor" spellCheck="false" value={codeValue} onChange={e => setCodeValue(e.target.value)} />
            </div>
            <div className="editor-footer">
              <span>Saved</span>
              <span>Ln 1, Col 1</span>
            </div>
          </div>
        )}

        {!editorVisible && (
          <div className="compile-bar" id="compileBar">
            <button className="compile-btn" id="btnCompile" onClick={handleCompile}>Compile</button>
          </div>
        )}
      </div>

      <div className="right-panel" id="rightPanel">
        <div className="game-container" id="gameContainer">
          <iframe src="/fighting-game/index.html" id="gameFrame" title="Fighting Game" frameBorder="0" />
        </div>

        <div className="result-section" id="resultSection">
          <div className="result-tabs">
            <button className="result-tab active" id="resultTabResult" onClick={handleResultTabClick}>
              <span className="result-tab-icon">⚡</span> Test Result
            </button>
          </div>
          <div className="result-content" id="resultContent" dangerouslySetInnerHTML={{ __html: resultHTML }} />
        </div>
      </div>
    </div>
  );
}
