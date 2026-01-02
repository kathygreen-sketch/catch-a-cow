const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const WORLD_SIZE = 2000;
const CYCLE_MS = 180000;  // 3 minutes total cycle
const NIGHT_MS = 45000;   // 45 seconds night
const WEATHER_TYPES = ["sun", "rain", "wind", "fog"];

function loadCows() {
  const dataPath = path.join(__dirname, "data.js");
  const text = fs.readFileSync(dataPath, "utf8");
  const match = text.match(/const COWS = (.*);/s);
  if (!match) {
    throw new Error("Could not parse data.js for cow data.");
  }
  return JSON.parse(match[1]);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const BASE_COWS = loadCows();

function computeAllowedTool(cow) {
  if (cow.temperament === "skittish" || cow.temperament === "curious") return "net";
  return "rope";
}

function initCows() {
  return BASE_COWS.map((cow) => ({
    ...cow,
    x: rand(0, WORLD_SIZE),
    y: rand(0, WORLD_SIZE),
    vx: rand(-0.8, 0.8),
    vy: rand(-0.8, 0.8),
    status: "wild",
    owner: null,
    visibility: 160,
    allowedTool: computeAllowedTool(cow),
  }));
}

const state = {
  cows: initCows(),
  farms: [],
  players: new Map(),
  weather: "sun",
  dayTime: "day",
  cycleStart: Date.now(),
  lastCycleIndex: -1,
  nextFarmIndex: 0,
  activeRaids: new Map(), // raidId -> { attackerId, defenderId, startTime, puzzleAnswer }
};

const npcFarms = [
  { id: "npc-1", name: "Bramblegate" },
  { id: "npc-2", name: "Riverbend" },
  { id: "npc-3", name: "Copperfield" },
  { id: "npc-4", name: "Moonridge" },
];

function initFarms() {
  const centerX = WORLD_SIZE / 2;
  const centerY = WORLD_SIZE / 2;
  const radius = 600; // Larger radius for better spacing
  state.farms = npcFarms.map((farm, index) => {
    const angle = (Math.PI * 2 * index) / npcFarms.length;
    return {
      id: farm.id,
      name: farm.name,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      cowsList: [],
      fenceStrength: 2 + index, // NPCs have some defense
      lockLevel: index,
    };
  });
}

initFarms();

const MIN_FARM_DISTANCE = 250; // Minimum pixels between farm centers

function getNextFarmPosition() {
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Try positions in expanding circles
    const baseRadius = 400 + (attempt * 50);
    const angle = Math.random() * Math.PI * 2;
    const radius = baseRadius + Math.random() * 200;

    const x = WORLD_SIZE / 2 + Math.cos(angle) * radius;
    const y = WORLD_SIZE / 2 + Math.sin(angle) * radius;

    // Clamp to world bounds with padding for farm size
    const clampedX = Math.max(120, Math.min(WORLD_SIZE - 120, x));
    const clampedY = Math.max(120, Math.min(WORLD_SIZE - 120, y));

    // Check distance from all existing farms
    let tooClose = false;
    for (const farm of state.farms) {
      const dx = farm.x - clampedX;
      const dy = farm.y - clampedY;
      const dist = Math.hypot(dx, dy);
      if (dist < MIN_FARM_DISTANCE) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      return { x: clampedX, y: clampedY };
    }
  }

  // Fallback: find any valid position
  for (let i = 0; i < 100; i++) {
    const x = 200 + Math.random() * (WORLD_SIZE - 400);
    const y = 200 + Math.random() * (WORLD_SIZE - 400);

    let valid = true;
    for (const farm of state.farms) {
      const dist = Math.hypot(farm.x - x, farm.y - y);
      if (dist < MIN_FARM_DISTANCE) {
        valid = false;
        break;
      }
    }

    if (valid) {
      return { x, y };
    }
  }

  // Last resort: offset from center
  const offset = state.farms.length * 300;
  return {
    x: WORLD_SIZE / 2 + (offset % (WORLD_SIZE - 400)) - (WORLD_SIZE - 400) / 2,
    y: WORLD_SIZE / 2 + Math.floor(offset / (WORLD_SIZE - 400)) * 300,
  };
}

