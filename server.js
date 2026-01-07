const fs = require("fs");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const WORLD_SIZE = 2000;
const CYCLE_MS = 180000;  // 3 minutes total cycle
const NIGHT_MS = 45000;   // 45 seconds night
const SEASON_MS = 600000; // 10 minutes
const GOLDEN_TIMES_MS = [180000, 420000]; // 3 min, 7 min
const GOLDEN_DURATION_MS = 45000;
const FARM_CAPACITY_STEP = 16;
const FARM_BASE_SIZE = 160;
const FARM_MAX_SIZE = 260;
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

function computeFarmSize(capacity) {
  const steps = Math.max(0, Math.floor((capacity - FARM_CAPACITY_STEP) / FARM_CAPACITY_STEP));
  return Math.min(FARM_MAX_SIZE, FARM_BASE_SIZE + steps * 14);
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
    bonus: false,
    golden: false,
    seasonId: null,
    seasonValue: 0,
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
  seasonStart: Date.now(),
  seasonId: 1,
  goldenCowId: null,
  goldenExpiresAt: 0,
  nextGoldenIndex: 0,
};

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
  }

  updateSeason(now);
}

function updateSeason(now) {
  const seasonElapsed = now - state.seasonStart;
  if (seasonElapsed >= SEASON_MS) {
    endSeason(now);
    return;
  }

  if (state.goldenCowId && now >= state.goldenExpiresAt) {
    clearGoldenCow();
  }

  const nextTime = GOLDEN_TIMES_MS[state.nextGoldenIndex];
  if (nextTime !== undefined && seasonElapsed >= nextTime) {
    spawnGoldenCow(now);
    state.nextGoldenIndex += 1;
  }
}

function clearGoldenCow() {
  if (!state.goldenCowId) return;
  const cow = state.cows.find((item) => item.id === state.goldenCowId);
  if (cow) {
    cow.golden = false;
  }
  state.goldenCowId = null;
  state.goldenExpiresAt = 0;
}

function spawnGoldenCow(now) {
  const wild = state.cows.filter((cow) => cow.status === "wild");
  if (wild.length === 0) return;
  const cow = wild[Math.floor(Math.random() * wild.length)];
  cow.golden = true;
  state.goldenCowId = cow.id;
  state.goldenExpiresAt = now + GOLDEN_DURATION_MS;
  broadcast({ type: "event", message: "Golden cow appeared! Worth +2 season cows." });
}

function endSeason(now) {
  let winner = null;
  state.farms.forEach((farm) => {
    if (!winner || (farm.seasonCows || 0) > (winner.seasonCows || 0)) {
      winner = farm;
    }
  });
  if (winner) {
    broadcast({ type: "event", message: `Season winner: ${winner.name}! New season begins.` });
  } else {
    broadcast({ type: "event", message: "Season ended. New season begins." });
  }

  state.seasonStart = now;
  state.seasonId += 1;
  state.nextGoldenIndex = 0;
  clearGoldenCow();
  state.farms.forEach((farm) => {
    farm.seasonCows = 0;
  });
  state.cows.forEach((cow) => {
    cow.seasonId = null;
    cow.seasonValue = 0;
    cow.golden = false;
  });
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
  const farm = getFarmById(player.id);
  if (farm && farm.cowsList.length >= (farm.capacity || FARM_CAPACITY_STEP)) {
    send(player.ws, { type: "event", message: "Farm is full. Expand it to hold more cows." });
    return;
  }
  const weatherBoost = cow.favoredWeather === state.weather ? -1 : 0;
  const difficulty = cow.difficulty + weatherBoost + getSeasonDifficultyBoost(player.id);
  const roll = Math.random() * 2;
  if (toolPower + roll >= difficulty) {
    cow.status = "captured";
    cow.owner = player.id;
    cow.bonus = cow.favoredWeather === state.weather;
    cow.seasonId = state.seasonId;
    cow.seasonValue = cow.golden ? 2 : 1;
    if (farm) {
      farm.cowsList.push(cow.id);
      farm.seasonCows = (farm.seasonCows || 0) + cow.seasonValue;
    }
    if (cow.golden) {
      broadcast({ type: "event", message: `${player.name} caught the Golden Cow! +2 season cows.` });
      cow.golden = false;
      state.goldenCowId = null;
      state.goldenExpiresAt = 0;
    }
    broadcast({ type: "event", message: `${player.name} caught ${cow.name}.` });
  } else {
    send(player.ws, { type: "event", message: `${cow.name} escaped from your ${player.name} attempt.` });
  }
}

