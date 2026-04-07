(function(){
'use strict';

// ═══════════════════════════════════════════════════════════════════
// CANVAS SETUP
// ═══════════════════════════════════════════════════════════════════
var canvas=document.getElementById('c');
var cx=canvas.getContext('2d');
var W=0,H=0,dpr=1;
var mx=0.5,my=0.5; // normalized mouse [0..1]
var mouseActive=false;

function resize(){
  dpr=window.devicePixelRatio||1;
  W=window.innerWidth;H=window.innerHeight;
  canvas.width=W*dpr;canvas.height=H*dpr;
  cx.setTransform(dpr,0,0,dpr,0,0);
}
resize();
window.addEventListener('resize',resize);

// ═══════════════════════════════════════════════════════════════════
// AUDIO ENGINE — Two opposing sonic forces
// ═══════════════════════════════════════════════════════════════════
var ctx=null,anl=null,anl2=null;
// Left force: warm, low, slow (sine+triangle, low freq, chorus)
var forceL={oscs:[],gains:[],pans:[],master:null,filter:null};
// Right force: cold, high, fast (saw+square softened, high freq)
var forceR={oscs:[],gains:[],pans:[],master:null,filter:null};
// Sub drone
var subOsc=null,subGain=null;
// Collision oscillator — plays the beating interference
var collOsc1=null,collOsc2=null,collGainL=null,collGainR=null,collPanL=null,collPanR=null;
// Master
var masterGain=null;
var started=false;

// Harmonic ratios for rich chords
var leftRatios=[1, 1.5, 2, 2.5, 3]; // root, 5th, oct, oct+3rd, oct+5th
var rightRatios=[1, 1.498, 2, 3, 4]; // root, 5th, oct, 12th, 2oct
var leftDetune=[-5, 3, -2, 7, -4];
var rightDetune=[4, -3, 6, -5, 2];

function initAudio(){
  if(ctx)return;
  ctx=new(window.AudioContext||window.webkitAudioContext)();

  // Analysers
  anl=ctx.createAnalyser();anl.fftSize=2048;anl.smoothingTimeConstant=0.8;
  anl2=ctx.createAnalyser();anl2.fftSize=512;anl2.smoothingTimeConstant=0.85;

  // Master
  masterGain=ctx.createGain();masterGain.gain.value=0;
  masterGain.connect(anl);anl.connect(anl2);anl2.connect(ctx.destination);

  // ── LEFT FORCE — warm, deep ──
  forceL.master=ctx.createGain();forceL.master.gain.value=0.35;
  forceL.filter=ctx.createBiquadFilter();
  forceL.filter.type='lowpass';forceL.filter.frequency.value=800;forceL.filter.Q.value=0.5;
  forceL.master.connect(forceL.filter);forceL.filter.connect(masterGain);

  for(var i=0;i<5;i++){
    var o=ctx.createOscillator();
    var g=ctx.createGain();
    var p=ctx.createStereoPanner();
    o.type=i<3?'sine':'triangle';
    o.frequency.value=110*leftRatios[i];
    o.detune.value=leftDetune[i];
    g.gain.value=0.15/(i+1); // higher harmonics quieter
    p.pan.value=-0.6+Math.random()*0.3; // mostly left
    o.connect(g);g.connect(p);p.connect(forceL.master);
    forceL.oscs.push(o);forceL.gains.push(g);forceL.pans.push(p);
  }

  // ── RIGHT FORCE — cold, bright ──
  forceR.master=ctx.createGain();forceR.master.gain.value=0.25;
  forceR.filter=ctx.createBiquadFilter();
  forceR.filter.type='lowpass';forceR.filter.frequency.value=2000;forceR.filter.Q.value=0.8;
  forceR.master.connect(forceR.filter);forceR.filter.connect(masterGain);

  for(var i=0;i<5;i++){
    var o=ctx.createOscillator();
    var g=ctx.createGain();
    var p=ctx.createStereoPanner();
    o.type=i<2?'sine':'triangle'; // cleaner for high freq
    o.frequency.value=440*rightRatios[i];
    o.detune.value=rightDetune[i];
    g.gain.value=0.12/(i+1);
    p.pan.value=0.3+Math.random()*0.3; // mostly right
    o.connect(g);g.connect(p);p.connect(forceR.master);
    forceR.oscs.push(o);forceR.gains.push(g);forceR.pans.push(p);
  }

  // ── Sub drone ──
  subOsc=ctx.createOscillator();subGain=ctx.createGain();
  subOsc.type='sine';subOsc.frequency.value=55;subGain.gain.value=0.1;
  subOsc.connect(subGain);subGain.connect(masterGain);

  // ── Collision binaural pair (center) ──
  collOsc1=ctx.createOscillator();collOsc2=ctx.createOscillator();
  collGainL=ctx.createGain();collGainR=ctx.createGain();
  collPanL=ctx.createStereoPanner();collPanR=ctx.createStereoPanner();
  collOsc1.type='sine';collOsc2.type='sine';
  collOsc1.frequency.value=200;collOsc2.frequency.value=205;
  collGainL.gain.value=0;collGainR.gain.value=0;
  collPanL.pan.value=-1;collPanR.pan.value=1;
  collOsc1.connect(collGainL);collGainL.connect(collPanL);collPanL.connect(masterGain);
  collOsc2.connect(collGainR);collGainR.connect(collPanR);collPanR.connect(masterGain);

  // Delay for space
  var delay=ctx.createDelay(5);delay.delayTime.value=0.35;
  var fb=ctx.createGain();fb.gain.value=0.2;
  var wet=ctx.createGain();wet.gain.value=0.15;
  masterGain.connect(delay);delay.connect(fb);fb.connect(delay);
  delay.connect(wet);wet.connect(anl);

  // Start everything
  forceL.oscs.forEach(function(o){o.start()});
  forceR.oscs.forEach(function(o){o.start()});
  subOsc.start();collOsc1.start();collOsc2.start();

  // Fade in master
  var t=ctx.currentTime;
  masterGain.gain.setValueAtTime(0,t);
  masterGain.gain.linearRampToValueAtTime(0.6,t+4);

  // Collision binaural fade in
  collGainL.gain.setValueAtTime(0,t);collGainR.gain.setValueAtTime(0,t);
  collGainL.gain.linearRampToValueAtTime(0.15,t+3);
  collGainR.gain.linearRampToValueAtTime(0.15,t+3);

  started=true;
}

// ── Update audio from mouse position ──
function updateAudio(){
  if(!ctx||!started)return;
  var t=ctx.currentTime;

  // mx: 0=full left, 1=full right
  // my: 0=top(high), 1=bottom(low)
  var leftPower=1-mx; // stronger when mouse is left
  var rightPower=mx;
  var pitch=1-my; // 0=low, 1=high

  // Left force: base freq 55-220 Hz based on Y
  var leftBase=55+pitch*165;
  for(var i=0;i<forceL.oscs.length;i++){
    forceL.oscs[i].frequency.setTargetAtTime(leftBase*leftRatios[i],t,0.3);
    forceL.gains[i].gain.setTargetAtTime((0.15/(i+1))*leftPower,t,0.1);
  }
  forceL.master.gain.setTargetAtTime(0.35*leftPower,t,0.2);
  forceL.filter.frequency.setTargetAtTime(300+leftPower*600,t,0.3);

  // Right force: base freq 220-880 Hz based on Y
  var rightBase=220+pitch*660;
  for(var i=0;i<forceR.oscs.length;i++){
    forceR.oscs[i].frequency.setTargetAtTime(rightBase*rightRatios[i],t,0.3);
    forceR.gains[i].gain.setTargetAtTime((0.12/(i+1))*rightPower,t,0.1);
  }
  forceR.master.gain.setTargetAtTime(0.25*rightPower,t,0.2);
  forceR.filter.frequency.setTargetAtTime(600+rightPower*2000,t,0.3);

  // Sub drone follows left base
  subOsc.frequency.setTargetAtTime(leftBase/2,t,0.5);
  subGain.gain.setTargetAtTime(0.1*leftPower,t,0.3);

  // Collision — binaural beat between left and right base
  var collFreq=(leftBase+rightBase)/2;
  var collBeat=Math.abs(rightBase-leftBase);
  // Clamp collision beat for audibility
  if(collBeat>40)collBeat=40;
  collOsc1.frequency.setTargetAtTime(collFreq,t,0.2);
  collOsc2.frequency.setTargetAtTime(collFreq+collBeat*0.1,t,0.2);

  // Collision intensity — strongest when forces are equal (mx~0.5)
  var collIntensity=1-Math.abs(mx-0.5)*2;
  collGainL.gain.setTargetAtTime(0.12*collIntensity,t,0.2);
  collGainR.gain.setTargetAtTime(0.12*collIntensity,t,0.2);

  // Update HUD
  document.getElementById('fl-hz').textContent=Math.round(leftBase)+' Hz';
  document.getElementById('fr-hz').textContent=Math.round(rightBase)+' Hz';
  document.getElementById('beat-display').textContent=Math.abs(rightBase-leftBase).toFixed(1)+' Hz';
  document.getElementById('fl-note').textContent=freqToNote(leftBase);
  document.getElementById('fr-note').textContent=freqToNote(rightBase);

  // Side labels opacity
  document.getElementById('label-left').style.opacity=0.15+leftPower*0.5;
  document.getElementById('label-right').style.opacity=0.15+rightPower*0.5;
}

function freqToNote(f){
  var notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  var n=12*Math.log2(f/440)+69;
  var note=notes[Math.round(n)%12];
  var oct=Math.floor(Math.round(n)/12)-1;
  return note+oct;
}

// ═══════════════════════════════════════════════════════════════════
// PARTICLES — Two opposing streams
// ═══════════════════════════════════════════════════════════════════
var particlesL=[],particlesR=[],collisionParticles=[];
var MAX_P=200;

function Particle(side){
  this.side=side; // 'left' or 'right'
  this.reset();
}
Particle.prototype.reset=function(){
  if(this.side==='left'){
    this.x=-10;
    this.y=Math.random()*H;
    this.vx=0.5+Math.random()*2;
    this.vy=(Math.random()-0.5)*0.5;
    this.r=1.5+Math.random()*2.5;
    this.hue=10+Math.random()*30; // warm orange-red
    this.life=1;
  } else {
    this.x=W+10;
    this.y=Math.random()*H;
    this.vx=-(0.5+Math.random()*2);
    this.vy=(Math.random()-0.5)*0.5;
    this.r=1+Math.random()*2;
    this.hue=200+Math.random()*40; // cold blue
    this.life=1;
  }
  this.alpha=0.3+Math.random()*0.5;
  this.decay=0.0008+Math.random()*0.0005;
};
Particle.prototype.update=function(power,audioLevel){
  var speed=1+audioLevel*3;
  this.x+=this.vx*speed;
  this.y+=this.vy;
  this.life-=this.decay;

  // Attract toward mouse Y
  var dy=(my*H-this.y)*0.002;
  this.vy+=dy;
  this.vy*=0.98;

  // Scale by power
  var s=power*0.7+0.3;
  this.alpha=s*(0.3+audioLevel*0.5)*this.life;

  // Collision zone — particles near center slow down and spark
  var centerX=mx*W;
  var distToCenter=Math.abs(this.x-centerX);
  if(distToCenter<80){
    this.vx*=0.97;
    if(Math.random()<0.03*audioLevel){
      spawnCollisionSpark(this.x,this.y,this.hue);
    }
  }

  if(this.life<=0||this.x<-20||this.x>W+20)this.reset();
};
Particle.prototype.draw=function(){
  if(this.alpha<0.01)return;
  cx.beginPath();
  cx.arc(this.x,this.y,this.r,0,Math.PI*2);
  cx.fillStyle='hsla('+this.hue+',80%,60%,'+this.alpha+')';
  cx.fill();

  // Glow trail
  if(this.alpha>0.15){
    cx.beginPath();
    cx.arc(this.x,this.y,this.r*3,0,Math.PI*2);
    cx.fillStyle='hsla('+this.hue+',60%,50%,'+this.alpha*0.1+')';
    cx.fill();
  }
};

function spawnCollisionSpark(x,y,srcHue){
  if(collisionParticles.length>100)return;
  collisionParticles.push({
    x:x,y:y,
    vx:(Math.random()-0.5)*4,
    vy:(Math.random()-0.5)*4,
    r:1+Math.random()*2,
    hue:(srcHue+180)%360, // opposite color
    life:1,
    decay:0.02+Math.random()*0.02
  });
}

// Init particles
for(var i=0;i<MAX_P;i++){
  particlesL.push(new Particle('left'));
  particlesR.push(new Particle('right'));
  // Stagger initial positions
  particlesL[i].x=Math.random()*W*0.5;
  particlesR[i].x=W*0.5+Math.random()*W*0.5;
}

// ═══════════════════════════════════════════════════════════════════
// WAVE RINGS — concentric circles from each side
// ═══════════════════════════════════════════════════════════════════
var ringsL=[],ringsR=[];
var ringTimer=0;

function spawnRing(side){
  var arr=side==='left'?ringsL:ringsR;
  if(arr.length>8)return;
  arr.push({
    x:side==='left'?0:W,
    y:my*H,
    radius:10,
    maxRadius:W*0.7,
    speed:side==='left'?2:2,
    hue:side==='left'?15:220,
    alpha:0.3,
    life:1
  });
}

// ═══════════════════════════════════════════════════════════════════
// FREQUENCY BARS — opposite direction spectrum
// ═══════════════════════════════════════════════════════════════════
var freqData=null,timeData=null;

// ═══════════════════════════════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════════════════════════════
var lastTime=0;

function render(now){
  requestAnimationFrame(render);
  var dt=Math.min((now-lastTime)/16.67,3);
  lastTime=now;

  // Audio data
  var audioLevel=0,audioLevelR=0;
  if(anl2&&started){
    if(!freqData)freqData=new Uint8Array(anl2.frequencyBinCount);
    if(!timeData)timeData=new Uint8Array(anl.fftSize);
    anl2.getByteFrequencyData(freqData);
    anl.getByteTimeDomainData(timeData);
    // Average level
    var sum=0;
    for(var i=0;i<freqData.length;i++)sum+=freqData[i];
    audioLevel=sum/(freqData.length*255);
  }

  var leftPower=1-mx;
  var rightPower=mx;

  // ── Clear with subtle fade (trails) ──
  cx.fillStyle='rgba(0,0,0,'+(0.08+audioLevel*0.05)+')';
  cx.fillRect(0,0,W,H);

  // ── Background gradient — shifts with mouse ──
  var grd=cx.createLinearGradient(0,0,W,0);
  grd.addColorStop(0,'rgba(40,8,8,'+(0.3*leftPower)+')');
  grd.addColorStop(0.5,'rgba(5,5,15,0.1)');
  grd.addColorStop(1,'rgba(8,15,40,'+(0.3*rightPower)+')');
  cx.fillStyle=grd;
  cx.fillRect(0,0,W,H);

  // ── Wave rings ──
  ringTimer+=dt;
  if(ringTimer>30){ringTimer=0;spawnRing('left');spawnRing('right');}

  function drawRings(arr,dir){
    for(var i=arr.length-1;i>=0;i--){
      var r=arr[i];
      r.radius+=r.speed*dt*(1+audioLevel*2);
      r.life-=0.008*dt;
      r.alpha=r.life*0.2;
      if(r.life<=0||r.radius>r.maxRadius){arr.splice(i,1);continue;}
      cx.beginPath();
      cx.arc(r.x,r.y,r.radius,0,Math.PI*2);
      cx.strokeStyle='hsla('+r.hue+',50%,40%,'+r.alpha+')';
      cx.lineWidth=1.5;
      cx.stroke();
    }
  }
  drawRings(ringsL,'left');
  drawRings(ringsR,'right');

  // ── Center waveform — where forces collide ──
  if(timeData&&started){
    var centerX=mx*W;
    var waveW=W*0.4;
    cx.beginPath();
    cx.strokeStyle='rgba(255,255,255,'+(0.1+audioLevel*0.3)+')';
    cx.lineWidth=1.5;
    var step=Math.floor(timeData.length/200);
    for(var i=0;i<200;i++){
      var v=(timeData[i*step]/128-1);
      var px=centerX-waveW/2+i*(waveW/200);
      var py=H/2+v*100*(1+audioLevel*2);
      if(i===0)cx.moveTo(px,py);else cx.lineTo(px,py);
    }
    cx.stroke();
  }

  // ── Frequency spectrum — split left/right opposite directions ──
  if(freqData&&started){
    var barCount=64;
    var centerX=mx*W;
    var barMaxH=H*0.3;

    for(var i=0;i<barCount;i++){
      var val=freqData[i*2]/255;
      var barH=val*barMaxH;
      if(barH<1)continue;
      var spacing=4;
      // Left bars go leftward from center
      var bx=centerX-(i+1)*spacing;
      if(bx>0){
        cx.fillStyle='hsla(15,70%,50%,'+(val*0.4*leftPower)+')';
        cx.fillRect(bx,H/2-barH/2,spacing-1,barH);
      }
      // Right bars go rightward from center
      bx=centerX+i*spacing;
      if(bx<W){
        cx.fillStyle='hsla(220,70%,50%,'+(val*0.4*rightPower)+')';
        cx.fillRect(bx,H/2-barH/2,spacing-1,barH);
      }
    }
  }

  // ── Collision zone glow ──
  var collIntensity=1-Math.abs(mx-0.5)*2;
  if(collIntensity>0.1&&started){
    var centerX=mx*W;
    var glow=cx.createRadialGradient(centerX,my*H,0,centerX,my*H,100+audioLevel*100);
    glow.addColorStop(0,'rgba(255,255,255,'+(collIntensity*audioLevel*0.15)+')');
    glow.addColorStop(0.5,'rgba(200,180,255,'+(collIntensity*audioLevel*0.05)+')');
    glow.addColorStop(1,'rgba(0,0,0,0)');
    cx.fillStyle=glow;
    cx.fillRect(centerX-200,my*H-200,400,400);
  }

  // ── Particles ──
  for(var i=0;i<particlesL.length;i++){
    particlesL[i].update(leftPower,audioLevel);
    particlesL[i].draw();
  }
  for(var i=0;i<particlesR.length;i++){
    particlesR[i].update(rightPower,audioLevel);
    particlesR[i].draw();
  }

  // ── Collision sparks ──
  for(var i=collisionParticles.length-1;i>=0;i--){
    var sp=collisionParticles[i];
    sp.x+=sp.vx*dt;sp.y+=sp.vy*dt;
    sp.life-=sp.decay*dt;
    if(sp.life<=0){collisionParticles.splice(i,1);continue;}
    cx.beginPath();
    cx.arc(sp.x,sp.y,sp.r*sp.life,0,Math.PI*2);
    cx.fillStyle='hsla('+sp.hue+',90%,70%,'+sp.life*0.8+')';
    cx.fill();
  }

  // ── Cursor ring pulse with audio ──
  var curRing=document.querySelector('.cur-ring');
  var curCore=document.querySelector('.cur-core');
  if(curRing&&started){
    var s=20+audioLevel*15;
    curRing.style.width=s+'px';
    curRing.style.height=s+'px';
    var coreColor='hsl('+(15+mx*205)+',70%,60%)';
    curCore.style.background=coreColor;
    curCore.style.boxShadow='0 0 '+(8+audioLevel*12)+'px '+coreColor;
    curRing.style.borderColor='hsla('+(15+mx*205)+',50%,60%,'+(0.3+audioLevel*0.3)+')';
  }
}

// ═══════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════
var cursorEl=document.getElementById('cursor');

document.addEventListener('mousemove',function(e){
  mx=e.clientX/W;
  my=e.clientY/H;
  cursorEl.style.left=e.clientX+'px';
  cursorEl.style.top=e.clientY+'px';
  mouseActive=true;
  if(started)updateAudio();
});

document.addEventListener('touchmove',function(e){
  e.preventDefault();
  var t=e.touches[0];
  mx=t.clientX/W;
  my=t.clientY/H;
  cursorEl.style.left=t.clientX+'px';
  cursorEl.style.top=t.clientY+'px';
  if(started)updateAudio();
},{passive:false});

// Intro click
var intro=document.getElementById('intro');
function startExperience(){
  intro.style.opacity='0';
  setTimeout(function(){intro.style.display='none'},1000);
  initAudio();
  if(ctx.state==='suspended')ctx.resume();

  // Auto-fade title after 5s
  setTimeout(function(){
    document.getElementById('title').style.opacity='0.15';
  },5000);
}
intro.addEventListener('click',startExperience);
intro.addEventListener('touchstart',function(e){e.preventDefault();startExperience()});

// ═══════════════════════════════════════════════════════════════════
// START RENDER
// ═══════════════════════════════════════════════════════════════════
requestAnimationFrame(render);

})();