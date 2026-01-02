const canvas = document.getElementById("worldCanvas");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const miniCtx = minimap.getContext("2d");

const farmNameValue = document.getElementById("farmNameValue");
const cowCount = document.getElementById("cowCount");
const fenceStrengthEl = document.getElementById("fenceStrength");
const fenceHeightEl = document.getElementById("fenceHeight");
const creditsEl = document.getElementById("credits");
const lockLevelEl = document.getElementById("lockLevel");
const hintTokensEl = document.getElementById("hintTokens");
const cowProfile = document.getElementById("cowProfile");
const ropeBtn = document.getElementById("ropeBtn");
const netBtn = document.getElementById("netBtn");
const puzzleBox = document.getElementById("puzzleBox");
const upgradeFenceBtn = document.getElementById("upgradeFenceBtn");
const upgradeLockBtn = document.getElementById("upgradeLockBtn");
const buyHintsBtn = document.getElementById("buyHintsBtn");
const leaderboard = document.getElementById("leaderboard");
const logFeed = document.getElementById("logFeed");
const timeOfDayEl = document.getElementById("timeOfDay");
const weatherEl = document.getElementById("weather");
const timerEl = document.getElementById("timer");
const connectionStatus = document.getElementById("connectionStatus");
const touchControls = document.getElementById("touchControls");

const startModal = document.getElementById("startModal");
const farmNameInput = document.getElementById("farmNameInput");
const startBtn = document.getElementById("startBtn");
const chatContainer = document.getElementById("chatContainer");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

const WORLD_SIZE = 2000;
const VIEW_PADDING = 80;
const PLAYER_SPEED = 2.4;

const WEATHER_TYPES = ["sun", "rain", "wind", "fog"];
const WEATHER_LABELS = {
  sun: "Sun",
  rain: "Rain",
  wind: "Wind",
  fog: "Fog",
};

const npcFarms = [
  { name: "Bramblegate", cows: 0, cowsList: [] },
  { name: "Riverbend", cows: 0, cowsList: [] },
  { name: "Copperfield", cows: 0, cowsList: [] },
  { name: "Moonridge", cows: 0, cowsList: [] },
];

const state = {
  farmName: "",
  player: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, vx: 0, vy: 0 },
  cows: [],
  captured: [],
  fenceStrength: 1,
  fenceHeight: 1,
  credits: 0,
  lockLevel: 0,
  lockStrength: 0,
  hintTokens: 0,
  weather: WEATHER_TYPES[0],
  dayTime: "day",
  cycleStart: performance.now(),
  cycleLengthMs: 180000,  // 3 minutes total
  nightLengthMs: 45000,   // 45 seconds night
  selectedCowId: null,
  puzzle: null,
  nightRaidActive: false,
  raidTimer: 0,
  cycleIndex: 0,
  raidCheckedCycle: -1,
  farms: [],
  selfFarm: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, size: 160 },
  view: { camX: 0, camY: 0, zoom: 1.4 },
  mouse: { x: 0, y: 0, hasMove: false },
  lockedFarmName: null,
  ws: null,
  online: false,
  lastServerSync: 0,
  playerId: null,
  lastMoveSend: 0,
  touchDirs: new Set(),
  audio: { ctx: null, unlocked: false },
  log: [],
  pendingRaid: null, // { raidId, attackerName, puzzle, timeLimit, start }
  raidingFarm: null, // farmId we're currently raiding
  otherPlayers: [], // { id, name, x, y }
  chatMessages: [], // { senderId, senderName, text, x, y, time }
};

const HINT_TOKEN_COST = 12;

function computeAllowedTool(cow) {
  if (cow.temperament === "skittish" || cow.temperament === "curious") return "net";
  return "rope";
}

function getLockCost() {
  return (state.lockLevel + 1) * 10;
}

function logEvent(message, toneType) {
  state.log.unshift({ message, time: new Date().toLocaleTimeString(), id: crypto.randomUUID() });
  state.log = state.log.slice(0, 8);
  renderLog();
  playLogSound(toneType || classifyTone(message));
}

function setConnectionStatus(text, online) {
  connectionStatus.textContent = text;
  connectionStatus.style.background = online ? "#cfe8b4" : "#f0d2c4";
}

function connectToServer() {
  try {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    state.ws = new WebSocket(`${protocol}://${window.location.host}`);
  } catch (error) {
    setConnectionStatus("Offline", false);
    return;
  }

  setConnectionStatus("Connecting...", false);

  state.ws.addEventListener("open", () => {
    state.online = true;
    setConnectionStatus("Online", true);
    sendToServer({ type: "join", name: state.farmName });
  });

  state.ws.addEventListener("message", (event) => {
    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch (error) {
      return;
    }
    handleServerMessage(data);
  });

  state.ws.addEventListener("close", () => {
    state.online = false;
    setConnectionStatus("Offline", false);
  });

  state.ws.addEventListener("error", () => {
    state.online = false;
    setConnectionStatus("Offline", false);
  });
}

function sendToServer(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify(payload));
}

function handleServerMessage(message) {
  if (message.type === "welcome") {
    state.playerId = message.playerId;
    state.selfFarm = message.farm;
    state.player.x = message.spawn.x;
    state.player.y = message.spawn.y;
    return;
  }
  if (message.type === "state") {
    state.cows = message.cows;
    state.farms = message.farms
      .filter((farm) => farm.id !== state.playerId)
      .map((farm) => ({ ...farm, size: 160, strength: 3 }));
    const self = message.farms.find((farm) => farm.id === state.playerId);
    if (self) {
      state.selfFarm = { ...self, size: 160 };
      state.captured = self.cowsList.map((cowId) => message.cows.find((cow) => cow.id === cowId)).filter(Boolean);
    }
    state.otherPlayers = (message.players || []).filter((p) => p.id !== state.playerId);
    state.weather = message.weather;
    state.dayTime = message.dayTime;
    state.lastServerSync = performance.now();
    updateFarmStats();
    return;
  }
  if (message.type === "chat") {
    state.chatMessages.push({
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      x: message.x,
      y: message.y,
      time: performance.now(),
    });
    // Keep only last 20 messages
    if (state.chatMessages.length > 20) {
      state.chatMessages.shift();
    }
    return;
  }
  if (message.type === "raidIncoming") {
    // Someone is raiding us - show defense puzzle
    state.pendingRaid = {
      raidId: message.raidId,
      attackerName: message.attackerName,
      puzzle: message.puzzle,
      timeLimit: message.timeLimit,
      start: performance.now(),
    };
    showDefensePuzzle(message.puzzle, message.raidId, message.timeLimit);
    return;
  }
  if (message.type === "raidStarted") {
    state.raidingFarm = message.targetName;
    return;
  }
  if (message.type === "raidResult") {
    state.raidingFarm = null;
    state.pendingRaid = null;
    state.puzzle = null;
    renderPuzzle();
    return;
  }
  if (message.type === "error") {
    logEvent(message.message, "negative");
    return;
  }
  if (message.type === "event") {
    logEvent(message.message);
  }
}

