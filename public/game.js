const ENERGIA_POR_TRIANGULO = 21.0;
const MAP_SIZE = 4000;
const FLAG_POS = { x: 2000, y: 300 };
const BASE_BLUE = { x: 400, y: 3600 };
const BASE_RED = { x: 3600, y: 3600 };

let socket = null;
let canvas, ctx;
let gameState = 'MENU';
let localPlayerId = 'p_local_' + Math.floor(Math.random() * 1000);
let localNickname = 'Viajero';

let players = {};
let triangles = [];
let footprints = [];
let flagCarrierId = null;
let flagPos = { ...FLAG_POS };
let scores = { blue: 0, red: 0 };
let camera = { x: 0, y: 0 };
let keys = {};
let joystick = { active: false, x: 0, y: 0 };

let sessionDataTracker = {
    trianglesEaten: 0,
    tempResponses: {}
};

window.onload = () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupControls();
    requestAnimationFrame(gameLoop);
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function setupControls() {
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
}

function startSingleplayerMode() {
    localNickname = document.getElementById('player-nickname').value.trim() || 'Viajero';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('hud-layer').classList.remove('hidden');

    resetMatchState();
    gameState = 'PLAYING';
}

function resetMatchState() {
    sessionDataTracker = { trianglesEaten: 0, tempResponses: {} };
    players = {};
    players[localPlayerId] = {
        id: localPlayerId,
        nickname: localNickname,
        team: 'blue',
        x: BASE_BLUE.x,
        y: BASE_BLUE.y,
        energy: ENERGIA_POR_TRIANGULO,
        isFrozen: false,
        facingLeft: false
    };

    triangles = [];
    for (let i = 0; i < 40; i++) {
        triangles.push({
            id: i,
            x: 500 + Math.random() * 3000,
            y: 500 + Math.random() * 3000,
            active: true
        });
    }
}

function createRoom(mode) {
    alert("Para salas en red multijugador, asegúrate de que el servidor Node.js esté corriendo (npm start).");
    startSingleplayerMode();
}

function joinRoomByInput() {
    alert("Función disponible al iniciar el servidor Node.js.");
}

function triggerTriangleTask() {
    sessionDataTracker.trianglesEaten++;
    const modal = document.getElementById('task-modal');
    const label = document.getElementById('task-question-label');

    if (sessionDataTracker.trianglesEaten === 1) {
        label.innerText = "Ingresa tu NOMBRE COMPLETO:";
    } else if (sessionDataTracker.trianglesEaten === 2) {
        label.innerText = "Ingresa el NOMBRE DE TUS PADRES:";
    } else if (sessionDataTracker.trianglesEaten === 3) {
        label.innerText = "Ingresa tu EDAD:";
    }

    modal.classList.remove('hidden');
}

function submitTaskAnswer() {
    document.getElementById('task-modal').classList.add('hidden');
    players[localPlayerId].energy = ENERGIA_POR_TRIANGULO;

    if (sessionDataTracker.trianglesEaten >= 3) {
        setTimeout(() => {
            sessionDataTracker.tempResponses = {};
            gameState = 'LESSON';
            document.getElementById('hud-layer').classList.add('hidden');
            document.getElementById('lesson-modal').classList.remove('hidden');
        }, 300);
    }
}

function restartMatch() {
    document.getElementById('lesson-modal').classList.add('hidden');
    document.getElementById('hud-layer').classList.remove('hidden');
    resetMatchState();
    gameState = 'PLAYING';
}

function returnToMainMenu() {
    document.getElementById('lesson-modal').classList.add('hidden');
    document.getElementById('hud-layer').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    gameState = 'MENU';
}

let lastTime = performance.now();
function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (gameState === 'PLAYING') {
        updateGame(dt);
    }

    renderGame();
    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    const p = players[localPlayerId];
    if (!p) return;

    if (!p.isFrozen) {
        p.energy -= dt;
        if (p.energy <= 0) {
            p.energy = 0;
            p.isFrozen = true;
        }

        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const speed = 250;
            p.x += dx * speed * dt;
            p.y += dy * speed * dt;
            p.facingLeft = dx < 0;
        }
    }

    const timerEl = document.getElementById('energy-timer');
    const barFill = document.getElementById('energy-bar-fill');
    if (timerEl) {
        timerEl.innerText = `${p.energy.toFixed(1)}s`;
        barFill.style.width = `${(p.energy / ENERGIA_POR_TRIANGULO) * 100}%`;
    }

    triangles.forEach(t => {
        if (t.active && Math.hypot(p.x - t.x, p.y - t.y) < 40 && !p.isFrozen) {
            t.active = false;
            triggerTriangleTask();
        }
    });

    camera.x += (p.x - canvas.width / 2 - camera.x) * 0.1;
    camera.y += (p.y - canvas.height / 2 - camera.y) * 0.1;
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    triangles.forEach(t => {
        if (t.active) {
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.moveTo(t.x, t.y - 15);
            ctx.lineTo(t.x + 12, t.y + 10);
            ctx.lineTo(t.x - 12, t.y + 10);
            ctx.closePath();
            ctx.fill();
        }
    });

    Object.values(players).forEach(p => {
        ctx.fillStyle = p.team === 'blue' ? '#2563eb' : '#dc2626';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.nickname, p.x, p.y - 25);
    });

    ctx.restore();
}
