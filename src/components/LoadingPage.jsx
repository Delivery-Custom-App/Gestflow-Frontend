import './LoadingPage.css'

export default function LoadingPage() {
  return (
    <div className="loading-page">
      <div className="loading-container">
        <div className="loading-logo">
          <img src="/sibaritco-logo.svg" alt="Sibarítco" className="loading-logo-image" />
        </div>
        
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
        </div>
        
        <h1 className="loading-title">SibaGestion</h1>
        <p className="loading-subtitle">Cargando...</p>
      </div>
    </div>
  )
}