function getFarmById(id) {
  return state.farms.find((farm) => farm.id === id);
}

function updateCycle() {
  const now = Date.now();
  const elapsed = now - state.cycleStart;
  const dayLength = CYCLE_MS - NIGHT_MS;
  const cyclePos = elapsed % CYCLE_MS;
  const cycleIndex = Math.floor(elapsed / CYCLE_MS);
  state.dayTime = cyclePos >= dayLength ? "night" : "day";

  if (cycleIndex !== state.lastCycleIndex) {
    state.lastCycleIndex = cycleIndex;
    state.weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    maybeNpcCapture();
  }
}

function getVisibility(cow) {
  const base = 160;
  if (state.weather === "fog") {
    return cow.favoredWeather === "fog" ? 70 : 90;
  }
  if (state.weather === "rain") return base - 30;
  if (state.weather === "wind") return base - 20;
  return base;
}

function updateCows() {
  const players = Array.from(state.players.values());
  const speedFactor =
    state.weather === "wind" ? 0.9 :
    state.weather === "rain" ? 0.55 :
    state.weather === "fog" ? 0.45 : 0.7;

  state.cows.forEach((cow) => {
    cow.visibility = getVisibility(cow);
    if (cow.status !== "wild") {
      const farm = getFarmById(cow.owner);
      if (farm) {
        cow.x = farm.x + rand(-40, 40);
        cow.y = farm.y + rand(-40, 40);
      }
      return;
    }

    if (Math.random() < 0.01) {
      cow.vx += rand(-0.08, 0.08);
      cow.vy += rand(-0.08, 0.08);
    }

    players.forEach((player) => {
      const dx = cow.x - player.x;
      const dy = cow.y - player.y;
      const dist = Math.hypot(dx, dy);
      const fleeDistance = 60 + cow.escape * 3 + (cow.temperament === "skittish" ? 15 : 0);
      if (dist < fleeDistance) {
        cow.vx += (dx / dist) * (0.12 + cow.escape * 0.008);
        cow.vy += (dy / dist) * (0.12 + cow.escape * 0.008);
      }
    });

    const temperamentFactor =
      cow.temperament === "skittish" ? 0.95 :
      cow.temperament === "stubborn" ? 0.85 :
      cow.temperament === "calm" ? 0.65 : 0.75;
    const favoredBonus = cow.favoredWeather === state.weather ? 1.05 : 0.85;
    const escapeFactor = 0.4 + cow.escape / 80;
    const desiredSpeed = (cow.speed / 70) * speedFactor * temperamentFactor * favoredBonus * escapeFactor;

    if (Math.random() < 0.9) {
      cow.vx *= 0.7;
      cow.vy *= 0.7;
    }
    const mag = Math.hypot(cow.vx, cow.vy) || 1;
    cow.vx = (cow.vx / mag) * desiredSpeed;
    cow.vy = (cow.vy / mag) * desiredSpeed;

    cow.x = clamp(cow.x + cow.vx, 0, WORLD_SIZE);
    cow.y = clamp(cow.y + cow.vy, 0, WORLD_SIZE);

    if (cow.x <= 0 || cow.x >= WORLD_SIZE) cow.vx *= -1;
    if (cow.y <= 0 || cow.y >= WORLD_SIZE) cow.vy *= -1;

    keepCowOutOfFarms(cow);
  });
}

