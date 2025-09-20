(() => {
  'use strict';

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('game') || document.getElementById('game-mobile');
  console.log('Canvas found:', canvas);
  console.log('Canvas ID:', canvas ? canvas.id : 'null');
  const ctx = canvas.getContext('2d');
  // FPV canvas is now a div, so we don't need to get context
  const fpvCanvas = document.getElementById('fpv');
  const fpv = null; // No longer using canvas for FPV

  const uiLevel = document.getElementById('level');
  const uiStatus = document.getElementById('status');
  const ov = {
    root: document.getElementById('overlay'),
    title: document.getElementById('ov-title'),
    desc: document.getElementById('ov-desc'),
    time: document.getElementById('ov-time'),
    hit: document.getElementById('ov-hit'),
    score: document.getElementById('ov-score'),
    grade: document.getElementById('ov-grade'),
    next: document.getElementById('btn-next'),
    retry: document.getElementById('btn-retry'),
  };

  const scene = { width: 1280, height: 720, wallPadding: 30 };
  
  // Background image
  let backgroundImage = null;
  
  // Load background image
  const bgImg = new Image();
  bgImg.onload = () => {
    backgroundImage = bgImg;
    console.log('Background image loaded successfully');
  };
  bgImg.onerror = () => {
    console.log('Background image not found, using default');
  };
  bgImg.src = './assets/background.png';
  
  // Background music
  let backgroundMusic = null;
  let musicPlaying = false;
  let userInteracted = false;
  
  // Sound effects
  let soundEnabled = true;
  let engineSound = null;
  let brakeSound = null;
  let successSound = null;
  let failureSound = null;
  let collisionSound = null;
  let parkingSound = null;
  
  // Sound throttling
  let lastEngineSound = 0;
  let lastBrakeSound = 0;
  const soundThrottle = 100; // milliseconds
  
  // Load background music
  const music = new Audio();
  music.src = './assets/parking.mp3';
  music.loop = true;
  music.volume = 0.5;
  
  // Load sound effects
  function loadSoundEffect(src, volume = 0.3) {
    const audio = new Audio();
    audio.src = src;
    audio.volume = volume;
    audio.preload = 'auto';
    return audio;
  }
  
  // Initialize sound effects with Web Audio API fallback
  function createToneSound(frequency, duration, type = 'sine') {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    
    return { oscillator, gainNode, audioContext };
  }
  
  // Create synthetic sound effects
  function createEngineSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    
    return { oscillator, gainNode, audioContext };
  }
  
  // Play sound effect function using Web Audio API
  function playSound(soundType, volume = 1.0) {
    console.log('playSound called:', soundType, 'soundEnabled:', soundEnabled, 'userInteracted:', userInteracted);
    if (soundEnabled && userInteracted) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different sounds based on type
        if (soundType === 'engine') {
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(80 + Math.random() * 20, audioContext.currentTime);
          gainNode.gain.setValueAtTime(volume * 0.1, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
        } else if (soundType === 'brake') {
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
          gainNode.gain.setValueAtTime(volume * 0.2, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
        } else if (soundType === 'success') {
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
        } else if (soundType === 'failure') {
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
          gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
        } else if (soundType === 'collision') {
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
          gainNode.gain.setValueAtTime(volume * 0.4, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
        } else if (soundType === 'parking') {
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
          gainNode.gain.setValueAtTime(volume * 0.2, audioContext.currentTime);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
        }
        
        console.log('Sound played successfully:', soundType);
      } catch (e) {
        console.log('Sound error:', e);
      }
    } else {
      console.log('Sound blocked - soundEnabled:', soundEnabled, 'userInteracted:', userInteracted);
    }
  }
  music.preload = 'auto';
  
  music.addEventListener('canplaythrough', () => {
    backgroundMusic = music;
    console.log('Background music loaded successfully');
    
    // Try to preload audio context for better compatibility
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        console.log('Audio context suspended, will resume on user interaction');
      }
    } catch (e) {
      console.log('Audio context not supported:', e);
    }
  });
  
  music.addEventListener('error', (e) => {
    console.log('Background music not found:', e);
  });
  
  // Enable audio after user interaction
  function enableAudio() {
    if (!userInteracted) {
      userInteracted = true;
      console.log('Audio enabled by user interaction');
      
      // Resume audio context if suspended
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('Audio context resumed');
          }).catch(e => {
            console.log('Audio context resume failed:', e);
          });
        }
      } catch (e) {
        console.log('Audio context not supported:', e);
      }
      
      // Try to play background music if available
      if (backgroundMusic) {
        try {
          backgroundMusic.play().then(() => {
            musicPlaying = true;
            const musicToggle = document.getElementById('music-toggle');
            if (musicToggle) {
              musicToggle.textContent = '🔊 播放中';
              musicToggle.classList.add('playing');
            }
            console.log('Background music started playing');
          }).catch(e => {
            console.log('Background music play failed:', e);
          });
        } catch (e) {
          console.log('Background music not supported:', e);
        }
      }
    }
  }

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    enableAudio(); // Enable audio on first key press
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });
  
  // Enable audio on any user interaction
  document.addEventListener('click', enableAudio);
  document.addEventListener('touchstart', enableAudio);

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // FPV steering state
  let steeringAngle = 0; // radians
  let steeringTarget = 0; // radians
  const maxSteer = Math.PI / 4; // 45deg visual
  
  // FPV pedal animations
  let gasPedalPos = 0; // 0-1
  let brakePedalPos = 0; // 0-1
  let reverseGearActive = false;

  // Car physics parameters
  const carParams = {
    width: 50,
    height: 28,
    maxSpeed: 4.0,
    accel: 0.15,
    brake: 0.3,
    friction: 0.04,
    turnRate: 0.045,
  };

  /** @typedef {{x:number,y:number,w:number,h:number,angle:number,v:number}} Car */
  /** @type {Car} */
  const car = {
    x: scene.width * 0.15,
    y: scene.height * 0.5,
    w: carParams.width,
    h: carParams.height,
    angle: 0,
    v: 0,
  };

  // Five parking spots configuration for each level
  /** @typedef {{x:number,y:number,w:number,h:number,angle:number}} Spot */
  /** @type {Spot[]} */
  let spots = [];
  let level = 1;
  let targetSpotIndex = -1; // which spot is the target for this level

  // Level state
  let levelTime = 0; // seconds
  let levelMaxTime = 60; // rule: 60s per level
  let hitCount = 0;
  let settled = false; // whether settlement overlay is showing

  function showOverlay(title, desc, scoreInfo) {
    ov.title.textContent = title;
    ov.desc.textContent = desc;
    ov.time.textContent = `${levelTime.toFixed(1)}s`;
    ov.hit.textContent = `${hitCount}`;
    if (scoreInfo) {
      ov.score.textContent = `${scoreInfo.score}`;
      ov.grade.textContent = `${scoreInfo.grade}`;
      ov.score.className = `value ${scoreInfo.score >= 90 ? 'good' : ''}`.trim();
      ov.grade.className = `value ${scoreInfo.grade === 'S' || scoreInfo.grade === 'A' ? 'good' : (scoreInfo.grade === 'D' ? 'bad' : '')}`.trim();
    } else {
      ov.score.textContent = '-';
      ov.grade.textContent = '-';
      ov.score.className = 'value';
      ov.grade.className = 'value';
    }
    ov.root.classList.add('show');
    settled = true;
  }
  function computeScore(spot) {
    // Components:
    // - Time: faster is better (0..60s) -> up to 60 pts
    // - Collisions: penalty -10 each, min 0
    // - Accuracy: angle diff and center offset -> up to 40 pts
    const timeLeft = Math.max(0, levelMaxTime - levelTime);
    const timeScore = Math.round((timeLeft / levelMaxTime) * 60);
    const angleDiff = Math.abs(Math.atan2(Math.sin(car.angle - spot.angle), Math.cos(car.angle - spot.angle)));
    const angleScore = Math.max(0, 1 - angleDiff / 0.25) * 20; // 0 rad diff => 20
    const dx = car.x - spot.x, dy = car.y - spot.y;
    const dist = Math.min(Math.hypot(dx, dy), 80);
    const posScore = (1 - dist / 80) * 20; // center => 20
    const accuracyScore = Math.round(angleScore + posScore);
    const collisionPenalty = Math.min(hitCount * 10, 60);
    const raw = Math.max(0, Math.min(100, timeScore + accuracyScore - collisionPenalty));
    let grade = 'C';
    if (raw >= 95) grade = 'S';
    else if (raw >= 85) grade = 'A';
    else if (raw >= 70) grade = 'B';
    else if (raw >= 60) grade = 'C';
    else grade = 'D';
    return { score: raw, grade };
  }

  function hideOverlay() {
    ov.root.classList.remove('show');
    settled = false;
  }

  // Monsters (moving obstacles)
  /** @typedef {{x:number,y:number,w:number,h:number,angle:number,vx:number,vy:number,targetX:number,targetY:number,patrolTimer:number,color:string}} Monster */
  /** @type {Monster[]} */
  let monsters = [];
  let rngSeed = 123456789;
  function rand01() {
    // Deterministic RNG (LCG) per level
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
    return rngSeed / 0xFFFFFFFF;
  }

  function resetLevel(lv = level) {
    level = lv;
    uiLevel.textContent = `关卡: ${level}`;
    uiStatus.textContent = '准备开始';
    hideOverlay();
    levelTime = 0;
    hitCount = 0;
    // Randomly select target spot
    targetSpotIndex = Math.floor(rand01() * 5);
    // Reset car
    car.x = scene.width * 0.12;
    car.y = scene.height * 0.5;
    car.angle = 0;
    car.v = 0;
    // Generate 5 spots across the right side
    const baseX = scene.width - 280;
    const baseY = 120;
    const gapY = 100;
    spots = new Array(5).fill(0).map((_, i) => ({
      x: baseX + (i % 2 === 0 ? 0 : 70 * Math.sin(level)),
      y: baseY + i * gapY,
      w: 70,
      h: 36,
      angle: (i % 2 === 0 ? 0 : 0.2) * Math.sin(level * 0.7),
    }));

    // Generate moving monsters (scales with level)
    rngSeed = (level * 12345 + 6789) >>> 0;
    monsters = [];
    // Monster count increases with level: 3-5 at level 1, up to 8-12 at higher levels
    const baseMonsters = 3;
    const levelBonus = Math.min(level - 1, 7); // cap at +7 for level 8+
    const randomBonus = Math.floor(rand01() * 3); // 0-2 random
    const monsterCount = baseMonsters + levelBonus + randomBonus;
    let attempts = 0;
    while (monsters.length < monsterCount && attempts < 200) {
      attempts++;
      const mx = 250 + rand01() * 600; // avoid edges
      const my = 120 + rand01() * 480;
      const w = 40 + rand01() * 30;
      const h = 40 + rand01() * 30;
      const candidate = { 
        x: mx, y: my, w, h, angle: 0,
        vx: 0, vy: 0,
        targetX: mx, targetY: my,
        patrolTimer: 0,
        color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'][Math.floor(rand01() * 5)]
      };
      const carRect = { x: car.x, y: car.y, w: car.w, h: car.h, angle: car.angle };
      if (rectOverlap(carRect, candidate)) continue;
      // Avoid overlapping existing monsters
      const overlapsExisting = monsters.some(m => rectOverlap(m, candidate));
      if (overlapsExisting) continue;
      // Avoid parking spots
      const overlapsSpot = spots.some(s => rectOverlap({ x: s.x, y: s.y, w: s.w + 15, h: s.h + 15, angle: s.angle }, candidate));
      if (overlapsSpot) continue;
      monsters.push(candidate);
    }
  }

  resetLevel(1);

  function getRectCorners(cx, cy, w, h, angle) {
    const hw = w / 2, hh = h / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    return [
      { x: cx + (-hw) * c - (-hh) * s, y: cy + (-hw) * s + (-hh) * c },
      { x: cx + ( hw) * c - (-hh) * s, y: cy + ( hw) * s + (-hh) * c },
      { x: cx + ( hw) * c - ( hh) * s, y: cy + ( hw) * s + ( hh) * c },
      { x: cx + (-hw) * c - ( hh) * s, y: cy + (-hw) * s + ( hh) * c },
    ];
  }

  function pointInRotatedRect(px, py, rx, ry, rw, rh, rAngle) {
    const c = Math.cos(-rAngle), s = Math.sin(-rAngle);
    const dx = px - rx, dy = py - ry;
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    return Math.abs(lx) <= rw / 2 && Math.abs(ly) <= rh / 2;
  }

  function rectOverlap(r1, r2) {
    // SAT lite by sampling corners
    const a = getRectCorners(r1.x, r1.y, r1.w, r1.h, r1.angle);
    const b = getRectCorners(r2.x, r2.y, r2.w, r2.h, r2.angle);
    for (const p of a) if (pointInRotatedRect(p.x, p.y, r2.x, r2.y, r2.w, r2.h, r2.angle)) return true;
    for (const p of b) if (pointInRotatedRect(p.x, p.y, r1.x, r1.y, r1.w, r1.h, r1.angle)) return true;
    return false;
  }

  function update(dt) {
    if (settled) {
      // Allow keyboard shortcuts while overlay is open
      if (keys.has('enter') || keys.has('n')) {
        resetLevel(level + 1);
      } else if (keys.has('r')) {
        resetLevel(level);
      }
      return;
    }

    // Input
    const up = keys.has('arrowup') || keys.has('w');
    const down = keys.has('arrowdown') || keys.has('s');
    const left = keys.has('arrowleft') || keys.has('a');
    const right = keys.has('arrowright') || keys.has('d');
    const brake = keys.has(' ');
    const reset = keys.has('r');

    if (reset) resetLevel(1);

    // Update FPV steering target
    steeringTarget = 0;
    if (left && !right) steeringTarget = -maxSteer;
    else if (right && !left) steeringTarget = maxSteer;
    // Ease steering angle toward target
    steeringAngle = lerp(steeringAngle, steeringTarget, clamp(10 * dt, 0, 1));
    
    // 更新方向盘显示
    if (steeringWheelDisplay) {
      const angleDegrees = (steeringAngle * 180 / Math.PI).toFixed(1);
      steeringWheelDisplay.style.transform = `rotate(${angleDegrees}deg)`;
      steeringWheelDisplay.setAttribute('aria-valuenow', Math.round(angleDegrees));
    }
    
    if (steeringAngleDisplay) {
      const angleDegrees = (steeringAngle * 180 / Math.PI).toFixed(1);
      steeringAngleDisplay.textContent = `${angleDegrees}°`;
    }
    
    // 更新车辆状态显示
    if (speedDisplay) {
      const speedKmh = Math.abs(car.v * 10).toFixed(1);
      speedDisplay.textContent = `${speedKmh} km/h`;
    }
    
    if (gearDisplay) {
      gearDisplay.textContent = reverseGearActive ? 'R' : 'D';
      gearDisplay.className = 'status-value';
      if (reverseGearActive) {
        gearDisplay.classList.add('reverse');
      }
    }
    
    if (directionDisplay) {
      if (Math.abs(car.v) < 0.1) {
        directionDisplay.textContent = '静止';
        directionDisplay.className = 'status-value';
      } else if (car.v > 0) {
        directionDisplay.textContent = '前进';
        directionDisplay.className = 'status-value forward';
      } else {
        directionDisplay.textContent = '倒车';
        directionDisplay.className = 'status-value reverse';
      }
      
      // 检查是否在刹车
      if (keys[' '] && Math.abs(car.v) > 0.1) {
        directionDisplay.textContent = '刹车';
        directionDisplay.className = 'status-value braking';
      }
    }
    
    // Update FPV pedal animations
    const isAccelerating = up && !down;
    const isBraking = brake;
    const isReversing = down && !up;
    
    // Gas pedal animation
    if (isAccelerating) {
      gasPedalPos = Math.min(1, gasPedalPos + 8 * dt);
      // 引擎音效 - 节流控制
      const now = Date.now();
      if (now - lastEngineSound > soundThrottle) {
        playSound('engine', 0.2 + Math.abs(car.v) * 0.1);
        lastEngineSound = now;
      }
    } else {
      gasPedalPos = Math.max(0, gasPedalPos - 5 * dt);
    }
    
    // Brake pedal animation
    if (isBraking) {
      brakePedalPos = Math.min(1, brakePedalPos + 10 * dt);
      // 刹车音效 - 节流控制
      const now = Date.now();
      if (now - lastBrakeSound > soundThrottle) {
        playSound('brake', 0.3);
        lastBrakeSound = now;
      }
    } else {
      brakePedalPos = Math.max(0, brakePedalPos - 6 * dt);
    }
    
    // Reverse gear indicator
    reverseGearActive = isReversing;

    // Timer rule
    levelTime += dt;
    if (levelTime >= levelMaxTime) {
      showOverlay('超时失败', '用时超过 60 秒');
      return;
    }

    // Update monsters
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      m.patrolTimer += dt;
      
      // Choose new target every 2-4 seconds
      if (m.patrolTimer > 2 + rand01() * 2) {
        m.targetX = 250 + rand01() * 600;
        m.targetY = 120 + rand01() * 480;
        m.patrolTimer = 0;
      }
      
      // Move toward target
      const dx = m.targetX - m.x;
      const dy = m.targetY - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        // Speed increases with level (more challenging)
        const baseSpeed = 30 + rand01() * 20;
        const levelSpeedBonus = Math.min(level * 2, 20); // +2 per level, max +20
        const speed = baseSpeed + levelSpeedBonus;
        
        m.vx = (dx / dist) * speed * dt;
        m.vy = (dy / dist) * speed * dt;
        m.x += m.vx;
        m.y += m.vy;
        m.angle = Math.atan2(dy, dx);
      }
      
      // Keep monsters in bounds
      m.x = clamp(m.x, 80, scene.width - 80);
      m.y = clamp(m.y, 80, scene.height - 80);
    }

    // Acceleration
    if (up) car.v += carParams.accel;
    if (down) car.v -= carParams.accel * 0.9;
    if (brake) {
      if (Math.abs(car.v) < carParams.brake) car.v = 0; else car.v -= Math.sign(car.v) * carParams.brake;
    }

    // Clamp & friction
    car.v = clamp(car.v, -carParams.maxSpeed, carParams.maxSpeed);
    if (!up && !down && !brake) {
      if (Math.abs(car.v) < carParams.friction) car.v = 0; else car.v -= Math.sign(car.v) * carParams.friction;
    }

    // Rotation depends on speed
    const speedFactor = clamp(Math.abs(car.v) / carParams.maxSpeed, 0, 1);
    if (left) car.angle -= carParams.turnRate * speedFactor * (car.v >= 0 ? 1 : -1);
    if (right) car.angle += carParams.turnRate * speedFactor * (car.v >= 0 ? 1 : -1);

    // Integrate position
    const moveDx = Math.cos(car.angle) * car.v * 60 * dt * 0.6;
    const moveDy = Math.sin(car.angle) * car.v * 60 * dt * 0.6;
    const prevX = car.x, prevY = car.y;
    car.x += moveDx;
    car.y += moveDy;

    // Wall collisions (axis-aligned bounds)
    const halfW = car.w / 2, halfH = car.h / 2;
    const minX = scene.wallPadding + halfW, maxX = scene.width - scene.wallPadding - halfW;
    const minY = scene.wallPadding + halfH, maxY = scene.height - scene.wallPadding - halfH;
    if (car.x < minX) { car.x = minX; car.v = 0; }
    if (car.x > maxX) { car.x = maxX; car.v = 0; }
    if (car.y < minY) { car.y = minY; car.v = 0; }
    if (car.y > maxY) { car.y = maxY; car.v = 0; }

    // Monster collisions: if overlap, revert to previous position and stop
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      const carRect = { x: car.x, y: car.y, w: car.w, h: car.h, angle: car.angle };
      if (rectOverlap(carRect, m)) {
        const impactSpeed = Math.abs(car.v);
        car.x = prevX;
        car.y = prevY;
        car.v = 0;
        hitCount++;
        // 碰撞音效
        playSound('collision', 0.6);
        if (impactSpeed > 2.0) {
          showOverlay('碰撞失败', '撞击过重');
          playSound('failure', 0.8);
          return;
        }
        break;
      }
    }

    // Parking detection: only the target spot counts
    let parkedIndex = -1;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const carRect = { x: car.x, y: car.y, w: car.w, h: car.h, angle: car.angle };
      const spotRect = { x: s.x, y: s.y, w: s.w, h: s.h, angle: s.angle };
      if (rectOverlap(carRect, spotRect)) {
        // Check angle and speed
        const angleDiff = Math.abs(Math.atan2(Math.sin(car.angle - s.angle), Math.cos(car.angle - s.angle)));
        const slowEnough = Math.abs(car.v) < 0.15;
        if (angleDiff < 0.25 && slowEnough) {
          if (i === targetSpotIndex) {
            parkedIndex = i;
            break;
          }
          // Wrong spot - show feedback but don't succeed
          uiStatus.textContent = `错误车位！目标：车位 ${targetSpotIndex + 1}`;
          return;
        }
      }
    }

    if (parkedIndex >= 0) {
      uiStatus.textContent = `目标车位 ${parkedIndex + 1} 入库成功！`;
      // 停车成功音效
      playSound('parking', 0.5);
      playSound('success', 0.8);
      const scoreInfo = computeScore(spots[parkedIndex]);
      showOverlay('入库成功', '做得好！按 继续 进入下一关', scoreInfo);
    } else {
      uiStatus.textContent = `目标：车位 ${targetSpotIndex + 1} | 怪兽：${monsters.length} | 剩余 ${(levelMaxTime - levelTime).toFixed(1)}s`;
    }
    
    // 更新移动端状态
    updateMobileStatus();
  }

  function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('Drawing on canvas:', canvas.id, 'Size:', canvas.width, 'x', canvas.height);

    // Draw background
    if (backgroundImage) {
      // Scale background to fit canvas while maintaining aspect ratio
      const canvasAspect = canvas.width / canvas.height;
      const imageAspect = backgroundImage.width / backgroundImage.height;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (canvasAspect > imageAspect) {
        // Canvas is wider, fit to height
        drawHeight = canvas.height;
        drawWidth = drawHeight * imageAspect;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
      } else {
        // Canvas is taller, fit to width
        drawWidth = canvas.width;
        drawHeight = drawWidth / imageAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      }
      
      ctx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Default background
      ctx.fillStyle = '#1a1d24';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Scene boundaries
    ctx.save();
    ctx.strokeStyle = '#2a3140';
    ctx.lineWidth = 4;
    ctx.strokeRect(scene.wallPadding, scene.wallPadding, scene.width - scene.wallPadding * 2, scene.height - scene.wallPadding * 2);
    ctx.restore();

    // Draw FPV steering wheel and controls
    // FPV is now handled by HTML/CSS steering wheel component

    // Monsters
    for (let i = 0; i < monsters.length; i++) {
      const m = monsters[i];
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      
      // Monster body
      ctx.fillStyle = m.color;
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.w/2, m.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-m.w/4, -m.h/4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.w/4, -m.h/4, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-m.w/4, -m.h/4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.w/4, -m.h/4, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Mouth
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, m.h/6, m.w/3, 0, Math.PI);
      ctx.stroke();
      
      ctx.restore();
    }

    // Spots
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      // Highlight target spot
      const isTarget = i === targetSpotIndex;
      ctx.fillStyle = isTarget ? 'rgba(20,40,30,0.8)' : 'rgba(20,40,30,0.4)';
      ctx.strokeStyle = isTarget ? '#00ff88' : '#2a5a3a';
      ctx.lineWidth = isTarget ? 6 : 3;
      ctx.beginPath();
      ctx.rect(-s.w/2, -s.h/2, s.w, s.h);
      ctx.fill();
      ctx.stroke();
      // Target indicator
      if (isTarget) {
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText('目标', 0, -s.h/2 - 8);
        ctx.fillText('目标', 0, -s.h/2 - 8);
      }
      ctx.restore();
    }

    // Car
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Body
    ctx.fillStyle = '#e86d6d';
    ctx.strokeStyle = '#e2c1c1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-car.w/2, -car.h/2, car.w, car.h);
    ctx.fill();
    ctx.stroke();
    // Front indicator
    ctx.fillStyle = '#fff';
    ctx.fillRect(car.w/2 - 4, -4, 8, 8);
    ctx.restore();

    // Wheels (simple)
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = '#1c222b';
    const wheelW = 10, wheelH = 4;
    ctx.fillRect(-car.w/2 + 4, -car.h/2 - 4, wheelW, wheelH);
    ctx.fillRect(car.w/2 - wheelW - 4, -car.h/2 - 4, wheelW, wheelH);
    ctx.fillRect(-car.w/2 + 4, car.h/2 + 0, wheelW, wheelH);
    ctx.fillRect(car.w/2 - wheelW - 4, car.h/2 + 0, wheelW, wheelH);
    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  
  // Music controls
  const musicToggle = document.getElementById('music-toggle');
  const volumeSlider = document.getElementById('volume-slider');
  const soundToggle = document.getElementById('sound-toggle');
  const testSound = document.getElementById('test-sound');

  // 移动端触摸控制
  let mobileSteeringActive = false;
  let mobileSteeringStartX = 0;
  let mobileSteeringCurrentX = 0;
  
  musicToggle.addEventListener('click', () => {
    enableAudio(); // Ensure audio is enabled
    if (backgroundMusic) {
      if (musicPlaying) {
        backgroundMusic.pause();
        musicToggle.textContent = '🎵 音乐';
        musicToggle.classList.remove('playing');
        musicPlaying = false;
      } else {
        backgroundMusic.play().then(() => {
          musicToggle.textContent = '🔊 播放中';
          musicToggle.classList.add('playing');
          musicPlaying = true;
          console.log('Background music started successfully');
        }).catch(e => {
          console.log('Music play failed:', e);
          musicToggle.textContent = '❌ 播放失败';
          // Try to reset and play again
          setTimeout(() => {
            if (backgroundMusic) {
              backgroundMusic.currentTime = 0;
              backgroundMusic.play().then(() => {
                musicToggle.textContent = '🔊 播放中';
                musicToggle.classList.add('playing');
                musicPlaying = true;
                console.log('Background music started after retry');
              }).catch(e2 => {
                console.log('Music play retry failed:', e2);
              });
            }
          }, 100);
        });
      }
    } else {
      musicToggle.textContent = '❌ 音乐未加载';
    }
  });
  
  volumeSlider.addEventListener('input', (e) => {
    if (backgroundMusic) {
      backgroundMusic.volume = e.target.value / 100;
    }
  });
  
  // Sound effects toggle
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      soundToggle.textContent = '🔊 音效';
      soundToggle.classList.remove('muted');
    } else {
      soundToggle.textContent = '🔇 音效';
      soundToggle.classList.add('muted');
    }
  });
  
  // Test sound button
  testSound.addEventListener('click', () => {
    enableAudio(); // Ensure audio is enabled
    console.log('Testing sound - soundEnabled:', soundEnabled, 'userInteracted:', userInteracted);
    
    // Test different sounds
    playSound('success', 0.5);
    setTimeout(() => playSound('engine', 0.3), 200);
    setTimeout(() => playSound('brake', 0.3), 400);
    setTimeout(() => playSound('collision', 0.3), 600);
  });
  
  // Overlay buttons
  ov.next.addEventListener('click', () => resetLevel(level + 1));
  ov.retry.addEventListener('click', () => resetLevel(level));

  // 方向盘显示元素
  const steeringWheelDisplay = document.getElementById('steering-wheel-display');
  const steeringAngleDisplay = document.getElementById('steering-angle-display');
  
  // 车辆状态显示元素
  const speedDisplay = document.getElementById('speed-display');
  const gearDisplay = document.getElementById('gear-display');
  const directionDisplay = document.getElementById('direction-display');
  
  // 方向盘拖拽状态
  let isDragging = false;
  let lastPointerAngle = 0;
  
  // 方向盘拖拽功能
  if (steeringWheelDisplay) {
    steeringWheelDisplay.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isDragging = true;
      steeringWheelDisplay.classList.add('dragging');
      lastPointerAngle = getPointerAngle(e);
    });
    
    document.addEventListener('pointermove', (e) => {
      if (isDragging) {
        e.preventDefault();
        const currentAngle = getPointerAngle(e);
        const delta = shortestAngleDelta(currentAngle, lastPointerAngle);
        lastPointerAngle = currentAngle;
        
        const newAngle = steeringAngle + delta * Math.PI / 180;
        steeringAngle = Math.max(-Math.PI/2, Math.min(Math.PI/2, newAngle));
        steeringTarget = steeringAngle;
      }
    });
    
    document.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        steeringWheelDisplay.classList.remove('dragging');
      }
    });
  }
  
  function getPointerAngle(e) {
    const rect = steeringWheelDisplay.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = e.clientX - centerX;
    const y = e.clientY - centerY;
    return Math.atan2(y, x) * 180 / Math.PI;
  }
  
  function shortestAngleDelta(current, previous) {
    let delta = current - previous;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }
  
  // 移动端触摸控制事件
  const steeringWheel = document.getElementById('steering-wheel');
  const gasPedal = document.getElementById('gas-pedal');
  const brakePedal = document.getElementById('brake-pedal');
  const reversePedal = document.getElementById('reverse-pedal');

  // 方向盘触摸控制
  if (steeringWheel) {
    steeringWheel.addEventListener('touchstart', (e) => {
      e.preventDefault();
      mobileSteeringActive = true;
      const touch = e.touches[0];
      mobileSteeringStartX = touch.clientX;
      mobileSteeringCurrentX = touch.clientX;
    });

    steeringWheel.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (mobileSteeringActive) {
        const touch = e.touches[0];
        mobileSteeringCurrentX = touch.clientX;
        const deltaX = mobileSteeringCurrentX - mobileSteeringStartX;
        const maxDelta = 50; // 最大转向范围
        const steeringRatio = Math.max(-1, Math.min(1, deltaX / maxDelta));
        
        // 更新方向盘角度
        steeringTarget = steeringRatio * maxSteer;
      }
    });

    steeringWheel.addEventListener('touchend', (e) => {
      e.preventDefault();
      mobileSteeringActive = false;
      steeringTarget = 0; // 松开时回正
    });
  }

  // 油门踏板
  if (gasPedal) {
    gasPedal.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keys.ArrowUp = true;
      keys.w = true;
    });
    gasPedal.addEventListener('touchend', (e) => {
      e.preventDefault();
      keys.ArrowUp = false;
      keys.w = false;
    });
  }

  // 刹车踏板
  if (brakePedal) {
    brakePedal.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keys[' '] = true;
    });
    brakePedal.addEventListener('touchend', (e) => {
      e.preventDefault();
      keys[' '] = false;
    });
  }

  // 倒车踏板
  if (reversePedal) {
    reversePedal.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keys.ArrowDown = true;
      keys.s = true;
    });
    reversePedal.addEventListener('touchend', (e) => {
      e.preventDefault();
      keys.ArrowDown = false;
      keys.s = false;
    });
  }
  
  // 移动端交互逻辑
  function initMobileControls() {
    // 移动端设置抽屉
    const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
    const mobileSettingsDrawer = document.getElementById('mobile-settings-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerClose = document.getElementById('drawer-close');
    
    if (mobileSettingsBtn && mobileSettingsDrawer) {
      mobileSettingsBtn.addEventListener('click', () => {
        mobileSettingsDrawer.classList.add('show');
      });
      
      drawerOverlay.addEventListener('click', () => {
        mobileSettingsDrawer.classList.remove('show');
      });
      
      drawerClose.addEventListener('click', () => {
        mobileSettingsDrawer.classList.remove('show');
      });
    }
    
    // 移动端音频控制同步
    const mobileMusicToggle = document.getElementById('mobile-music-toggle');
    const mobileSoundToggle = document.getElementById('mobile-sound-toggle');
    const mobileTestSound = document.getElementById('mobile-test-sound');
    const mobileVolumeSlider = document.getElementById('mobile-volume-slider');
    
    if (mobileMusicToggle) {
      mobileMusicToggle.addEventListener('click', () => {
        toggleMusic();
        updateMusicButton(mobileMusicToggle);
      });
    }
    
    if (mobileSoundToggle) {
      mobileSoundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        updateSoundButton(mobileSoundToggle);
      });
    }
    
    if (mobileTestSound) {
      mobileTestSound.addEventListener('click', () => {
        enableAudio();
        playSound('success', 0.8);
        setTimeout(() => playSound('engine', 0.3), 200);
        setTimeout(() => playSound('brake', 0.4), 400);
        setTimeout(() => playSound('collision', 0.6), 600);
      });
    }
    
    if (mobileVolumeSlider) {
      mobileVolumeSlider.addEventListener('input', (e) => {
        if (backgroundMusic) {
          backgroundMusic.volume = e.target.value / 100;
        }
      });
    }
    
    // 移动端方向盘
    const mobileSteeringWheel = document.getElementById('mobile-steering-wheel');
    if (mobileSteeringWheel) {
      let isDragging = false;
      let lastPointerAngle = 0;
      
      mobileSteeringWheel.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDragging = true;
        lastPointerAngle = getPointerAngle(e);
        mobileSteeringWheel.setPointerCapture(e.pointerId);
      });
      
      mobileSteeringWheel.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const currentAngle = getPointerAngle(e);
        const delta = shortestAngleDelta(currentAngle, lastPointerAngle);
        steeringTarget += delta * 0.01;
        steeringTarget = Math.max(-Math.PI/4, Math.min(Math.PI/4, steeringTarget));
        lastPointerAngle = currentAngle;
      });
      
      mobileSteeringWheel.addEventListener('pointerup', (e) => {
        isDragging = false;
        mobileSteeringWheel.releasePointerCapture(e.pointerId);
      });
    }
    
    // 移动端踏板
    const mobileGasPedal = document.getElementById('mobile-gas-pedal');
    const mobileBrakePedal = document.getElementById('mobile-brake-pedal');
    const mobileReversePedal = document.getElementById('mobile-reverse-pedal');
    
    if (mobileGasPedal) {
      mobileGasPedal.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.ArrowUp = true;
        keys.w = true;
        keys.W = true;
      });
      
      mobileGasPedal.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.ArrowUp = false;
        keys.w = false;
        keys.W = false;
      });
    }
    
    if (mobileBrakePedal) {
      mobileBrakePedal.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[' '] = true;
      });
      
      mobileBrakePedal.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[' '] = false;
      });
    }
    
    if (mobileReversePedal) {
      mobileReversePedal.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.ArrowDown = true;
        keys.s = true;
        keys.S = true;
      });
      
      mobileReversePedal.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.ArrowDown = false;
        keys.s = false;
        keys.S = false;
      });
    }
  }
  
  // 移动端状态同步
  function updateMobileStatus() {
    const mobileSpeedDisplay = document.getElementById('mobile-speed-display');
    const mobileGearDisplay = document.getElementById('mobile-gear-display');
    const mobileDirectionDisplay = document.getElementById('mobile-direction-display');
    const mobileLevel = document.getElementById('mobile-level');
    const mobileStatus = document.getElementById('mobile-status');
    
    if (mobileSpeedDisplay) {
      mobileSpeedDisplay.textContent = `${(Math.abs(car.v) * 3.6).toFixed(1)} km/h`;
    }
    
    if (mobileGearDisplay) {
      mobileGearDisplay.textContent = car.v < 0 ? 'R' : 'D';
      mobileGearDisplay.className = car.v < 0 ? 'status-value reverse' : 'status-value';
    }
    
    if (mobileDirectionDisplay) {
      let direction = '静止';
      let className = 'status-value';
      
      if (Math.abs(car.v) > 0.1) {
        if (car.v > 0) {
          direction = '前进';
          className = 'status-value forward';
        } else {
          direction = '倒车';
          className = 'status-value reverse';
        }
      } else if (keys[' ']) {
        direction = '刹车';
        className = 'status-value braking';
      }
      
      mobileDirectionDisplay.textContent = direction;
      mobileDirectionDisplay.className = className;
    }
    
    if (mobileLevel) {
      mobileLevel.textContent = `关卡: ${level}`;
    }
    
    if (mobileStatus) {
      mobileStatus.textContent = uiStatus ? uiStatus.textContent : '准备开始';
    }
  }
  
  // 初始化移动端控制
  initMobileControls();
})();


