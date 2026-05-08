const storyOrder = Array.from(document.querySelectorAll('.story-card'));
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const readBtn = document.getElementById('readBtn');
const muteFxBtn = document.getElementById('muteFxBtn');
const subtitleBar = document.getElementById('subtitleBar');
const subtitleText = document.getElementById('subtitleText');
const introOverlay = document.getElementById('introOverlay');
const startExperience = document.getElementById('startExperience');
const skipToRead = document.getElementById('skipToRead');

let currentIndex = 0;
let isPlaying = false;
let fxMuted = false;
let speaking = false;
let audioContext, masterGain, droneOsc, pulseInterval;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const preferred = voices.find(v => /Google|Natural|Samantha|Daniel|Microsoft|English/i.test(v.name) && /en/i.test(v.lang));
  return preferred || voices.find(v => /en/i.test(v.lang)) || voices[0];
}

function setActiveCard(index) {
  storyOrder.forEach((card, i) => card.classList.toggle('active', i === index));
  const card = storyOrder[index];
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showSubtitle(text) {
  subtitleBar.classList.remove('hidden');
  subtitleText.textContent = text;
}

function hideSubtitle() {
  subtitleBar.classList.add('hidden');
  subtitleText.textContent = '';
}

function getSegmentText(index) {
  const p = storyOrder[index]?.querySelector('p');
  return p ? p.textContent.trim() : '';
}

function ensureAudio() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.05;
  masterGain.connect(audioContext.destination);
}

function playStartFx() {
  if (fxMuted) return;
  ensureAudio();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.35);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.5);
}

function startAmbient() {
  if (fxMuted) return;
  ensureAudio();
  if (droneOsc) return;
  droneOsc = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  droneOsc.type = 'sawtooth';
  droneOsc.frequency.value = 58;
  filter.type = 'lowpass';
  filter.frequency.value = 240;
  gain.gain.value = 0.02;
  droneOsc.connect(filter).connect(gain).connect(masterGain);
  droneOsc.start();
  pulseInterval = setInterval(() => {
    if (fxMuted || !audioContext) return;
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gainPulse = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    gainPulse.gain.setValueAtTime(0.0001, now);
    gainPulse.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
    gainPulse.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gainPulse).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }, 6500);
}

function stopAmbient() {
  if (droneOsc) {
    droneOsc.stop();
    droneOsc.disconnect();
    droneOsc = null;
  }
  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
  }
}

function speakSegment(index = 0) {
  if (!isPlaying || index >= storyOrder.length) {
    isPlaying = false;
    speaking = false;
    hideSubtitle();
    return;
  }
  currentIndex = index;
  setActiveCard(index);
  const text = getSegmentText(index);
  showSubtitle(text);
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.rate = 0.92;
  utter.pitch = 0.96;
  utter.volume = 1;
  speaking = true;
  utter.onend = () => {
    speaking = false;
    if (isPlaying) setTimeout(() => speakSegment(index + 1), 650);
  };
  utter.onerror = () => {
    speaking = false;
    if (isPlaying) setTimeout(() => speakSegment(index + 1), 650);
  };
  speechSynthesis.speak(utter);
}

function playStory(startAt = currentIndex) {
  speechSynthesis.cancel();
  isPlaying = true;
  currentIndex = startAt;
  startAmbient();
  speakSegment(startAt);
}

function pauseStory() {
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    showSubtitle('Paused. Press Play Story to continue.');
  } else if (speechSynthesis.paused) {
    speechSynthesis.resume();
  } else {
    isPlaying = false;
    speechSynthesis.cancel();
    hideSubtitle();
  }
}

function stopStoryAndRead() {
  isPlaying = false;
  speechSynthesis.cancel();
  hideSubtitle();
  document.getElementById('story').scrollIntoView({ behavior: 'smooth' });
}

playBtn.addEventListener('click', () => {
  playStartFx();
  playStory(currentIndex);
});
pauseBtn.addEventListener('click', pauseStory);
readBtn.addEventListener('click', stopStoryAndRead);
muteFxBtn.addEventListener('click', () => {
  fxMuted = !fxMuted;
  muteFxBtn.textContent = fxMuted ? '🔇 FX Off' : '🔊 FX On';
  if (fxMuted) stopAmbient();
  else if (isPlaying) startAmbient();
});

startExperience.addEventListener('click', () => {
  playStartFx();
  introOverlay.classList.add('hidden');
  setTimeout(() => introOverlay.style.display = 'none', 600);
  playStory(0);
});

skipToRead.addEventListener('click', () => {
  introOverlay.classList.add('hidden');
  setTimeout(() => introOverlay.style.display = 'none', 600);
  stopStoryAndRead();
});

storyOrder.forEach((card, idx) => {
  card.addEventListener('click', () => {
    currentIndex = idx;
    setActiveCard(idx);
    if (isPlaying) {
      speechSynthesis.cancel();
      setTimeout(() => playStory(idx), 200);
    }
  });
});

window.addEventListener('beforeunload', () => {
  speechSynthesis.cancel();
  stopAmbient();
});

// Make sure voices load in some browsers.
window.speechSynthesis.onvoiceschanged = () => pickVoice();
