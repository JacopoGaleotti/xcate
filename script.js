/* Starfield + Quote modal logic */
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d', { alpha: true });

let W, H, DPR;
function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.width = Math.floor(window.innerWidth * DPR);
  H = canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize); resize();

// --- Starfield ---
const STAR_COUNT = 180;         // stelle puntiformi
const SHOOTING_EVERY_MS = 4200 + Math.random()*1200; // media tra una "cadente" e l'altra
const stars = [];
function rand(a,b){ return a + Math.random()*(b-a); }

for(let i=0;i<STAR_COUNT;i++){
  stars.push({
    x: rand(0, W), y: rand(0, H),
    r: rand(0.5, 1.8) * DPR,
    tw: rand(0.5, 1.2), // velocità sfarfallio
    baseAlpha: rand(0.35, 0.95),
    phase: Math.random() * Math.PI * 2
  });
}

// scegli una stella da far "brillare" all'apertura
const focusIndex = Math.floor(Math.random()*STAR_COUNT);
let focusAnim = { t: 0, active: true };

const shooting = [];
function spawnShootingStar(){
  const startX = rand(0.1*W, 0.9*W);
  const startY = rand(0.05*H, 0.45*H);
  const len = rand(120, 220) * DPR;
  const angle = rand(Math.PI*0.6, Math.PI*0.9); // diagonale
  const speed = rand(600, 900) * DPR; // px/sec
  shooting.push({
    x: startX, y: startY, len, angle, speed,
    life: 0, ttl: rand(0.8, 1.4) // seconds
  });
}
setInterval(spawnShootingStar, SHOOTING_EVERY_MS);

// draw helpers
function drawStar(s, i, t){
  const flicker = (Math.sin(s.phase + t*s.tw) + 1)/2; // 0..1
  const alpha = s.baseAlpha * (0.6 + 0.4 * flicker);

  let r = s.r;
  let glow = 0.0;
  // focus animation (solo su una stella)
  if(i === focusIndex && focusAnim.active){
    focusAnim.t += 0.012; // easing
    const e = Math.min(1, focusAnim.t);
    r = s.r + e*2.4*DPR;
    glow = e*0.6;
    if(e >= 1){
      focusAnim.active = false;
      // una volta brillante, mostra la citazione
      setTimeout(openQuoteModal, 250);
    }
  }
  // puntino
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI*2);
  ctx.fill();

  // alone/glow
  if(glow>0){
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r*8);
    g.addColorStop(0, 'rgba(200,220,255,0.36)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.globalAlpha = glow;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r*8, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawShooting(dt){
  // update & draw shooting stars
  for(let i=shooting.length-1;i>=0;i--){
    const s = shooting[i];
    s.life += dt;
    if(s.life > s.ttl){ shooting.splice(i,1); continue; }
    // position update
    const vx = Math.cos(s.angle) * s.speed * dt;
    const vy = Math.sin(s.angle) * s.speed * dt;
    s.x += vx; s.y += vy;

    // trail
    ctx.globalAlpha = Math.max(0, 1 - (s.life / s.ttl));
    ctx.strokeStyle = '#e9f0ff';
    ctx.lineWidth = 1.3 * DPR;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
    ctx.stroke();

    // head
    ctx.globalAlpha = Math.max(0.3, 1 - (s.life / s.ttl));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.8*DPR, 0, Math.PI*2);
    ctx.fill();
  }
}

let last = performance.now();
function tick(now){
  const dt = Math.min(0.033, (now - last)/1000); // cap to 30fps if tab hidden
  last = now;

  ctx.clearRect(0,0,W,H);

  // subtle vignette background
  const grd = ctx.createRadialGradient(W*0.4,H*0.3,0, W*0.4,H*0.3, Math.max(W,H)*0.7);
  grd.addColorStop(0, 'rgba(20,26,54,0.28)');
  grd.addColorStop(1, 'rgba(7,10,22,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,W,H);

  const t = now/1000;
  for(let i=0;i<stars.length;i++) drawStar(stars[i], i, t);
  drawShooting(dt);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// --- Modal & quotes ---
const modal = document.getElementById('quoteModal');
const quoteContent = document.getElementById('quoteContent');
const quoteMeta = document.getElementById('quoteMeta');
const loader = document.getElementById('loader');
const closeBtn = document.getElementById('closeModal');

function setQuote(q){
  quoteContent.innerHTML = `<p>“${q.quote}”</p>`;
  quoteMeta.innerHTML = `<p style="text-align:right; font-style:italic; margin-top:10px;">— ${q.author || "Autore sconosciuto"}</p>`;
}


function setLoading(on){
  loader.style.display = on ? 'inline-block' : 'none';
}

async function openQuoteModal(){
  setLoading(true);
  modal.style.display = 'flex';
  // fetch from Netlify Function
  try{
    const res = await fetch('/.netlify/functions/generate-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if(data && data.quote){
      setQuote(data);
    }else{
      throw new Error('Formato inatteso');
    }
  }catch(err){
    // fallback locale poetico (se API fallisce)
    const fallbacks = [
  {quote:"La notte ascolta i pensieri più profondi.", author:"Jacopo"},
  {quote:"Ogni stella è un pensiero che brilla.", author:"Jacopo"},
];
    setQuote(fallbacks[Math.floor(Math.random()*fallbacks.length)]);
    console.warn('Errore nel recupero citazione:', err);
  }finally{
    setLoading(false);
  }
}

// chiusura modale
closeBtn.addEventListener('click', ()=> modal.style.display = 'none');
window.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape') modal.style.display = 'none';
});

document.getElementById('new-quote-btn').addEventListener('click', () => {
    openQuoteModal(); // chiama direttamente la funzione
});



