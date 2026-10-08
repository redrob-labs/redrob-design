/**
 * The design system reads `data-theme` on <html>; VitePress toggles a `.dark` class there. Keep the
 * two in step on the client, including when the reader flips the appearance switch.
 */
export function syncDataThemeWithAppearance(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const apply = () => {
    const theme = root.classList.contains('dark') ? 'dark' : 'light'
    if (root.dataset.theme !== theme) root.dataset.theme = theme
  }
  apply()
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class'] })
}