function keepCowOutOfFarms(cow) {
  state.farms.forEach((farm) => {
    const half = 80;
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

function maybeNpcCapture() {
  if (Math.random() > 0.4) return;
  const wild = state.cows.filter((cow) => cow.status === "wild");
  if (wild.length === 0) return;
  const cow = wild[Math.floor(Math.random() * wild.length)];
  const npc = state.farms.find((farm) => farm.id.startsWith("npc-"));
  if (!npc) return;
  cow.status = "captured";
  cow.owner = npc.id;
  npc.cowsList.push(cow.id);
  broadcast({ type: "event", message: `${npc.name} caught ${cow.name}.` });
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  state.players.forEach((player) => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(message);
    }
  });
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function handleCapture(player, cowId, toolPower) {
  const cow = state.cows.find((item) => item.id === cowId);
  if (!cow || cow.status !== "wild") return;
  if (cow.allowedTool && cow.allowedTool !== player.toolType) {
    send(player.ws, { type: "event", message: `${cow.name} requires a ${cow.allowedTool}.` });
    return;
  }
  const weatherBoost = cow.favoredWeather === state.weather ? -1 : 0;
  const difficulty = cow.difficulty + weatherBoost;
  const roll = Math.random() * 2;
  if (toolPower + roll >= difficulty) {
    cow.status = "captured";
    cow.owner = player.id;
    const farm = getFarmById(player.id);
    if (farm) {
      farm.cowsList.push(cow.id);
    }
    broadcast({ type: "event", message: `${player.name} caught ${cow.name}.` });
  } else {
    send(player.ws, { type: "event", message: `${cow.name} escaped from your ${player.name} attempt.` });
  }
}

function generateRaidPuzzle() {
  const a = 2 + Math.floor(Math.random() * 5);
  const x = 3 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 6);
  const c = a * x + b;
  return {
    question: `Defense puzzle: Solve ${a}x + ${b} = ${c}. What is x?`,
    answer: x,
    hint: "Subtract the constant, then divide by the coefficient.",
  };
}

function handleRaid(attacker, targetFarmId) {
  if (state.dayTime !== "night") {
    send(attacker.ws, { type: "event", message: "Raids can only happen at night." });
    return;
  }

  const targetFarm = getFarmById(targetFarmId);
  if (!targetFarm) {
    send(attacker.ws, { type: "event", message: "Target farm not found." });
    return;
  }

  if (targetFarm.id === attacker.id) {
    send(attacker.ws, { type: "event", message: "You cannot raid your own farm." });
    return;
  }

  if (targetFarm.cowsList.length === 0) {
    send(attacker.ws, { type: "event", message: `${targetFarm.name} has no cows to steal.` });
    return;
  }

  // Check if target is already being raided
  for (const raid of state.activeRaids.values()) {
    if (raid.defenderId === targetFarmId) {
      send(attacker.ws, { type: "event", message: `${targetFarm.name} is already being raided.` });
      return;
    }
  }

  const raidId = `raid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const puzzle = generateRaidPuzzle();

  state.activeRaids.set(raidId, {
    attackerId: attacker.id,
    attackerName: attacker.name,
    defenderId: targetFarmId,
    defenderName: targetFarm.name,
    startTime: Date.now(),
    puzzleAnswer: puzzle.answer,
    resolved: false,
  });

  // Notify attacker
  send(attacker.ws, { type: "event", message: `Raiding ${targetFarm.name}! Waiting for their defense...` });
  send(attacker.ws, { type: "raidStarted", raidId, targetName: targetFarm.name });

  // Notify defender (if online player)
  const defender = state.players.get(targetFarmId);
  if (defender) {
    send(defender.ws, {
      type: "raidIncoming",
      raidId,
      attackerName: attacker.name,
      puzzle: { question: puzzle.question, hint: puzzle.hint },
      timeLimit: 15000,
    });
    send(defender.ws, { type: "event", message: `${attacker.name} is raiding your farm! Solve the puzzle to defend!` });
  } else {
    // NPC farm - auto-resolve after short delay with random success
    setTimeout(() => resolveRaid(raidId, Math.random() > 0.5), 2000);
  }

  // Set timeout for player defense
  setTimeout(() => {
    const raid = state.activeRaids.get(raidId);
    if (raid && !raid.resolved) {
      resolveRaid(raidId, false);
    }
  }, 16000);
}

function handleDefense(defender, raidId, answer) {
  const raid = state.activeRaids.get(raidId);
  if (!raid || raid.resolved) return;
  if (raid.defenderId !== defender.id) return;

  const isCorrect = Math.abs(answer - raid.puzzleAnswer) < 0.01;
  resolveRaid(raidId, isCorrect);
}

const CHAT_DISTANCE = 200; // Players within this range can see chat

function handleChat(sender, text) {
  if (!text || text.length === 0 || text.length > 100) return;

  const chatMessage = {
    type: "chat",
    senderId: sender.id,
    senderName: sender.name,
    text: text.trim(),
    x: sender.x,
    y: sender.y,
  };

  // Send to all players within chat distance
  state.players.forEach((player) => {
    const dx = player.x - sender.x;
    const dy = player.y - sender.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CHAT_DISTANCE || player.id === sender.id) {
      send(player.ws, chatMessage);
    }
  });
}

function resolveRaid(raidId, defenseSuccess) {
  const raid = state.activeRaids.get(raidId);
  if (!raid || raid.resolved) return;

  raid.resolved = true;
  state.activeRaids.delete(raidId);

  const attacker = state.players.get(raid.attackerId);
  const defender = state.players.get(raid.defenderId);
  const attackerFarm = getFarmById(raid.attackerId);
  const defenderFarm = getFarmById(raid.defenderId);

  if (defenseSuccess) {
    // Defense succeeded
    if (attacker) {
      send(attacker.ws, { type: "raidResult", success: false, message: `${raid.defenderName} defended successfully!` });
      send(attacker.ws, { type: "event", message: `${raid.defenderName} defended against your raid.` });
    }
    if (defender) {
      send(defender.ws, { type: "raidResult", success: true, message: "You defended your farm!" });
      send(defender.ws, { type: "event", message: "You successfully defended your farm!" });
    }
    broadcast({ type: "event", message: `${raid.defenderName} defended against ${raid.attackerName}'s raid.` });
  } else {
    // Raid succeeded - try to transfer a cow
    if (defenderFarm && defenderFarm.cowsList.length > 0) {
      // Calculate defense strength from fence + locks
      const defenseStrength = (defenderFarm.fenceStrength || 1) + (defenderFarm.lockLevel || 0);

      // Find a cow that can be stolen (difficulty <= defenseStrength can't escape)
      const stealableCows = defenderFarm.cowsList
        .map((cowId) => state.cows.find((c) => c.id === cowId))
        .filter((cow) => cow && cow.difficulty > defenseStrength);

      if (stealableCows.length === 0) {
        // All cows protected by strong fence
        if (attacker) {
          send(attacker.ws, { type: "raidResult", success: false, message: `${raid.defenderName}'s fence is too strong! No cows could escape.` });
          send(attacker.ws, { type: "event", message: `${raid.defenderName}'s strong fence protected all cows.` });
        }
        if (defender) {
          send(defender.ws, { type: "raidResult", success: true, message: "Your strong fence protected your cows!" });
          send(defender.ws, { type: "event", message: "Your fence protected your cows from the raid!" });
        }
        return;
      }

      // Steal the easiest cow that can escape (lowest difficulty above threshold)
      const stolenCow = stealableCows.sort((a, b) => a.difficulty - b.difficulty)[0];
      const stolenCowId = stolenCow.id;

      // Remove from defender
      defenderFarm.cowsList = defenderFarm.cowsList.filter((id) => id !== stolenCowId);

      if (attackerFarm) {
        attackerFarm.cowsList.push(stolenCowId);
        stolenCow.owner = raid.attackerId;
      }

      const cowName = stolenCow.name;

      if (attacker) {
        send(attacker.ws, { type: "raidResult", success: true, message: `You stole ${cowName} from ${raid.defenderName}!` });
        send(attacker.ws, { type: "event", message: `You stole ${cowName} from ${raid.defenderName}!` });
      }
      if (defender) {
        send(defender.ws, { type: "raidResult", success: false, message: `${raid.attackerName} stole ${cowName}!` });
        send(defender.ws, { type: "event", message: `${raid.attackerName} stole ${cowName} from your farm!` });
      }
      broadcast({ type: "event", message: `${raid.attackerName} stole ${cowName} from ${raid.defenderName}!` });
    }
  }
}

