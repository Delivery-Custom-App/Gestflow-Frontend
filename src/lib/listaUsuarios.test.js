import { describe, it, expect } from 'vitest'
import { SIN_LOCAL, usuariosVisibles } from './listaUsuarios'

const USERS = [
  { id: 'd', email: 'dueno@demo.cl', role: 'ADMIN_NEGOCIO', local_id: null },
  { id: 'e1', email: 'encargado@demo.cl', role: 'ADMIN', local_id: 'loc-1' },
  { id: 'v1', email: 'vendedor1@demo.cl', role: 'EMPLEADO', local_id: 'loc-1' },
  { id: 'v2', email: 'vendedor2@demo.cl', role: 'EMPLEADO', local_id: 'loc-2' },
]
const ids = (lista) => lista.map((u) => u.id)

describe('usuariosVisibles', () => {
  it('en la vista de todo el negocio, sin filtro, se ven todos', () => {
    expect(ids(usuariosVisibles(USERS))).toEqual(['d', 'e1', 'v1', 'v2'])
  })

  it('el filtro deja solo a los de un local', () => {
    expect(ids(usuariosVisibles(USERS, { filtroLocal: 'loc-1' }))).toEqual(['e1', 'v1'])
    expect(ids(usuariosVisibles(USERS, { filtroLocal: 'loc-2' }))).toEqual(['v2'])
  })

  it('el filtro "Sin local" deja a quienes no están asignados a ninguno', () => {
    expect(ids(usuariosVisibles(USERS, { filtroLocal: SIN_LOCAL }))).toEqual(['d'])
  })

  it('dentro de una franquicia se ven solo los de ese local, aunque haya un filtro elegido', () => {
    expect(ids(usuariosVisibles(USERS, { localId: 'loc-2', filtroLocal: 'loc-1' }))).toEqual(['v2'])
  })

  it('compara ids como texto', () => {
    expect(ids(usuariosVisibles([{ id: 'x', local_id: 7 }], { localId: '7' }))).toEqual(['x'])
  })
})
