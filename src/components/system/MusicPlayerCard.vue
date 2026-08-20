<script setup>
import { ref } from 'vue'
import albumArt from '../../assets/img/album-1.jpg'

const isPlaying = ref(true)

function togglePlay(e) {
  e.stopPropagation()
  isPlaying.value = !isPlaying.value
}
</script>

<template>
  <div class="ls-player">
    <div class="lp-top">
      <div class="lp-art">
        <img :src="albumArt" alt="Blinding Lights" />
      </div>
      <div class="lp-info">
        <span class="lp-title">Blinding Lights</span>
        <span class="lp-artist">The Weeknd</span>
      </div>
      <div class="lp-wave" :class="{ paused: !isPlaying }">
        <i></i><i></i><i></i><i></i>
      </div>
    </div>
    <div class="lp-progress">
      <span class="lp-time">1:40</span>
      <div class="lp-track"><div class="lp-track-fill"></div><div class="lp-track-knob"></div></div>
      <span class="lp-time">3:20</span>
    </div>
    <div class="lp-controls">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
      <div class="lp-main">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        <div class="lp-play" @click="togglePlay">
          <svg v-if="isPlaying" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
          <svg v-else width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>
    </div>
  </div>
</template>

<style scoped>
.ls-player {
  position: relative;
  width: 100%;
  height: 164px;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
  border-radius: 32px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  will-change: transform;
}
.ls-player:active { transform: scale(0.98); }
.lp-top { display: flex; align-items: center; gap: 14px; }
.lp-art {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  flex: none;
}
.lp-art img { width: 100%; height: 100%; object-fit: cover; }
.lp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.lp-title {
  color: #fff;
  font: 600 16px/1.2 var(--font-stack);
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lp-artist { color: #a0a0a0; font: 400 14px/1.3 var(--font-stack); margin-top: 1px; }

.lp-wave { display: flex; align-items: flex-end; gap: 2.5px; height: 16px; width: 24px; margin-right: 4px; }
.lp-wave i {
  width: 2.5px;
  background: #1ed760;
  border-radius: 999px;
  animation: waveform 0.8s ease-in-out infinite;
}
.lp-wave i:nth-child(2) { animation-duration: 0.9s; animation-delay: 0.2s; }
.lp-wave i:nth-child(3) { animation-duration: 0.7s; animation-delay: 0.4s; }
.lp-wave i:nth-child(4) { animation-duration: 1s; animation-delay: 0.1s; }
.lp-wave.paused i { animation-play-state: paused; height: 4px !important; }

@keyframes waveform {
  0%, 100% { height: 25%; opacity: 0.8; }
  50% { height: 100%; opacity: 1; }
}

/* 进度 */
.lp-progress { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 0 4px; }
.lp-time {
  color: #888;
  font: 500 10px/1 var(--font-stack);
  width: 24px;
  text-align: right;
}
.lp-time:last-child { text-align: left; }
.lp-track {
  flex: 1;
  height: 6px;
  background: #444;
  border-radius: 999px;
  position: relative;
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.2);
}
.lp-track-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 45%;
  background: #fff;
  border-radius: 999px;
}
.lp-track-knob {
  position: absolute;
  left: 45%;
  top: 50%;
  width: 14px; height: 14px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* 控制 */
.lp-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 4px;
  color: #fff;
}
.lp-main { display: flex; align-items: center; gap: 28px; }
.lp-play { 
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); 
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lp-play:active { transform: scale(0.9); }
</style>
