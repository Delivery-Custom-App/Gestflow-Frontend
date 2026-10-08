/**
 * Alta de usuarios: quién crea, qué roles ofrece, cómo se valida y qué se
 * envía. El RUT depende de la bandera `userRut` (el backend aún no lo guarda).
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  ROL_LABEL, datosDeAlta, nombreVisible, pideRut, puedeCrearUsuarios, rolConLocal, rolesAsignables, validarAlta,
} from './altaUsuario'
import { V2_FEATURES } from './v2Features'

const original = { ...V2_FEATURES }
afterEach(() => Object.assign(V2_FEATURES, original))

const VALIDO = {
  nombre: 'Juan', apellido: 'Pérez', rut: '', email: 'juan@demo.cl', password: '12345678', role: 'EMPLEADO', local_id: 'loc-1',
}

describe('quién crea usuarios y con qué roles', () => {
  it('el dueño crea encargados y vendedores', () => {
    expect(puedeCrearUsuarios('Admin Negocio')).toBe(true)
    expect(rolesAsignables('Admin Negocio')).toEqual(['ADMIN', 'EMPLEADO'])
  })

  it('el superadmin además crea dueños', () => {
    expect(puedeCrearUsuarios('Superadmin')).toBe(true)
    expect(rolesAsignables('Superadmin')).toEqual(['SUPERADMIN', 'ADMIN_NEGOCIO', 'ADMIN', 'EMPLEADO'])
  })

  it('el encargado y el vendedor no crean usuarios: el backend les responde 403', () => {
    for (const rol of ['Admin', 'Empleado', 'Cajero']) {
      expect(puedeCrearUsuarios(rol)).toBe(false)
      expect(rolesAsignables(rol)).toEqual([])
    }
  })

  it('solo se nombran roles que el backend guarda: no existe "Cajero"', () => {
    expect(Object.keys(ROL_LABEL)).toEqual(['SUPERADMIN', 'ADMIN_NEGOCIO', 'ADMIN', 'EMPLEADO'])
    expect(Object.values(ROL_LABEL)).not.toContain('Cajero')
    expect(ROL_LABEL.ADMIN).toBe('Encargado de local')
    expect(ROL_LABEL.EMPLEADO).toBe('Vendedor')
  })

  it('el dueño y el superadmin no se atan a un local', () => {
    expect(rolConLocal('EMPLEADO')).toBe(true)
    expect(rolConLocal('ADMIN')).toBe(true)
    expect(rolConLocal('ADMIN_NEGOCIO')).toBe(false)
    expect(rolConLocal('SUPERADMIN')).toBe(false)
  })
})

describe('validarAlta', () => {
  it('un formulario completo se puede enviar', () => {
    expect(validarAlta(VALIDO)).toBeNull()
  })

  it('el nombre es obligatorio; el apellido no', () => {
    expect(validarAlta({ ...VALIDO, nombre: '  ' })).toBe('Ingresa el nombre.')
    expect(validarAlta({ ...VALIDO, apellido: '' })).toBeNull()
  })

  it('la contraseña exige 8 caracteres, como el backend', () => {
    expect(validarAlta({ ...VALIDO, password: '1234567' })).toBe('La contraseña debe tener al menos 8 caracteres.')
    expect(validarAlta({ ...VALIDO, password: '12345678' })).toBeNull()
  })

  it('un encargado o un vendedor necesitan su local; un dueño no', () => {
    expect(validarAlta({ ...VALIDO, local_id: '' })).toBe('Selecciona el local al que pertenece este usuario.')
    expect(validarAlta({ ...VALIDO, role: 'ADMIN_NEGOCIO', local_id: '' })).toBeNull()
  })

  it('con la bandera apagada no se pide RUT', () => {
    expect(pideRut()).toBe(false)
    expect(validarAlta({ ...VALIDO, rut: '' })).toBeNull()
  })

  it('con la bandera encendida el RUT es obligatorio y se valida el dígito verificador', () => {
    V2_FEATURES.userRut = true
    expect(validarAlta({ ...VALIDO, rut: '' })).toBe('Ingresa el RUT.')
    expect(validarAlta({ ...VALIDO, rut: '12.345.678-9' })).toBe('RUT inválido (dígito verificador incorrecto).')
    expect(validarAlta({ ...VALIDO, rut: '12.345.678-5' })).toBeNull()
  })
})

describe('datosDeAlta', () => {
  it('el nombre viaja como first_name y last_name', () => {
    const datos = datosDeAlta(VALIDO, { business_id: 'b-1' })
    expect(datos).toMatchObject({
      first_name: 'Juan', last_name: 'Pérez', email: 'juan@demo.cl', role: 'EMPLEADO', local_id: 'loc-1', business_id: 'b-1',
    })
  })

  it('sin apellido last_name va vacío, no como texto en blanco', () => {
    expect(datosDeAlta({ ...VALIDO, apellido: '  ' }, null).last_name).toBeNull()
  })

  it('con la bandera apagada no se envía el RUT', () => {
    expect(datosDeAlta({ ...VALIDO, rut: '12.345.678-5' }, null)).not.toHaveProperty('rut')
  })

  it('con la bandera encendida el RUT viaja sin puntos ni guion', () => {
    V2_FEATURES.userRut = true
    expect(datosDeAlta({ ...VALIDO, rut: '12.345.678-5' }, null).rut).toBe('123456785')
  })

  it('un dueño se crea sin local', () => {
    expect(datosDeAlta({ ...VALIDO, role: 'ADMIN_NEGOCIO' }, null).local_id).toBeNull()
  })
})

describe('nombreVisible', () => {
  it('muestra nombre y apellido', () => {
    expect(nombreVisible({ first_name: 'Juan', last_name: 'Pérez', email: 'x@y.cl' })).toBe('Juan Pérez')
  })

  it('sin nombre cargado lo arma con el correo, como antes', () => {
    expect(nombreVisible({ email: 'centro.admin@demo.gestflow.dev' })).toBe('Centro Admin')
    expect(nombreVisible(null)).toBe('—')
  })
})
