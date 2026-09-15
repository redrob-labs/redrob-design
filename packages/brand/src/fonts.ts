// Pretendard is the single Redrob product family, shared with Console: one face for Latin and
// Hangul, so the `ko` locale is the same font rather than a fallback. Vendored, not fetched, because
// the desktop app renders its chrome offline. Geist and Fraunces are not product typography and are
// no longer loaded.
import './fonts.css';
// JetBrains Mono: code surfaces, token values and cost readouts only, never UI labels or body copy.
// Console names this family without loading it; the desktop ships it, so it actually renders here.
import '@fontsource-variable/jetbrains-mono';
