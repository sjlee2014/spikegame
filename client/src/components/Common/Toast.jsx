import { useEffect } from 'react'
import './Toast.css'

export function Toast({ message, type = 'error', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  if (!message) return null

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <span className="toast-icon">
          {type === 'error' && '⚠️'}
          {type === 'success' && '✅'}
          {type === 'info' && 'ℹ️'}
        </span>
        <span className="toast-message">{message}</span>
      </div>
      {onClose && (
        <button className="toast-close" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  )
}