function snapshot() {
  return {
    type: "state",
    cows: state.cows.map((cow) => ({
      id: cow.id,
      name: cow.name,
      speed: cow.speed,
      temperament: cow.temperament,
      favoredWeather: cow.favoredWeather,
      escape: cow.escape,
      difficulty: cow.difficulty,
      x: cow.x,
      y: cow.y,
      status: cow.status,
      owner: cow.owner,
      visibility: cow.visibility,
      allowedTool: cow.allowedTool,
    })),
    farms: state.farms.map((farm) => ({
      id: farm.id,
      name: farm.name,
      x: farm.x,
      y: farm.y,
      cowsList: farm.cowsList,
    })),
    players: Array.from(state.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
    })),
    weather: state.weather,
    dayTime: state.dayTime,
  };
}

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

const MAX_FARMS = 5; // 4 NPCs + 1 player slot

wss.on("connection", (ws) => {
  // Check if server is full
  const playerFarmCount = state.farms.filter((f) => !f.id.startsWith("npc-")).length;
  if (playerFarmCount >= MAX_FARMS - npcFarms.length) {
    ws.send(JSON.stringify({ type: "error", message: "Server is full (max 5 farms). Try again later." }));
    ws.close();
    return;
  }

  const playerId = `player-${Math.floor(Math.random() * 1e9)}`;
  const farmPos = getNextFarmPosition();
  const playerFarm = {
    id: playerId,
    name: "New Farm",
    x: farmPos.x,
    y: farmPos.y,
    cowsList: [],
    fenceStrength: 1,
    lockLevel: 0,
  };
  state.farms.push(playerFarm);

  const player = { id: playerId, ws, name: "New Farm", x: farmPos.x, y: farmPos.y };
  state.players.set(playerId, player);

  send(ws, { type: "welcome", playerId, farm: playerFarm, spawn: farmPos });

  ws.on("message", (raw) => {
    let message = null;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }

    if (message.type === "join") {
      player.name = message.name || "New Farm";
      playerFarm.name = player.name;
      return;
    }

    if (message.type === "move") {
      player.x = clamp(message.x, 0, WORLD_SIZE);
      player.y = clamp(message.y, 0, WORLD_SIZE);
      return;
    }

    if (message.type === "capture") {
      player.toolType = message.toolType;
      handleCapture(player, message.cowId, message.toolPower || 0);
      return;
    }

    if (message.type === "raid") {
      handleRaid(player, message.targetFarmId);
      return;
    }

    if (message.type === "defend") {
      handleDefense(player, message.raidId, message.answer);
      return;
    }

    if (message.type === "chat") {
      handleChat(player, message.text);
      return;
    }

    if (message.type === "upgradeFence") {
      playerFarm.fenceStrength = message.fenceStrength || playerFarm.fenceStrength;
      return;
    }

    if (message.type === "upgradeLock") {
      playerFarm.lockLevel = message.lockLevel || playerFarm.lockLevel;
      return;
    }
  });

  ws.on("close", () => {
    state.players.delete(playerId);
  });
});

setInterval(() => {
  updateCycle();
  updateCows();
}, 120);

setInterval(() => {
  broadcast(snapshot());
}, 1000);

server.listen(PORT, HOST, () => {
  console.log(`Catch a Cow server running at http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
});
