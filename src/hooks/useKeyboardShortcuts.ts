import { useEffect } from 'react'
import type { NavigateFunction } from 'react-router-dom'

export function useKeyboardShortcuts(
  navigate: NavigateFunction,
  syncNow: () => Promise<void>,
): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }

      switch (event.key.toLowerCase()) {
        case 'n':
          event.preventDefault()
          navigate('/lancamentos')
          window.requestAnimationFrame(() => {
            document.getElementById('data')?.focus()
          })
          break
        case 'd':
          event.preventDefault()
          navigate('/dashboard')
          break
        case 's':
          event.preventDefault()
          void syncNow()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, syncNow])
}