function renderLog() {
  logFeed.innerHTML = "";
  state.log.forEach((item) => {
    const div = document.createElement("div");
    div.className = "log-item";
    if (item === state.log[0]) {
      div.classList.add("flash");
    }
    div.textContent = `[${item.time}] ${item.message}`;
    logFeed.appendChild(div);
  });
}

function classifyTone(message) {
  const text = message.toLowerCase();
  if (text.includes("caught") || text.includes("defended") || text.includes("upgraded")) return "positive";
  if (text.includes("stole") || text.includes("escaped") || text.includes("failed") || text.includes("lost")) return "negative";
  return "neutral";
}

function initAudio() {
  if (state.audio.unlocked) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  state.audio.ctx = ctx;
  ctx.resume().then(() => {
    state.audio.unlocked = true;
  }).catch(() => {});
}

function playLogSound(type) {
  if (!state.audio.unlocked || !state.audio.ctx) return;
  if (type === "neutral") return;
  const ctx = state.audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  if (type === "positive") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1240, now + 0.12);
  } else {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

function initCows() {
  state.cows = COWS.map((cow) => ({
    ...cow,
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
    status: "wild",
    owner: null,
    allowedTool: computeAllowedTool(cow),
  }));
}

function initFarms() {
  state.selfFarm = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, size: 160 };
  const centerX = WORLD_SIZE / 2;
  const centerY = WORLD_SIZE / 2;
  const radius = 520;
  state.farms = npcFarms.map((farm, index) => {
    const angle = (Math.PI * 2 * index) / npcFarms.length + 0.6;
    return {
      ...farm,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      strength: 2 + index,
      size: 160,
      cowsList: farm.cowsList,
    };
  });
}

function updateLeaderboard() {
  syncNpcFarmData();
  const otherFarms = state.online
    ? state.farms.map((farm) => ({ name: farm.name, cows: farm.cowsList.length }))
    : npcFarms;
  const entries = [
    { name: state.farmName || "My Farm", cows: state.captured.length },
    ...otherFarms,
  ].sort((a, b) => b.cows - a.cows);

  leaderboard.innerHTML = "";
  entries.forEach((entry, index) => {
    const div = document.createElement("div");
    div.className = "leader-item";
    div.textContent = `${index + 1}. ${entry.name}`;
    const count = document.createElement("span");
    count.textContent = entry.cows;
    div.appendChild(count);
    leaderboard.appendChild(div);
  });
}

function syncNpcFarmData() {
  if (state.online) return;
  state.farms.forEach((farm) => {
    const npc = npcFarms.find((item) => item.name === farm.name);
    if (npc) {
      farm.cows = npc.cows;
      farm.cowsList = npc.cowsList;
    }
  });
}

function updateFarmStats() {
  farmNameValue.textContent = state.farmName;
  cowCount.textContent = state.captured.length;
  state.credits = state.captured.length * 5;
  fenceStrengthEl.textContent = state.fenceStrength + state.lockStrength;
  fenceHeightEl.textContent = state.fenceHeight;
  creditsEl.textContent = state.credits;
  lockLevelEl.textContent = state.lockLevel;
  hintTokensEl.textContent = state.hintTokens;
  upgradeLockBtn.textContent = `Buy Lock (${getLockCost()} credits)`;
  buyHintsBtn.textContent = `Buy Hint Token (${HINT_TOKEN_COST} credits)`;
  updateLeaderboard();
}

function setWeather(weather) {
  state.weather = weather;
  weatherEl.textContent = `Weather: ${WEATHER_LABELS[weather]}`;
}

function updateCycle() {
  if (state.online) {
    timeOfDayEl.textContent = state.dayTime === "night" ? "Night" : "Day";
    weatherEl.textContent = `Weather: ${WEATHER_LABELS[state.weather]}`;
    timerEl.textContent = "Server sync";
    return;
  }
  const now = performance.now();
  const elapsed = now - state.cycleStart;
  const dayLength = state.cycleLengthMs - state.nightLengthMs;
  const cyclePos = elapsed % state.cycleLengthMs;
  const cycleIndex = Math.floor(elapsed / state.cycleLengthMs);
  const isNight = cyclePos >= dayLength;

  state.dayTime = isNight ? "night" : "day";
  timeOfDayEl.textContent = isNight ? "Night" : "Day";

  const remaining = isNight
    ? state.cycleLengthMs - cyclePos
    : dayLength - cyclePos;
  timerEl.textContent = `Next shift: ${Math.ceil(remaining / 1000)}s`;

  if (cycleIndex !== state.cycleIndex) {
    state.cycleIndex = cycleIndex;
    setWeather(WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)]);
    simulateNpcCapture();
  }

  if (isNight && state.raidCheckedCycle !== cycleIndex) {
    state.raidCheckedCycle = cycleIndex;
    triggerRaidCheck();
  }
}

function simulateNpcCapture() {
  if (state.online) return;
  const wildCows = state.cows.filter((cow) => cow.status === "wild");
  if (wildCows.length === 0) return;
  if (Math.random() < 0.35) {
    const cow = wildCows[Math.floor(Math.random() * wildCows.length)];
    cow.status = "captured";
    const npc = npcFarms[Math.floor(Math.random() * npcFarms.length)];
    npc.cows += 1;
    npc.cowsList.push(cow);
    cow.owner = npc.name;
    logEvent(`${npc.name} caught ${cow.name}.`, "positive");
    updateLeaderboard();
  }
}

function triggerRaidCheck() {
  if (state.online) return;
  if (state.captured.length === 0) return;
  const raidChance = Math.max(0.1, 0.35 - state.lockLevel * 0.05);
  if (Math.random() < raidChance) {
    state.nightRaidActive = true;
    state.raidTimer = 15000;
    const puzzle = generateDefensePuzzle();
    showPuzzle(puzzle, () => {
      state.nightRaidActive = false;
      logEvent("You defended the farm. No cows lost.", "positive");
    }, () => {
      state.nightRaidActive = false;
      handleRaidLoss();
    }, 15000);
    logEvent("Raid incoming! Solve a defense puzzle.", "neutral");
  }
}

function handleRaidLoss() {
  if (state.captured.length === 0) return;
  const lockSaveChance = Math.min(0.6, state.lockStrength * 0.12);
  if (Math.random() < lockSaveChance) {
    logEvent("Locks held. The cows stayed safe.", "positive");
    return;
  }
  const stolen = state.captured.pop();
  const npc = npcFarms[Math.floor(Math.random() * npcFarms.length)];
  npc.cows += 1;
  npc.cowsList.push(stolen);
  stolen.owner = npc.name;
  logEvent(`${npc.name} stole ${stolen.name} at night.`, "negative");
  updateFarmStats();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function movePlayer() {
  state.player.x = clamp(state.player.x + state.player.vx, 0, WORLD_SIZE);
  state.player.y = clamp(state.player.y + state.player.vy, 0, WORLD_SIZE);
}

function findNearbyCow() {
  let nearest = null;
  let minDist = 70;
  state.cows.forEach((cow) => {
    if (cow.status !== "wild") return;
    const dx = cow.x - state.player.x;
    const dy = cow.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = cow;
    }
  });
  state.selectedCowId = nearest ? nearest.id : null;
  renderCowProfile(nearest);
}

