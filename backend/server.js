require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

const TEMP_DIR = path.join(os.tmpdir(), 'code-arena');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const QUESTIONS_PATH = path.join(__dirname, '..', 'questions.json');

// ── Room state ───────────────────────────────────────────────
// rooms[roomId] = [ { socketId, username, character }, ... ]  max 2
const rooms = {};

// ── Socket.io ────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('join_room', ({ username, roomId }) => {
    if (!username || !roomId) return;
    const room = rooms[roomId] || [];

    if (room.length >= 2) {
      socket.emit('room_full');
      return;
    }

    const character = room.length === 0 ? 'samuraiMack' : 'kenji';
    const playerInfo = { socketId: socket.id, username, character };
    room.push(playerInfo);
    rooms[roomId] = room;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;
    socket.data.character = character;

    socket.emit('joined_room', { character, roomId, playerCount: room.length });

    if (room.length === 2) {
      const [p1, p2] = room;
      io.to(roomId).emit('game_start', {
        players: [
          { username: p1.username, character: p1.character },
          { username: p2.username, character: p2.character }
        ]
      });
    } else {
      socket.emit('waiting_for_opponent');
    }
  });

  socket.on('player_attack', ({ damage }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('opponent_attack', { damage });
  });

  // One player's HP hit 0 — relay to the other side
  socket.on('game_over', ({ winner }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    // Mark room ended so disconnect won't also fire opponent_left
    if (rooms[roomId]) rooms[roomId].ended = true;
    socket.to(roomId).emit('opponent_game_over', { winnerUsername: winner });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const wasEnded = rooms[roomId].ended;
    rooms[roomId] = rooms[roomId].filter(p => p.socketId !== socket.id);
    if (rooms[roomId].length === 0) {
      delete rooms[roomId];
    } else if (!wasEnded) {
      // Only fire opponent_left if game wasn't already over
      io.to(roomId).emit('opponent_left', {
        message: `${socket.data.username || 'Opponent'} has left the arena.`
      });
    }
  });
});

// ── REST ─────────────────────────────────────────────────────
app.get('/questions.json', (req, res) => {
  try {
    const data = fs.readFileSync(QUESTIONS_PATH, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not read questions.json' });
  }
});

app.use('/fighting-game', express.static(path.join(__dirname, '..', 'frontend', 'public', 'fighting-game')));

app.post('/api/compile', (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) return res.json({ output: null, error: 'Missing code or language.' });

  const id = Date.now() + '_' + Math.random().toString(36).slice(2);
  let filePath, command, cleanupFiles;

  try {
    switch (language) {
      case 'python': {
        filePath = path.join(TEMP_DIR, `${id}.py`);
        fs.writeFileSync(filePath, code);
        command = `python "${filePath}"`;
        cleanupFiles = [filePath];
        break;
      }
      case 'c': {
        const srcPath = path.join(TEMP_DIR, `${id}.c`);
        const outPath = path.join(TEMP_DIR, `${id}_out`);
        fs.writeFileSync(srcPath, code);
        command = `gcc "${srcPath}" -o "${outPath}" && "${outPath}"`;
        cleanupFiles = [srcPath, outPath];
        break;
      }
      case 'java': {
        const javaDir = path.join(TEMP_DIR, id);
        fs.mkdirSync(javaDir, { recursive: true });
        filePath = path.join(javaDir, 'Main.java');
        fs.writeFileSync(filePath, code);
        command = `javac "${filePath}" -d "${javaDir}" && java -cp "${javaDir}" Main`;
        cleanupFiles = [javaDir];
        break;
      }
      default:
        return res.json({ output: null, error: `Unsupported language: ${language}` });
    }
  } catch (err) {
    return res.json({ output: null, error: `File setup error: ${err.message}` });
  }

  exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
    try {
      cleanupFiles && cleanupFiles.forEach(f => {
        if (fs.existsSync(f)) {
          const stat = fs.statSync(f);
          if (stat.isDirectory()) fs.rmSync(f, { recursive: true, force: true });
          else fs.unlinkSync(f);
        }
      });
    } catch (_) {}
    if (error) return res.json({ output: null, error: (stderr || error.message || 'Runtime error').trim() });
    if (stderr && !stdout) return res.json({ output: null, error: stderr.trim() });
    return res.json({ output: stdout || '(no output)', error: null });
  });
});

app.post('/api/check-solution', async (req, res) => {
  const { title, description, expectedOutput, code } = req.body;
  if (!title || !code) return res.json({ result: 'ERROR: Missing required fields.' });

  let executionOutput = null;
  let executionError = null;
  const id = Date.now() + '_' + Math.random().toString(36).slice(2);
  const codeFilePath = path.join(TEMP_DIR, `code_${id}.py`);

  try {
    fs.writeFileSync(codeFilePath, code);
    await new Promise((resolve) => {
      exec(`python "${codeFilePath}"`, { timeout: 10000, cwd: TEMP_DIR }, (error, stdout, stderr) => {
        try { fs.unlinkSync(codeFilePath); } catch (_) {}
        if (error) { executionError = (stderr || error.message || 'Runtime error').trim(); }
        else { executionOutput = stdout.trim(); }
        resolve();
      });
    });
  } catch (err) { executionError = err.message; }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.json({ result: 'ERROR: OPENROUTER_API_KEY not set in .env file.' });

  let executionContext = '';
  if (executionError) executionContext = `\nCode Execution Result: ERROR\n${executionError}`;
  else if (executionOutput !== null) executionContext = `\nCode Execution Output:\n${executionOutput}`;

  const prompt = `You are a strict code reviewer for a coding battle game.

Problem Title: ${title}
Problem Description: ${description}
Expected Output: ${expectedOutput}
${executionContext}

User Code:
\`\`\`
${code}
\`\`\`

Tasks:
1. Check for syntax errors.
2. Check logical correctness against the expected output.
3. If the code is correct and would produce the expected output, respond with exactly: PASS
4. If the code is incorrect or has errors, respond with exactly: ERROR: followed by a brief explanation.

Return ONLY "PASS" or "ERROR: <explanation>" with no extra text.`;

  try {
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Code Arena',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const aiData = await aiResponse.json();
    if (aiData.error) return res.json({ result: `ERROR: ${aiData.error.message || 'AI service error'}` });
    const resultText = aiData.choices?.[0]?.message?.content?.trim();
    if (resultText && resultText.startsWith('PASS')) return res.json({ result: 'PASS' });
    return res.json({ result: resultText || 'ERROR: Could not evaluate code.' });
  } catch (err) {
    return res.json({ result: `ERROR: AI service unavailable. ${err.message}` });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n✅ Code Arena Backend running at http://localhost:${PORT}`);
  console.log(`   OpenRouter API key: ${process.env.OPENROUTER_API_KEY ? '✅ loaded' : '❌ NOT SET — add OPENROUTER_API_KEY to backend/.env'}\n`);
});
