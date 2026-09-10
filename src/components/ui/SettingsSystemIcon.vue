<script setup>
import accessibility from '../../assets/icons/settings/accessibility.svg'
import ai from '../../assets/icons/settings/ai.svg'
import apps from '../../assets/icons/settings/apps.svg'
import bluetooth from '../../assets/icons/settings/bluetooth.svg'
import device from '../../assets/icons/settings/device.svg'
import display from '../../assets/icons/settings/display.svg'
import health from '../../assets/icons/settings/health.svg'
import location from '../../assets/icons/settings/location.svg'
import multiDevice from '../../assets/icons/settings/multi-device.svg'
import notifications from '../../assets/icons/settings/notifications.svg'
import privacy from '../../assets/icons/settings/privacy.svg'
import security from '../../assets/icons/settings/security.svg'
import sim from '../../assets/icons/settings/sim.svg'
import sound from '../../assets/icons/settings/sound.svg'
import storage from '../../assets/icons/settings/storage.svg'
import system from '../../assets/icons/settings/system.svg'
import user from '../../assets/icons/settings/user.svg'
import wallpaper from '../../assets/icons/settings/wallpaper.svg'
import wifi from '../../assets/icons/settings/wifi.svg'

const icons = {
  accessibility,
  ai,
  apps,
  bluetooth,
  device,
  display,
  health,
  location,
  'multi-device': multiDevice,
  notifications,
  privacy,
  security,
  sim,
  sound,
  storage,
  system,
  user,
  wallpaper,
  wifi
}

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 18 }
})
</script>

<template>
  <img
    class="settings-system-icon"
    :src="icons[props.name]"
    :width="props.size"
    :height="props.size"
    alt=""
    aria-hidden="true"
    draggable="false"
  />
</template>

<style scoped>
.settings-system-icon {
  display: block;
  object-fit: contain;
  filter: brightness(0) invert(1);
  pointer-events: none;
  user-select: none;
}
</style>