function renderCowProfile(cow) {
  if (!cow) {
    cowProfile.textContent = "No cow nearby. Explore the grassland.";
    ropeBtn.disabled = true;
    netBtn.disabled = true;
    return;
  }

  const requiredTool = cow.allowedTool ? cow.allowedTool : computeAllowedTool(cow);
  cowProfile.innerHTML = `
    <div><strong>${cow.name}</strong> (${cow.id})</div>
    <div>Speed: ${cow.speed} | Temperament: ${cow.temperament}</div>
    <div>Favored Weather: ${cow.favoredWeather}</div>
    <div>Escape Skill: ${cow.escape} | Difficulty: ${cow.difficulty}</div>
    <div>Required Tool: ${requiredTool.toUpperCase()}</div>
  `;

  ropeBtn.disabled = requiredTool !== "rope";
  netBtn.disabled = requiredTool !== "net";
}

function showPuzzle(puzzle, onSuccess, onFail, timeLimitMs = null) {
  state.puzzle = { ...puzzle, onSuccess, onFail, timeLimitMs, start: performance.now() };
  renderPuzzle();
}

function renderPuzzle() {
  const puzzle = state.puzzle;
  if (!puzzle) {
    puzzleBox.textContent = "Solve math to build tools, fences, and defenses.";
    return;
  }

  puzzleBox.innerHTML = "";
  const question = document.createElement("div");
  question.textContent = puzzle.question;
  puzzleBox.appendChild(question);

  const hintReveal = document.createElement("div");
  hintReveal.className = "hint";
  hintReveal.textContent = puzzle.hint ? `Hint: ${puzzle.hint}` : "";
  hintReveal.style.display = "none";
  hintReveal.style.marginTop = "8px";
  hintReveal.style.fontSize = "12px";
  hintReveal.style.opacity = "0.7";
  puzzleBox.appendChild(hintReveal);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter answer";
  puzzleBox.appendChild(input);

  const hintBtn = document.createElement("button");
  hintBtn.className = "action";
  hintBtn.textContent = "Use Hint Token (1)";
  hintBtn.disabled = state.hintTokens === 0 || !puzzle.hint;
  puzzleBox.appendChild(hintBtn);

  const button = document.createElement("button");
  button.className = "action";
  button.textContent = "Submit Answer";
  puzzleBox.appendChild(button);

  const hint = document.createElement("div");
  hint.style.marginTop = "8px";
  hint.style.fontSize = "12px";
  hint.style.opacity = "0.6";
  if (puzzle.timeLimitMs) {
    hint.textContent = `Time limit: ${Math.ceil(puzzle.timeLimitMs / 1000)}s`;
  } else {
    hint.textContent = "Tip: use K-8 math to solve this.";
  }
  puzzleBox.appendChild(hint);

  const hintCost = document.createElement("div");
  hintCost.style.marginTop = "6px";
  hintCost.style.fontSize = "12px";
  hintCost.style.opacity = "0.6";
  hintCost.textContent = "Hint cost: 1 token";
  puzzleBox.appendChild(hintCost);

  hintBtn.addEventListener("click", () => {
    if (state.hintTokens <= 0 || !puzzle.hint) return;
    state.hintTokens -= 1;
    updateFarmStats();
    hintReveal.style.display = "block";
    hintBtn.disabled = true;
  });

  button.addEventListener("click", () => {
    const value = parseFloat(input.value.trim());
    if (Number.isNaN(value)) {
      logEvent("Answer not recognized. Try again.");
      return;
    }
    const isCorrect = Math.abs(value - puzzle.answer) < 0.01;
    if (isCorrect) {
      logEvent("Correct! Tool or upgrade built.");
      state.puzzle = null;
      puzzle.onSuccess();
    } else {
      logEvent("Incorrect answer. The build failed.");
      state.puzzle = null;
      puzzle.onFail();
    }
    renderPuzzle();
  });
}

function getGradeLevel(difficulty) {
  if (difficulty <= 3) return 5;
  if (difficulty <= 6) return 6;
  if (difficulty <= 8) return 7;
  return 8;
}

function generateCapturePuzzle(cow, toolType) {
  const grade = getGradeLevel(cow.difficulty);
  if (toolType === "rope") {
    if (grade <= 5) {
      const x = 4 + (cow.difficulty % 6);
      const a = 2 + (cow.speed % 4);
      const c = a * x;
      return {
        question: `Grade 5 (Difficulty ${cow.difficulty}): Solve ${a}x = ${c}. What is x?`,
        answer: x,
        hint: "Divide both sides by the number in front of x.",
      };
    }
    if (grade === 6) {
      const x = 3 + (cow.difficulty % 7);
      const a = 2 + (cow.escape % 4);
      const b = 4 + (cow.speed % 5);
      const c = a * x + b;
      return {
        question: `Grade 6 (Difficulty ${cow.difficulty}): Solve ${a}x + ${b} = ${c}. What is x?`,
        answer: x,
        hint: "Subtract the constant, then divide by the coefficient.",
      };
    }
    if (grade === 7) {
      const x = 4 + (cow.difficulty % 6);
      const a = 2 + (cow.speed % 5);
      const b = 3 + (cow.escape % 5);
      const c = a * x + b;
      return {
        question: `Grade 7 (Difficulty ${cow.difficulty}): Solve ${a}x + ${b} = ${c}. What is x?`,
        answer: x,
        hint: "Move the constant to the other side, then divide.",
      };
    }
    const x = 5 + (cow.difficulty % 5);
    const y = 2 + (cow.escape % 4);
    const sum = x + y;
    const diff = x - y;
    return {
      question: `Grade 8 (Difficulty ${cow.difficulty}): Solve the system: x + y = ${sum}, x - y = ${diff}. What is x?`,
      answer: x,
      hint: "Add the two equations to eliminate y.",
    };
  }

  if (grade <= 5) {
    const length = 6 + (cow.difficulty % 6);
    const width = 3 + (cow.speed % 4);
    const area = length * width;
    return {
      question: `Grade 5 (Difficulty ${cow.difficulty}): Net area is ${area}. Length is ${length}. What width is needed?`,
      answer: width,
      hint: "Area = length x width. Solve for width.",
    };
  }
  if (grade === 6) {
    const length = 7 + (cow.difficulty % 6);
    const width = 4 + (cow.escape % 4);
    const perimeter = 2 * (length + width);
    return {
      question: `Grade 6 (Difficulty ${cow.difficulty}): A net frame is ${length} by ${width}. What is the perimeter?`,
      answer: perimeter,
      hint: "Perimeter = 2 x (length + width).",
    };
  }
  if (grade === 7) {
    const base = 6 + (cow.difficulty % 5);
    const height = 5 + (cow.speed % 4);
    const area = (base * height) / 2;
    return {
      question: `Grade 7 (Difficulty ${cow.difficulty}): Triangle net has base ${base} and height ${height}. What is the area?`,
      answer: area,
      hint: "Triangle area = (base x height) / 2.",
    };
  }
  const side = 4 + (cow.difficulty % 5);
  const height = 6 + (cow.escape % 4);
  const volume = side * side * height;
  return {
    question: `Grade 8 (Difficulty ${cow.difficulty}): Net frame is a square prism. Side ${side}, height ${height}. What is the volume?`,
    answer: volume,
    hint: "Volume = base area x height.",
  };
}

