(() => {
  'use strict';

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  /** @type {HTMLCanvasElement} */
  const fpvCanvas = document.getElementById('fpv');
  const fpv = fpvCanvas ? fpvCanvas.getContext('2d') : null;

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
  
  // Load background music
  const music = new Audio();
  music.src = './assets/parking.mp3';
  music.loop = true;
  music.volume = 0.5;
  music.preload = 'auto';
  
  music.addEventListener('canplaythrough', () => {
    backgroundMusic = music;
    console.log('Background music loaded successfully');
  });
  
  music.addEventListener('error', (e) => {
    console.log('Background music not found:', e);
  });
  
  // Enable audio after user interaction
  function enableAudio() {
    if (!userInteracted && backgroundMusic) {
      userInteracted = true;
      try {
        backgroundMusic.play().then(() => {
          musicPlaying = true;
          const musicToggle = document.getElementById('music-toggle');
          if (musicToggle) {
            musicToggle.textContent = '🔊 播放中';
            musicToggle.classList.add('playing');
          }
        }).catch(e => {
          console.log('Audio play failed:', e);
        });
      } catch (e) {
        console.log('Audio not supported');
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
    
    // Update FPV pedal animations
    const isAccelerating = up && !down;
    const isBraking = brake;
    const isReversing = down && !up;
    
    // Gas pedal animation
    if (isAccelerating) {
      gasPedalPos = Math.min(1, gasPedalPos + 8 * dt);
    } else {
      gasPedalPos = Math.max(0, gasPedalPos - 5 * dt);
    }
    
    // Brake pedal animation
    if (isBraking) {
      brakePedalPos = Math.min(1, brakePedalPos + 10 * dt);
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
        if (impactSpeed > 2.0) {
          showOverlay('碰撞失败', '撞击过重');
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
      const scoreInfo = computeScore(spots[parkedIndex]);
      showOverlay('入库成功', '做得好！按 继续 进入下一关', scoreInfo);
    } else {
      uiStatus.textContent = `目标：车位 ${targetSpotIndex + 1} | 怪兽：${monsters.length} | 剩余 ${(levelMaxTime - levelTime).toFixed(1)}s`;
    }
  }

  function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    if (fpv) {
      const w = fpvCanvas.width, h = fpvCanvas.height;
      fpv.clearRect(0, 0, w, h);
      
      // Background
      fpv.fillStyle = '#f8f9fa';
      fpv.fillRect(0, 0, w, h);
      
      // Dashboard background
      fpv.fillStyle = '#e9ecef';
      fpv.fillRect(10, 10, w - 20, h - 20);
      
      // Steering wheel
      fpv.save();
      fpv.translate(w / 2, h / 2 - 20);
      // Wheel shadow
      fpv.beginPath();
      fpv.arc(0, 0, 80, 0, Math.PI * 2);
      fpv.fillStyle = '#dee2e6';
      fpv.fill();
      // Outer wheel ring
      fpv.lineWidth = 18;
      fpv.strokeStyle = '#495057';
      fpv.beginPath();
      fpv.arc(0, 0, 70, 0, Math.PI * 2);
      fpv.stroke();
      // Rotate by steering angle
      fpv.rotate(steeringAngle);
      // Spokes
      fpv.lineWidth = 8;
      fpv.strokeStyle = '#6c757d';
      for (let i = 0; i < 3; i++) {
        fpv.save();
        fpv.rotate((i * Math.PI * 2) / 3);
        fpv.beginPath();
        fpv.moveTo(0, 0);
        fpv.lineTo(0, -50);
        fpv.stroke();
        fpv.restore();
      }
      // Center hub
      fpv.fillStyle = '#343a40';
      fpv.beginPath();
      fpv.arc(0, 0, 20, 0, Math.PI * 2);
      fpv.fill();
      fpv.restore();
      
      // Pedals section
      const pedalY = h - 60;
      const pedalW = 30;
      const pedalH = 40;
      
      // Gas pedal (right)
      const gasX = w - 50;
      const gasPressed = gasPedalPos * 8;
      fpv.fillStyle = gasPedalPos > 0.1 ? '#28a745' : '#6c757d';
      fpv.fillRect(gasX, pedalY + gasPressed, pedalW, pedalH);
      fpv.strokeStyle = '#495057';
      fpv.lineWidth = 2;
      fpv.strokeRect(gasX, pedalY + gasPressed, pedalW, pedalH);
      // Gas pedal label
      fpv.fillStyle = '#000000';
      fpv.font = '10px sans-serif';
      fpv.textAlign = 'center';
      fpv.fillText('油门', gasX + pedalW/2, pedalY - 5);
      
      // Brake pedal (left)
      const brakeX = 50;
      const brakePressed = brakePedalPos * 8;
      fpv.fillStyle = brakePedalPos > 0.1 ? '#dc3545' : '#6c757d';
      fpv.fillRect(brakeX, pedalY + brakePressed, pedalW, pedalH);
      fpv.strokeStyle = '#495057';
      fpv.lineWidth = 2;
      fpv.strokeRect(brakeX, pedalY + brakePressed, pedalW, pedalH);
      // Brake pedal label
      fpv.fillStyle = '#000000';
      fpv.font = '10px sans-serif';
      fpv.textAlign = 'center';
      fpv.fillText('刹车', brakeX + pedalW/2, pedalY - 5);
      
      // Gear indicator
      const gearX = w / 2 - 25;
      const gearY = h - 80;
      fpv.fillStyle = reverseGearActive ? '#ffc107' : '#6c757d';
      fpv.fillRect(gearX, gearY, 50, 30);
      fpv.strokeStyle = '#495057';
      fpv.lineWidth = 2;
      fpv.strokeRect(gearX, gearY, 50, 30);
      // Gear text
      fpv.fillStyle = '#000000';
      fpv.font = 'bold 12px sans-serif';
      fpv.textAlign = 'center';
      fpv.fillText(reverseGearActive ? 'R' : 'D', gearX + 25, gearY + 20);
      
      // Speed indicator
      const speedBarX = 20;
      const speedBarY = 40;
      const speedBarW = 8;
      const speedBarH = 100;
      const speedPercent = Math.abs(car.v) / carParams.maxSpeed;
      
      // Speed bar background
      fpv.fillStyle = '#dee2e6';
      fpv.fillRect(speedBarX, speedBarY, speedBarW, speedBarH);
      
      // Speed bar fill
      const speedHeight = speedPercent * speedBarH;
      fpv.fillStyle = car.v > 0 ? '#28a745' : (car.v < 0 ? '#ffc107' : '#6c757d');
      fpv.fillRect(speedBarX, speedBarY + speedBarH - speedHeight, speedBarW, speedHeight);
      
      // Speed bar border
      fpv.strokeStyle = '#495057';
      fpv.lineWidth = 1;
      fpv.strokeRect(speedBarX, speedBarY, speedBarW, speedBarH);
      
      // Speed display
      fpv.fillStyle = '#000000';
      fpv.font = 'bold 14px monospace';
      fpv.textAlign = 'left';
      const speedText = `${Math.abs(car.v * 10).toFixed(1)} km/h`;
      fpv.fillText(speedText, speedBarX + 15, speedBarY + 20);
      
      // Steering angle display
      const angleDegrees = (steeringAngle * 180 / Math.PI).toFixed(1);
      fpv.fillStyle = '#000000';
      fpv.font = 'bold 14px monospace';
      fpv.textAlign = 'center';
      fpv.fillText(`转向: ${angleDegrees}°`, w / 2, 30);
      
      // Speed direction indicator
      if (Math.abs(car.v) > 0.1) {
        fpv.fillStyle = car.v > 0 ? '#28a745' : '#ffc107';
        fpv.font = 'bold 12px monospace';
        fpv.textAlign = 'center';
        fpv.fillText(car.v > 0 ? '前进' : '倒车', w / 2, 50);
      }
    }

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
        }).catch(e => {
          console.log('Music play failed:', e);
          musicToggle.textContent = '❌ 播放失败';
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
  
  // Overlay buttons
  ov.next.addEventListener('click', () => resetLevel(level + 1));
  ov.retry.addEventListener('click', () => resetLevel(level));
})();


