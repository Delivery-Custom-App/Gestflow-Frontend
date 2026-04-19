import { NavLink, useParams } from 'react-router-dom'

/**
 * Navegación interna del área Proveedores: KPIs/listado vs compras semanales (HU-34).
 * Las compras semanales forman parte de este bloque, no del menú lateral aparte.
 */
function SuppliersSubNav({ navState }) {
  const { localId } = useParams()
  const base = `/local/${localId}/inventario/proveedores`

  return (
    <nav className="inv-suppliers-subnav" aria-label="Secciones de proveedores">
      <NavLink
        to={base}
        end
        state={navState}
        className={({ isActive }) =>
          isActive ? 'inv-suppliers-subnav__link is-active' : 'inv-suppliers-subnav__link'
        }
      >
        KPIs y listado
      </NavLink>
      <NavLink
        to={`${base}/compras-semanales`}
        state={navState}
        className={({ isActive }) =>
          isActive ? 'inv-suppliers-subnav__link is-active' : 'inv-suppliers-subnav__link'
        }
      >
        Compras semanales
      </NavLink>
    </nav>
  )
}

export default SuppliersSubNav