function generateFencePuzzle() {
  const grade = getGradeLevel(state.fenceStrength + 3);
  if (grade <= 6) {
    const length = Math.floor(8 + Math.random() * 6);
    const width = Math.floor(6 + Math.random() * 5);
    const perimeter = 2 * (length + width);
    return {
      question: `Fence upgrade: farm plot is ${length} by ${width}. What is the perimeter?`,
      answer: perimeter,
      hint: "Perimeter = 2 x (length + width).",
    };
  }
  const height = 4 + (state.fenceHeight % 4);
  const base = 5 + (state.fenceStrength % 5);
  const volume = height * base * base;
  return {
    question: `Fence upgrade: post is a ${base} by ${base} square, height ${height}. What is the volume?`,
    answer: volume,
    hint: "Volume = base area x height.",
  };
}

function generateLockPuzzle() {
  const grade = getGradeLevel(state.lockLevel + 5);
  if (grade <= 6) {
    const base = 8 + state.lockLevel * 2;
    const percent = 10 + state.lockLevel * 5;
    const result = Math.round(base * (1 + percent / 100));
    return {
      question: `Locks: strength ${base} increased by ${percent}%. What is the new strength?`,
      answer: result,
      hint: "Multiply by (1 + percent/100).",
    };
  }
  const x = 4 + (state.lockLevel % 5);
  const a = 3 + (state.lockLevel % 4);
  const b = 5 + (state.lockLevel % 6);
  const c = a * x + b;
  return {
    question: `Locks: Solve ${a}x + ${b} = ${c}. What is x?`,
    answer: x,
    hint: "Subtract b, then divide by a.",
  };
}

function showDefensePuzzle(puzzle, raidId, timeLimit) {
  state.puzzle = {
    question: puzzle.question,
    hint: puzzle.hint,
    answer: null, // We don't know the answer, server validates
    raidId: raidId,
    onSuccess: () => {},
    onFail: () => {},
    timeLimitMs: timeLimit,
    start: performance.now(),
    isDefense: true,
  };
  renderDefensePuzzle(puzzle, raidId, timeLimit);
}

function renderDefensePuzzle(puzzle, raidId, timeLimit) {
  puzzleBox.innerHTML = "";

  const warning = document.createElement("div");
  warning.style.color = "#c44";
  warning.style.fontWeight = "bold";
  warning.textContent = "RAID INCOMING! Solve to defend!";
  puzzleBox.appendChild(warning);

  const question = document.createElement("div");
  question.textContent = puzzle.question;
  question.style.marginTop = "8px";
  puzzleBox.appendChild(question);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter answer";
  puzzleBox.appendChild(input);

  const button = document.createElement("button");
  button.className = "action";
  button.textContent = "Defend!";
  puzzleBox.appendChild(button);

  const timer = document.createElement("div");
  timer.style.marginTop = "8px";
  timer.style.fontSize = "12px";
  timer.style.color = "#c44";
  timer.textContent = `Time: ${Math.ceil(timeLimit / 1000)}s`;
  puzzleBox.appendChild(timer);

  button.addEventListener("click", () => {
    const value = parseFloat(input.value.trim());
    if (Number.isNaN(value)) {
      logEvent("Answer not recognized. Try again.");
      return;
    }
    sendToServer({ type: "defend", raidId, answer: value });
    state.puzzle = null;
    state.pendingRaid = null;
    renderPuzzle();
  });

  input.focus();
}

function generateDefensePuzzle() {
  const grade = getGradeLevel(state.fenceStrength + 4);
  if (grade <= 6) {
    const base = 10 + Math.floor(Math.random() * 10);
    const rate = 0.6;
    const result = parseFloat((base * rate).toFixed(1));
    return {
      question: `Defense wiring: strength = ${rate} x ${base}. What strength?`,
      answer: result,
      hint: "Multiply the base by the rate.",
    };
  }
  const a = 3 + Math.floor(Math.random() * 3);
  const b = 4 + Math.floor(Math.random() * 4);
  const c = a * 6 + b;
  return {
    question: `Defense algebra: Solve ${a}x + ${b} = ${c}. What is x?`,
    answer: 6,
    hint: "Subtract b, then divide by a.",
  };
}

function attemptCapture(cow, toolPower, toolType) {
  const requiredTool = cow.allowedTool ? cow.allowedTool : computeAllowedTool(cow);
  if (toolType !== requiredTool) {
    logEvent(`${cow.name} can only be caught with a ${requiredTool}.`, "negative");
    return;
  }
  if (state.online) {
    sendToServer({ type: "capture", cowId: cow.id, toolPower, toolType });
    logEvent(`You attempt to catch ${cow.name}.`, "neutral");
    return;
  }
  const weatherBoost = cow.favoredWeather === state.weather ? -1 : 0;
  const difficulty = cow.difficulty + weatherBoost - state.lockStrength * 0.15;
  const roll = Math.random() * 2;
  if (toolPower + roll >= difficulty) {
    cow.status = "captured";
    cow.owner = "player";
    state.captured.push(cow);
    logEvent(`You caught ${cow.name}!`, "positive");
    updateFarmStats();
  } else {
    logEvent(`${cow.name} escaped into the grass.`, "negative");
  }
}

function upgradeFence() {
  const puzzle = generateFencePuzzle();
  showPuzzle(puzzle, () => {
    state.fenceStrength += 2;
    state.fenceHeight += 1;
    state.selfFarm.size = Math.min(240, 160 + state.fenceHeight * 6);
    updateFarmStats();
    // Sync with server
    if (state.online) {
      sendToServer({ type: "upgradeFence", fenceStrength: state.fenceStrength });
    }
  }, () => {});
}

function upgradeLocks() {
  const cost = getLockCost();
  if (state.credits < cost) {
    logEvent(`Not enough credits. Need ${cost} credits for locks.`);
    return;
  }
  state.lockLevel += 1;
  state.lockStrength += 1;
  updateFarmStats();
  logEvent("Locks upgraded. Fence security improved.", "positive");
  // Sync with server
  if (state.online) {
    sendToServer({ type: "upgradeLock", lockLevel: state.lockLevel });
  }
}

function buyHintTokens() {
  const cost = HINT_TOKEN_COST;
  if (state.credits < cost) {
    logEvent(`Not enough credits. Need ${cost} credits for a hint token.`);
    return;
  }
  state.hintTokens += 1;
  updateFarmStats();
  logEvent("Bought a hint token.", "positive");
}

