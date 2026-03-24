╔══════════════════════════════════════════════════════════╗
║          CODE ARENA — 1v1 Fighting Code Game            ║
╚══════════════════════════════════════════════════════════╝

PREREQUISITES
─────────────
• Node.js (v16 or newer)  →  https://nodejs.org
• Python (available as `python` command on your PATH)
• An OpenRouter API key   →  https://openrouter.ai

──────────────────────────────────────────────────────────
STEP 1 — Add your API key
──────────────────────────────────────────────────────────
Open  backend/.env  and replace the placeholder:

    OPENROUTER_API_KEY=your_openrouter_api_key_here

with your real OpenRouter key.

──────────────────────────────────────────────────────────
STEP 2 — Start the Backend
──────────────────────────────────────────────────────────
Open a terminal and run:

    cd backend
    npm install
    node server.js

You should see:
    ✅ Code Arena Backend running at http://localhost:4000

──────────────────────────────────────────────────────────
STEP 3 — Start the Frontend
──────────────────────────────────────────────────────────
Open a SECOND terminal and run:

    cd frontend
    npm install
    npm start

Then open your browser at:  http://localhost:5173

──────────────────────────────────────────────────────────
HOW TO PLAY (1v1 MULTIPLAYER)
──────────────────────────────────────────────────────────
1. Both players open http://localhost:5173 in their browsers
   (can be on the same or different machines on the same network;
    for different machines replace localhost with the host machine's IP).

2. Player 1 enters a Username and a Room ID (e.g. "QF1"), clicks ENTER ARENA.
   They will see "Waiting for opponent..." and their character assignment.

3. Player 2 enters a Username and THE SAME Room ID, clicks ENTER ARENA.
   Both players are now launched into the battle arena.

4. Room rules:
   • First player to join a room → Samurai Mack ⚔️ (left side)
   • Second player to join a room → Kenji 🥷 (right side)
   • If a 3rd player tries to join the same room → "Room is full!"

5. In the arena:
   • Select a difficulty tab (Easy / Medium / Hard / Extreme).
   • Read the coding problem.
   • Click "Compile" to open the code editor.
   • Write your solution and click "Run" to preview output.
   • Click "Submit" to AI-validate your solution.
     → PASS: YOUR character attacks the OPPONENT's character in both screens!
     → ERROR: Fix your code and try again.

6. The game ends when a character's health reaches zero.
   Solve problems faster than your opponent to win!

──────────────────────────────────────────────────────────
PROJECT STRUCTURE
──────────────────────────────────────────────────────────
project/
├── frontend/          React app (Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html         ← Lobby (username + room entry)
│   ├── arena.html         ← Battle arena (React app)
│   ├── public/
│   │   └── fighting-game/ Game canvas assets
│   └── src/
│       ├── App.jsx         (multiplayer-enabled)
│       ├── index.jsx
│       └── styles.css
├── backend/           Node.js / Express + Socket.io
│   ├── package.json
│   ├── server.js
│   └── .env           ← PUT YOUR API KEY HERE
└── questions.json     All coding problems

──────────────────────────────────────────────────────────
NOTES
──────────────────────────────────────────────────────────
• Each player sees their OWN game canvas. When you solve a
  problem, your character attacks on BOTH screens simultaneously.
• questions.json is never modified at runtime. Refreshing
  restores all questions.
• Python code is executed with: python code.py
  Make sure `python` is on your system PATH.
