const SUPPORTS_VIBRATION = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'celebration' | 'levelUp' | 'rankUp' = 'medium') {
  if (!SUPPORTS_VIBRATION) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 20, 30]);
        break;
      case 'success':
        navigator.vibrate([15, 40, 15]);
        break;
      case 'warning':
        navigator.vibrate([50, 30, 50]);
        break;
      case 'error':
        navigator.vibrate([80, 40, 80]);
        break;
      case 'celebration':
        navigator.vibrate([20, 30, 20, 30, 20]);
        break;
      case 'levelUp':
        navigator.vibrate([30, 60, 30, 60, 30, 100]);
        break;
      case 'rankUp':
        navigator.vibrate([20, 40, 20, 40, 20, 40, 80]);
        break;
    }
  } catch { /* ignore */ }
}

export function hapticSelection() {
  if (!SUPPORTS_VIBRATION) return;
  try { navigator.vibrate(5); } catch { /* ignore */ }
}

export function hapticSuccess() { haptic('success'); }
export function hapticCelebration() { haptic('celebration'); }
export function hapticLevelUp() { haptic('levelUp'); }
export function hapticRankUp() { haptic('rankUp'); }

export function hapticToggle(isOn: boolean) {
  if (!SUPPORTS_VIBRATION) return;
  try { navigator.vibrate(isOn ? 15 : 8); } catch { /* ignore */ }
}
