import './LoadingSpinner.css'

export default function LoadingSpinner({ message = 'Cargando...' }) {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner-content">
        <div className="loading-spinner-ring"></div>
        <p className="loading-spinner-text">{message}</p>
      </div>
    </div>
  )
}
