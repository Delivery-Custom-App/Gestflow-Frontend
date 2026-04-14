function InventoryShell({ user, userRole, onLogout, children }) {
  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a' }}>Inventario</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            {user?.email || 'Usuario'} · {userRole || 'Rol'}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          style={{
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#334155',
            borderRadius: '8px',
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Salir
        </button>
      </header>
      {children}
    </main>
  )
}

export default InventoryShell