function drawWorld() {
  const ratio = window.devicePixelRatio || 1;
  const viewW = canvas.width / ratio;
  const viewH = canvas.height / ratio;
  ctx.clearRect(0, 0, viewW, viewH);

  ctx.fillStyle = "#8bcf78";
  ctx.fillRect(0, 0, viewW, viewH);

  const zoom = 1.4;
  const zoomW = viewW / zoom;
  const zoomH = viewH / zoom;

  const tile = 40;
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  for (let x = 0; x < viewW; x += tile) {
    for (let y = 0; y < viewH; y += tile) {
      if ((x + y) % (tile * 2) === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  const camX = clamp(state.player.x - zoomW / 2, 0, WORLD_SIZE - zoomW);
  const camY = clamp(state.player.y - zoomH / 2, 0, WORLD_SIZE - zoomH);
  state.view = { camX, camY, zoom };

  ctx.save();
  ctx.scale(zoom, zoom);

  drawFarm(camX, camY, {
    name: state.farmName,
    strength: state.fenceStrength,
    cows: state.captured.length,
    isPlayer: true,
    cowsList: state.captured,
    x: state.selfFarm.x,
    y: state.selfFarm.y,
  });
  state.farms.forEach((farm) => {
    drawFarm(camX, camY, {
      name: farm.name,
      strength: farm.strength,
      cows: farm.cowsList.length,
      x: farm.x,
      y: farm.y,
      isPlayer: false,
      cowsList: farm.cowsList,
    });
  });

  state.cows.forEach((cow) => {
    if (cow.status !== "wild") return;
    const screenX = cow.x - camX;
    const screenY = cow.y - camY;
    if (screenX < -VIEW_PADDING || screenX > viewW + VIEW_PADDING) return;
    if (screenY < -VIEW_PADDING || screenY > viewH + VIEW_PADDING) return;

    ctx.fillStyle = "#8a5c3d";
    ctx.fillRect(screenX - 10, screenY - 8, 20, 16);
    ctx.fillStyle = "#f2e6c9";
    ctx.fillRect(screenX - 6, screenY - 12, 12, 5);
    ctx.fillStyle = "#3a2b1a";
    ctx.fillRect(screenX - 9, screenY - 2, 4, 4);
    ctx.fillRect(screenX + 5, screenY - 2, 4, 4);
  });

  // Draw other players
  state.otherPlayers.forEach((player) => {
    const px = player.x - camX;
    const py = player.y - camY;
    if (px < -VIEW_PADDING || px > viewW + VIEW_PADDING) return;
    if (py < -VIEW_PADDING || py > viewH + VIEW_PADDING) return;

    // Player body (different color from local player)
    ctx.fillStyle = "#4a6b8a";
    ctx.fillRect(px - 8, py - 8, 16, 16);
    // Player hat
    ctx.fillStyle = "#7eb5e0";
    ctx.fillRect(px - 5, py - 13, 10, 5);
    // Player name
    ctx.fillStyle = "#2f2b23";
    ctx.font = "9px Rockwell, Palatino, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(player.name, px, py - 16);
  });

  // Draw local player
  const playerX = state.player.x - camX;
  const playerY = state.player.y - camY;
  ctx.fillStyle = "#2f2b23";
  ctx.fillRect(playerX - 8, playerY - 8, 16, 16);
  ctx.fillStyle = "#f0b562";
  ctx.fillRect(playerX - 5, playerY - 13, 10, 5);

  // Draw chat bubbles
  drawChatBubbles(camX, camY);

  ctx.restore();
  drawEnvironmentOverlay(viewW, viewH);
  drawMiniMap();
  renderHoverTooltip();
}

function drawChatBubbles(camX, camY) {
  const now = performance.now();
  const BUBBLE_DURATION = 5000; // 5 seconds

  // Remove old messages
  state.chatMessages = state.chatMessages.filter((msg) => now - msg.time < BUBBLE_DURATION);

  state.chatMessages.forEach((msg) => {
    // Find player position for this message
    let px, py;
    if (msg.senderId === state.playerId) {
      px = state.player.x;
      py = state.player.y;
    } else {
      const player = state.otherPlayers.find((p) => p.id === msg.senderId);
      if (!player) return;
      px = player.x;
      py = player.y;
    }

    const screenX = px - camX;
    const screenY = py - camY;

    // Calculate opacity (fade out in last second)
    const age = now - msg.time;
    const opacity = age > BUBBLE_DURATION - 1000 ? (BUBBLE_DURATION - age) / 1000 : 1;

    // Draw bubble
    ctx.save();
    ctx.globalAlpha = opacity;

    const text = msg.text.length > 30 ? msg.text.substring(0, 27) + "..." : msg.text;
    ctx.font = "10px Rockwell, Palatino, Georgia, serif";
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = textWidth + 12;
    const bubbleHeight = 18;
    const bubbleX = screenX - bubbleWidth / 2;
    const bubbleY = screenY - 35;

    // Bubble background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 4);
    ctx.fill();
    ctx.strokeStyle = "#7f5c36";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bubble pointer
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(screenX - 4, bubbleY + bubbleHeight);
    ctx.lineTo(screenX, bubbleY + bubbleHeight + 5);
    ctx.lineTo(screenX + 4, bubbleY + bubbleHeight);
    ctx.fill();

    // Text
    ctx.fillStyle = "#2f2b23";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, screenX, bubbleY + bubbleHeight / 2);

    ctx.restore();
  });
}

// Weather animation state
const weatherParticles = {
  rain: [],
  wind: [],
  fog: [],
  initialized: false,
};

function initWeatherParticles(viewW, viewH) {
  // Rain drops
  weatherParticles.rain = [];
  for (let i = 0; i < 150; i++) {
    weatherParticles.rain.push({
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      speed: 8 + Math.random() * 6,
      length: 10 + Math.random() * 15,
    });
  }

  // Wind streaks
  weatherParticles.wind = [];
  for (let i = 0; i < 60; i++) {
    weatherParticles.wind.push({
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      speed: 4 + Math.random() * 4,
      length: 30 + Math.random() * 40,
      opacity: 0.1 + Math.random() * 0.2,
    });
  }

  // Fog clouds
  weatherParticles.fog = [];
  for (let i = 0; i < 20; i++) {
    weatherParticles.fog.push({
      x: Math.random() * viewW,
      y: Math.random() * viewH,
      radius: 80 + Math.random() * 120,
      speed: 0.3 + Math.random() * 0.5,
      opacity: 0.15 + Math.random() * 0.15,
    });
  }

  weatherParticles.initialized = true;
}

function drawEnvironmentOverlay(viewW, viewH) {
  if (!weatherParticles.initialized) {
    initWeatherParticles(viewW, viewH);
  }

  ctx.save();

  // Night overlay with gradient
  if (state.dayTime === "night") {
    const gradient = ctx.createRadialGradient(viewW / 2, viewH / 2, 100, viewW / 2, viewH / 2, viewW);
    gradient.addColorStop(0, "rgba(20, 22, 38, 0.25)");
    gradient.addColorStop(1, "rgba(10, 12, 25, 0.5)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewW, viewH);

    // Stars at night
    ctx.fillStyle = "rgba(255, 255, 220, 0.6)";
    for (let i = 0; i < 30; i++) {
      const x = (i * 73 + 20) % viewW;
      const y = (i * 47 + 10) % (viewH * 0.4);
      const size = 1 + (i % 3);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sun rays during sunny day
  if (state.weather === "sun" && state.dayTime === "day") {
    const gradient = ctx.createRadialGradient(viewW * 0.8, 50, 0, viewW * 0.8, 50, 200);
    gradient.addColorStop(0, "rgba(255, 245, 180, 0.3)");
    gradient.addColorStop(0.5, "rgba(255, 245, 180, 0.1)");
    gradient.addColorStop(1, "rgba(255, 245, 180, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewW, viewH);

    // Sun
    ctx.fillStyle = "rgba(255, 220, 100, 0.8)";
    ctx.beginPath();
    ctx.arc(viewW * 0.85, 40, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fog effect with moving clouds
  if (state.weather === "fog") {
    ctx.fillStyle = "rgba(200, 210, 220, 0.2)";
    ctx.fillRect(0, 0, viewW, viewH);

    weatherParticles.fog.forEach((cloud) => {
      cloud.x += cloud.speed;
      if (cloud.x > viewW + cloud.radius) {
        cloud.x = -cloud.radius;
      }

      const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
      gradient.addColorStop(0, `rgba(220, 230, 240, ${cloud.opacity})`);
      gradient.addColorStop(1, "rgba(220, 230, 240, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Rain effect with animated drops
  if (state.weather === "rain") {
    // Dark overlay for rain
    ctx.fillStyle = "rgba(60, 70, 90, 0.15)";
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 2;

    weatherParticles.rain.forEach((drop) => {
      drop.y += drop.speed;
      drop.x += 1; // Slight angle
      if (drop.y > viewH) {
        drop.y = -drop.length;
        drop.x = Math.random() * viewW;
      }

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + 3, drop.y + drop.length);
      ctx.stroke();
    });

    // Puddle ripples at bottom
    ctx.strokeStyle = "rgba(150, 180, 220, 0.3)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = (i * 120 + (performance.now() / 50) % 120) % viewW;
      const y = viewH - 20 - (i % 3) * 10;
      const size = 5 + (performance.now() / 200 + i) % 15;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size / 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Wind effect with animated streaks
  if (state.weather === "wind") {
    weatherParticles.wind.forEach((streak) => {
      streak.x += streak.speed;
      if (streak.x > viewW + streak.length) {
        streak.x = -streak.length;
        streak.y = Math.random() * viewH;
      }

      ctx.strokeStyle = `rgba(255, 255, 255, ${streak.opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      // Wavy line for wind
      ctx.quadraticCurveTo(
        streak.x + streak.length / 2,
        streak.y + Math.sin(streak.x / 30) * 5,
        streak.x + streak.length,
        streak.y + Math.sin(streak.x / 20) * 3
      );
      ctx.stroke();
    });

    // Leaves/debris
    ctx.fillStyle = "rgba(120, 160, 80, 0.4)";
    for (let i = 0; i < 15; i++) {
      const t = performance.now() / 1000;
      const x = ((i * 130 + t * 80) % (viewW + 50)) - 25;
      const y = (i * 70 + Math.sin(t * 2 + i) * 30) % viewH;
      ctx.beginPath();
      ctx.ellipse(x, y, 4, 2, t + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function getLocalVisibility(cow) {
  const base = 160;
  if (state.weather === "fog") {
    return cow.favoredWeather === "fog" ? 70 : 90;
  }
  if (state.weather === "rain") return base - 30;
  if (state.weather === "wind") return base - 20;
  return base;
}

function drawFarm(camX, camY, farm) {
  const farmSize = farm.size || 160;
  const farmX = farm.x - farmSize / 2;
  const farmY = farm.y - farmSize / 2;

  const screenX = farmX - camX;
  const screenY = farmY - camY;

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillRect(screenX, screenY, farmSize, farmSize);

  const strength = farm.isPlayer ? state.fenceStrength + state.lockStrength : farm.strength;
  const height = farm.isPlayer ? state.fenceHeight : 2;
  const thickness = 3 + height * 0.7 + (farm.isPlayer ? state.lockStrength * 0.6 : 0);
  ctx.strokeStyle = strength > 5 ? "#c37b3a" : "#7f5c36";
  ctx.lineWidth = thickness;
  ctx.strokeRect(screenX, screenY, farmSize, farmSize);

  ctx.fillStyle = "#6b3f1d";
  ctx.fillRect(screenX + farmSize / 2 - 10, screenY + farmSize / 2 - 10, 20, 20);

  // Draw locks at corners based on lock level
  const locksToDraw = farm.isPlayer ? state.lockLevel : 0;
  if (locksToDraw > 0) {
    const lockPositions = [
      { x: screenX - 4, y: screenY - 4 },               // top-left
      { x: screenX + farmSize - 4, y: screenY - 4 },    // top-right
      { x: screenX - 4, y: screenY + farmSize - 6 },    // bottom-left
      { x: screenX + farmSize - 4, y: screenY + farmSize - 6 }, // bottom-right
    ];

    for (let i = 0; i < Math.min(locksToDraw, 4); i++) {
      const pos = lockPositions[i];
      ctx.fillStyle = "#d3a84f";
      ctx.fillRect(pos.x, pos.y, 8, 10);
      ctx.strokeStyle = "#8b6a2b";
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x, pos.y, 8, 10);
      ctx.beginPath();
      ctx.arc(pos.x + 4, pos.y - 2, 4, Math.PI, 0);
      ctx.stroke();
    }
  }

  renderFarmCows(screenX, screenY, farmSize, farm.isPlayer ? state.captured.length : farm.cows);
  renderFarmNameplate(screenX, screenY, farmSize, farm.name, farm.isPlayer);
}

function renderFarmCows(screenX, screenY, farmSize, cowCount) {
  if (cowCount === 0) return;
  const cowsToShow = Math.min(12, cowCount);
  const grid = 4;
  const gap = farmSize / (grid + 1);
  for (let index = 0; index < cowsToShow; index += 1) {
    const row = Math.floor(index / grid);
    const col = index % grid;
    const cx = screenX + gap * (col + 1);
    const cy = screenY + gap * (row + 1);
    ctx.fillStyle = "#9a6a44";
    ctx.fillRect(cx - 7, cy - 6, 14, 12);
    ctx.fillStyle = "#f2e6c9";
    ctx.fillRect(cx - 4, cy - 10, 8, 4);
  }
}

function renderFarmNameplate(screenX, screenY, farmSize, name, isPlayer) {
  const plateW = Math.min(farmSize - 20, 120);
  const plateH = 18;
  const plateX = screenX + (farmSize - plateW) / 2;
  const plateY = screenY - 26;
  ctx.fillStyle = isPlayer ? "#f5d27a" : "#e6dfcf";
  ctx.fillRect(plateX, plateY, plateW, plateH);
  ctx.strokeStyle = "#7f5c36";
  ctx.lineWidth = 2;
  ctx.strokeRect(plateX, plateY, plateW, plateH);
  ctx.fillStyle = "#2f2b23";
  ctx.font = "10px Rockwell, Palatino, Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, plateX + plateW / 2, plateY + plateH / 2);
}

function getAllFarms() {
  const playerFarm = {
    name: state.farmName,
    x: state.selfFarm.x,
    y: state.selfFarm.y,
    size: 160,
    cowsList: state.captured,
    isPlayer: true,
  };
  const npcList = state.farms.map((farm) => ({
    name: farm.name,
    x: farm.x,
    y: farm.y,
    size: 160,
    cowsList: farm.cowsList,
    isPlayer: false,
  }));
  return [playerFarm, ...npcList];
}

function renderHoverTooltip() {
  if (!state.mouse.hasMove && !state.lockedFarmName) return;
  const hovered = state.lockedFarmName
    ? getAllFarms().find((farm) => farm.name === state.lockedFarmName)
    : getHoveredFarm();
  if (!hovered) return;

  const { camX, camY, zoom } = state.view;
  const farmX = hovered.x - hovered.size / 2 - camX;
  const farmY = hovered.y - hovered.size / 2 - camY;

  ctx.save();
  ctx.scale(zoom, zoom);

  const plateX = farmX;
  const plateY = farmY - 42;
  const names = hovered.cowsList.map((cow) => {
    if (typeof cow === "string") {
      const found = state.cows.find((item) => item.id === cow);
      return found ? found.name : cow;
    }
    return cow.name;
  });
  const preview = names.slice(0, 5);
  const overflow = names.length - preview.length;
  if (overflow > 0) preview.push(`+${overflow} more`);
  const title = hovered.isPlayer ? `${hovered.name} (You)` : hovered.name;
  const lines = [title, ...preview];

  // Show raid hint during night if not player's farm
  const canRaid = state.online && state.dayTime === "night" && !hovered.isPlayer && hovered.cowsList.length > 0;
  if (canRaid) {
    lines.push("[Click to raid]");
  }

  const width = 140;
  const height = 16 * lines.length + 10;

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "#7f5c36";
  ctx.lineWidth = 2;
  ctx.fillRect(plateX, plateY, width, height);
  ctx.strokeRect(plateX, plateY, width, height);

  ctx.fillStyle = "#2f2b23";
  ctx.font = "10px Rockwell, Palatino, Georgia, serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    if (line === "[Click to raid]") {
      ctx.fillStyle = "#c44";
    }
    ctx.fillText(line, plateX + 6, plateY + 6 + index * 14);
    ctx.fillStyle = "#2f2b23";
  });

  ctx.restore();
}

function getHoveredFarm() {
  const { camX, camY, zoom } = state.view;
  const mouseWorldX = camX + state.mouse.x / zoom;
  const mouseWorldY = camY + state.mouse.y / zoom;
  const farms = getAllFarms();
  return farms.find((farm) => {
    const half = farm.size / 2;
    return (
      mouseWorldX >= farm.x - half &&
      mouseWorldX <= farm.x + half &&
      mouseWorldY >= farm.y - half &&
      mouseWorldY <= farm.y + half
    );
  });
}

function drawMiniMap() {
  if (!miniCtx) return;
  const w = minimap.width;
  const h = minimap.height;
  miniCtx.clearRect(0, 0, w, h);
  miniCtx.fillStyle = "#d9f2c1";
  miniCtx.fillRect(0, 0, w, h);

  miniCtx.strokeStyle = "#7f5c36";
  miniCtx.lineWidth = 2;
  miniCtx.strokeRect(2, 2, w - 4, h - 4);

  const scaleX = w / WORLD_SIZE;
  const scaleY = h / WORLD_SIZE;

  // wild cows
  miniCtx.fillStyle = "#7d4d2c";
  state.cows.forEach((cow) => {
    if (cow.status !== "wild") return;
    miniCtx.fillRect(cow.x * scaleX, cow.y * scaleY, 2, 2);
  });

  // farms
  const farms = getAllFarms();
  farms.forEach((farm) => {
    miniCtx.fillStyle = farm.isPlayer ? "#e07a4e" : "#b09a7a";
    miniCtx.fillRect(farm.x * scaleX - 3, farm.y * scaleY - 3, 6, 6);
    miniCtx.fillStyle = "#2f2b23";
    miniCtx.font = "9px Rockwell, Palatino, Georgia, serif";
    miniCtx.textAlign = "left";
    miniCtx.textBaseline = "middle";
    miniCtx.fillText(
      farm.cowsList ? String(farm.cowsList.length) : String(farm.cows || 0),
      farm.x * scaleX + 5,
      farm.y * scaleY
    );
  });

  // player position
  miniCtx.fillStyle = "#2f2b23";
  miniCtx.fillRect(state.player.x * scaleX - 2, state.player.y * scaleY - 2, 4, 4);
}

function gameLoop() {
  updateCycle();
  movePlayer();
  updateLocalCowAI();
  findNearbyCow();
  drawWorld();
  handlePuzzleTimer();
  sendPlayerUpdate();
  requestAnimationFrame(gameLoop);
}

function updateLocalCowAI() {
  if (state.online) return;
  const player = state.player;
  const farms = getAllFarms();
  state.cows.forEach((cow) => {
    if (cow.status !== "wild") return;
    if (cow.vx === undefined) {
      cow.vx = (Math.random() - 0.5) * 0.3;
      cow.vy = (Math.random() - 0.5) * 0.3;
    }
    const temperamentFactor =
      cow.temperament === "skittish" ? 0.95 :
      cow.temperament === "stubborn" ? 0.85 :
      cow.temperament === "calm" ? 0.65 : 0.75;
    const favoredBonus = cow.favoredWeather === state.weather ? 1.05 : 0.85;
    const speedFactor =
      state.weather === "wind" ? 0.9 :
      state.weather === "rain" ? 0.55 :
      state.weather === "fog" ? 0.45 : 0.7;
    const escapeFactor = 0.4 + cow.escape / 80;
    const desiredSpeed = (cow.speed / 70) * speedFactor * temperamentFactor * favoredBonus * escapeFactor;

    if (Math.random() < 0.01) {
      cow.vx += (Math.random() - 0.5) * 0.08;
      cow.vy += (Math.random() - 0.5) * 0.08;
    }

    if (Math.random() < 0.9) {
      cow.vx *= 0.7;
      cow.vy *= 0.7;
    }

    const dx = cow.x - player.x;
    const dy = cow.y - player.y;
    const dist = Math.hypot(dx, dy);
    const fleeDistance = 60 + cow.escape * 3 + (cow.temperament === "skittish" ? 15 : 0);
    if (dist < fleeDistance) {
      cow.vx += (dx / dist) * (0.12 + cow.escape * 0.008);
      cow.vy += (dy / dist) * (0.12 + cow.escape * 0.008);
    }

    const mag = Math.hypot(cow.vx, cow.vy) || 1;
    cow.vx = (cow.vx / mag) * desiredSpeed;
    cow.vy = (cow.vy / mag) * desiredSpeed;

    cow.x = clamp(cow.x + cow.vx, 0, WORLD_SIZE);
    cow.y = clamp(cow.y + cow.vy, 0, WORLD_SIZE);

    if (cow.x <= 0 || cow.x >= WORLD_SIZE) cow.vx *= -1;
    if (cow.y <= 0 || cow.y >= WORLD_SIZE) cow.vy *= -1;

    keepCowOutOfFarms(cow, farms);
  });
}

function keepCowOutOfFarms(cow, farms) {
  farms.forEach((farm) => {
    const half = (farm.size || 160) / 2;
    const left = farm.x - half;
    const right = farm.x + half;
    const top = farm.y - half;
    const bottom = farm.y + half;
    if (cow.x > left && cow.x < right && cow.y > top && cow.y < bottom) {
      const dx = cow.x - farm.x;
      const dy = cow.y - farm.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        cow.x = dx > 0 ? right + 2 : left - 2;
        cow.vx *= -0.6;
      } else {
        cow.y = dy > 0 ? bottom + 2 : top - 2;
        cow.vy *= -0.6;
      }
    }
  });
}

function sendPlayerUpdate() {
  if (!state.online) return;
  const now = performance.now();
  if (now - state.lastMoveSend < 200) return;
  state.lastMoveSend = now;
  sendToServer({ type: "move", x: state.player.x, y: state.player.y });
}

function handlePuzzleTimer() {
  if (!state.puzzle || !state.puzzle.timeLimitMs) return;
  const elapsed = performance.now() - state.puzzle.start;
  if (elapsed > state.puzzle.timeLimitMs) {
    const fail = state.puzzle.onFail;
    state.puzzle = null;
    renderPuzzle();
    fail();
    logEvent("Time ran out! Defense failed.");
  }
}

function handleKeyDown(event) {
  // Don't handle keys if chat is open
  if (chatOpen) return;

  switch (event.key) {
    case "Enter":
      if (state.online) {
        toggleChat();
      }
      break;
    case "w":
    case "W":
    case "ArrowUp":
      state.player.vy = -PLAYER_SPEED;
      break;
    case "s":
    case "S":
    case "ArrowDown":
      state.player.vy = PLAYER_SPEED;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      state.player.vx = -PLAYER_SPEED;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      state.player.vx = PLAYER_SPEED;
      break;
    default:
      break;
  }
}

function handleKeyUp(event) {
  switch (event.key) {
    case "w":
    case "W":
    case "ArrowUp":
    case "s":
    case "S":
    case "ArrowDown":
      state.player.vy = 0;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
    case "d":
    case "D":
    case "ArrowRight":
      state.player.vx = 0;
      break;
    default:
      break;
  }
}

function applyTouchDirections() {
  const dirs = state.touchDirs;
  state.player.vx = 0;
  state.player.vy = 0;
  if (dirs.has("up")) state.player.vy = -PLAYER_SPEED;
  if (dirs.has("down")) state.player.vy = PLAYER_SPEED;
  if (dirs.has("left")) state.player.vx = -PLAYER_SPEED;
  if (dirs.has("right")) state.player.vx = PLAYER_SPEED;
}

function bindTouchControls() {
  if (!touchControls) return;
  const buttons = touchControls.querySelectorAll(".touch-btn");
  buttons.forEach((button) => {
    const dir = button.dataset.dir;
    const start = (event) => {
      event.preventDefault();
      state.touchDirs.add(dir);
      applyTouchDirections();
    };
    const end = (event) => {
      event.preventDefault();
      state.touchDirs.delete(dir);
      applyTouchDirections();
    };
    button.addEventListener("touchstart", start, { passive: false });
    button.addEventListener("touchend", end, { passive: false });
    button.addEventListener("touchcancel", end, { passive: false });
    button.addEventListener("mousedown", start);
    button.addEventListener("mouseup", end);
    button.addEventListener("mouseleave", end);
  });
}

ropeBtn.addEventListener("click", () => {
  const cow = state.cows.find((item) => item.id === state.selectedCowId);
  if (!cow) return;
  const puzzle = generateCapturePuzzle(cow, "rope");
  showPuzzle(puzzle, () => attemptCapture(cow, 7, "rope"), () => {});
});

netBtn.addEventListener("click", () => {
  const cow = state.cows.find((item) => item.id === state.selectedCowId);
  if (!cow) return;
  const puzzle = generateCapturePuzzle(cow, "net");
  showPuzzle(puzzle, () => attemptCapture(cow, 9, "net"), () => {});
});

upgradeFenceBtn.addEventListener("click", upgradeFence);
upgradeLockBtn.addEventListener("click", upgradeLocks);
buyHintsBtn.addEventListener("click", buyHintTokens);

// Chat functionality
let chatOpen = false;

function toggleChat() {
  chatOpen = !chatOpen;
  chatContainer.style.display = chatOpen ? "flex" : "none";
  if (chatOpen) {
    chatInput.focus();
  }
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text || !state.online) return;
  sendToServer({ type: "chat", text });
  chatInput.value = "";
  toggleChat();
}

chatSendBtn.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChat();
  } else if (event.key === "Escape") {
    toggleChat();
  }
  event.stopPropagation();
});

startBtn.addEventListener("click", () => {
  initAudio();
  const name = farmNameInput.value.trim() || "Meadowlight";
  state.farmName = name;
  startModal.style.display = "none";
  connectToServer();
  setTimeout(() => {
    if (!state.online && state.cows.length === 0) {
      initCows();
      initFarms();
      updateFarmStats();
      logEvent("Welcome to the grassland. Find a cow to begin.", "neutral");
      setWeather(WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)]);
    } else {
      logEvent("Connected to the town server.", "positive");
    }
  }, 1200);
  requestAnimationFrame(gameLoop);
});

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = event.clientX - rect.left;
  state.mouse.y = event.clientY - rect.top;
  state.mouse.hasMove = true;
});

bindTouchControls();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

canvas.addEventListener("click", () => {
  const hovered = getHoveredFarm();
  if (!hovered) {
    state.lockedFarmName = null;
    return;
  }

  // Check if we can raid this farm
  const canRaid = state.online && state.dayTime === "night" && !hovered.isPlayer && hovered.cowsList.length > 0;
  if (canRaid && state.lockedFarmName === hovered.name) {
    // Second click on same farm during night = initiate raid
    const targetFarm = state.farms.find((f) => f.name === hovered.name);
    if (targetFarm) {
      sendToServer({ type: "raid", targetFarmId: targetFarm.id });
      logEvent(`Initiating raid on ${hovered.name}...`, "neutral");
      state.lockedFarmName = null;
    }
    return;
  }

  if (state.lockedFarmName === hovered.name) {
    state.lockedFarmName = null;
  } else {
    state.lockedFarmName = hovered.name;
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
});

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

resizeCanvas();
