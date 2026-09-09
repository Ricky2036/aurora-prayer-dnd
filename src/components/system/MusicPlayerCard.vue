<script setup>
import { useControlStore } from '../../stores/controlStore'
import albumCover from '../../assets/icons/album_cover.png'
import LIcon from '../ui/LIcon.vue'

const props = defineProps({
  isIsland: {
    type: Boolean,
    default: false
  }
})

const control = useControlStore()

function togglePlay(e) {
  e.stopPropagation()
  control.toggleMediaPlaying()
}
</script>

<template>
  <div class="ls-player" :class="{ 'is-island': isIsland }">
    <div class="lp-top">
      <div class="lp-art">
        <img :src="albumCover" :alt="control.mediaTitle" />
      </div>
      <div class="lp-info">
        <span class="lp-title">{{ control.mediaTitle }}</span>
        <span class="lp-artist">{{ control.mediaArtist }}</span>
      </div>
      <div class="lp-wave" :class="{ paused: !control.mediaPlaying }">
        <i></i><i></i><i></i><i></i>
      </div>
    </div>
    <div class="lp-progress">
      <span class="lp-time">1:40</span>
      <div class="lp-track"><div class="lp-track-fill"></div><div class="lp-track-knob"></div></div>
      <span class="lp-time">3:20</span>
    </div>
    <div class="lp-controls">
      <button class="lp-btn" @click.stop="" title="喜爱">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
      </button>
      <div class="lp-main">
        <button class="lp-btn lp-skip-btn" @click.stop="" title="上一首">
          <LIcon name="skipBack" :size="20" :filled="true" />
        </button>
        <div class="lp-play" @click="togglePlay" title="播放/暂停">
          <svg v-if="control.mediaPlaying" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
          <svg v-else width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <button class="lp-btn lp-skip-btn" @click.stop="" title="下一首">
          <LIcon name="skipForward" :size="20" :filled="true" />
        </button>
      </div>
      <button class="lp-btn" @click.stop="" title="随机播放">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>
      </button>
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
  box-shadow: none;
  border-radius: 32px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  will-change: transform;
  box-sizing: border-box;
}
.ls-player:active { transform: scale(0.98); }

.ls-player.is-island {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none;
  box-shadow: none;
  padding: 0;
  height: 100%;
  border-radius: 0;
}
.ls-player.is-island:active {
  transform: none;
}

.lp-top { display: flex; align-items: center; gap: 14px; }
.lp-art {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  flex: none;
}
.lp-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.08);
}
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
.lp-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.lp-btn:active {
  transform: scale(0.88);
  opacity: 0.8;
}
.lp-skip-btn {
  color: #fff;
}
.lp-main { display: flex; align-items: center; gap: 28px; }
.lp-play { 
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); 
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform 0.15s ease;
}
.lp-play:active { transform: scale(0.9); }
</style>