function getSeasonDifficultyBoost(playerId) {
  const farms = state.farms;
  if (farms.length < 2) return 0;
  const scores = farms.map((farm) => farm.seasonCows || 0);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const farm = getFarmById(playerId);
  if (!farm) return 0;
  const score = farm.seasonCows || 0;
  if (score === max && max !== min) return 1;
  if (score === min && max !== min) return -1;
  return 0;
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
        .filter((cow) => cow && cow.difficulty > defenseStrength && cow.seasonId === state.seasonId);

      if (stealableCows.length === 0) {
        // No season cows available to steal
        if (attacker) {
          send(attacker.ws, { type: "raidResult", success: false, message: `${raid.defenderName} has no season cows to steal.` });
          send(attacker.ws, { type: "event", message: `${raid.defenderName} has no season cows to steal.` });
        }
        if (defender) {
          send(defender.ws, { type: "raidResult", success: true, message: "No season cows were available to steal." });
          send(defender.ws, { type: "event", message: "No season cows were available to steal." });
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
        stolenCow.bonus = false;
        attackerFarm.seasonCows = (attackerFarm.seasonCows || 0) + (stolenCow.seasonValue || 1);
      }
      defenderFarm.seasonCows = Math.max(0, (defenderFarm.seasonCows || 0) - (stolenCow.seasonValue || 1));

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
    seasonEndsAt: state.seasonStart + SEASON_MS,
    seasonId: state.seasonId,
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
      bonus: cow.bonus,
      golden: cow.golden,
      visibility: cow.visibility,
      allowedTool: cow.allowedTool,
    })),
    farms: state.farms.map((farm) => {
      const capacity = Math.max(farm.capacity || FARM_CAPACITY_STEP, farm.cowsList.length);
      return {
        id: farm.id,
        name: farm.name,
        x: farm.x,
        y: farm.y,
        cowsList: farm.cowsList,
        seasonCows: farm.seasonCows || 0,
        capacity,
        size: farm.size || computeFarmSize(capacity),
      };
    }),
    players: Array.from(state.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      x: player.x,
      y: player.y,
      color: player.color || "#2a231c",
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

const MAX_FARMS = 5; // Max real players

wss.on("connection", (ws) => {
  // Check if server is full
  if (state.farms.length >= MAX_FARMS) {
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
    seasonCows: 0,
    capacity: FARM_CAPACITY_STEP,
    size: computeFarmSize(FARM_CAPACITY_STEP),
  };
  state.farms.push(playerFarm);

  const player = { id: playerId, ws, name: "New Farm", x: farmPos.x, y: farmPos.y, color: "#2a231c" };
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
      player.color = message.color || "#2a231c";
      playerFarm.name = player.name;
      playerFarm.color = player.color;
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

    if (message.type === "expandFarm") {
      const nextCapacity = Math.max(playerFarm.capacity || FARM_CAPACITY_STEP, message.capacity || 0);
      playerFarm.capacity = nextCapacity;
      playerFarm.size = computeFarmSize(nextCapacity);
      return;
    }

    if (message.type === "dissolveFarm") {
      // Release all cows back to wild
      playerFarm.cowsList.forEach((cowId) => {
        const cow = state.cows.find((c) => c.id === cowId);
        if (cow) {
          cow.status = "wild";
          cow.owner = null;
          cow.bonus = false;
          cow.golden = false;
          cow.seasonId = null;
          cow.seasonValue = 0;
          cow.x = 200 + Math.random() * (WORLD_SIZE - 400);
          cow.y = 200 + Math.random() * (WORLD_SIZE - 400);
        }
      });

      // Notify everyone
      broadcast({ type: "event", message: `${playerFarm.name} has dissolved their farm. ${playerFarm.cowsList.length} cows released!` });

      // Remove the farm
      const farmIndex = state.farms.findIndex((f) => f.id === playerId);
      if (farmIndex !== -1) {
        state.farms.splice(farmIndex, 1);
      }

      // Close the connection
      ws.close();
      return;
    }
  });

  ws.on("close", () => {
    state.players.delete(playerId);

    // Remove the player's farm and release their cows
    const farmIndex = state.farms.findIndex((f) => f.id === playerId);
    if (farmIndex !== -1) {
      const farm = state.farms[farmIndex];

      // Release all cows back to wild
      farm.cowsList.forEach((cowId) => {
        const cow = state.cows.find((c) => c.id === cowId);
        if (cow) {
          cow.status = "wild";
          cow.owner = null;
          cow.bonus = false;
          cow.golden = false;
          cow.seasonId = null;
          cow.seasonValue = 0;
          // Move cow to random position away from farms
          cow.x = 200 + Math.random() * (WORLD_SIZE - 400);
          cow.y = 200 + Math.random() * (WORLD_SIZE - 400);
        }
      });

      // Remove the farm
      state.farms.splice(farmIndex, 1);

      // Notify remaining players
      broadcast({ type: "event", message: `${farm.name} has been abandoned. Their cows are now wild!` });
    }
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
