import { defineStore } from 'pinia'

export const useRecorderStore = defineStore('recorder', {
  state: () => ({
    isRecording: false,
    isPaused: false,
    duration: 0,
    islandExpanded: false,
    timerId: null,
    recordings: []
  }),

  getters: {
    formattedTime: (state) => {
      const mins = Math.floor(state.duration / 60)
      const secs = state.duration % 60
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
  },

  actions: {
    startRecording() {
      if (this.isRecording) return
      this.isRecording = true
      this.isPaused = false
      this.duration = 0
      this.islandExpanded = false
      this._clearTimer()
      this.timerId = setInterval(() => {
        if (!this.isPaused) {
          this.duration++
        }
      }, 1000)
    },

    pauseRecording() {
      if (!this.isRecording) return
      this.isPaused = true
    },

    resumeRecording() {
      if (!this.isRecording) return
      this.isPaused = false
    },

    stopRecording() {
      if (!this.isRecording) return
      this._clearTimer()
      if (this.duration > 0) {
        this.recordings.unshift({
          id: Date.now(),
          name: `新录音 ${this.recordings.length + 1}`,
          duration: this.duration,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString()
        })
      }
      this.isRecording = false
      this.isPaused = false
      this.duration = 0
      this.islandExpanded = false
    },

    toggleIslandExpanded() {
      this.islandExpanded = !this.islandExpanded
    },

    setIslandExpanded(val) {
      this.islandExpanded = val
    },

    _clearTimer() {
      if (this.timerId) {
        clearInterval(this.timerId)
        this.timerId = null
      }
    }
  }
})
