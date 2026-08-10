package com.gestflow.pos.domain.model

/**
 * Reglas confirmadas contra el backend real (mesas.py): crear/editar mesa
 * acepta ADMIN o SUPERADMIN; eliminar exige SUPERADMIN estricto (mas
 * restrictivo que "ADMIN o superior").
 */
fun String?.canManageMesas(): Boolean = this == "ADMIN" || this == "SUPERADMIN"

fun String?.canDeleteMesa(): Boolean = this == "SUPERADMIN"
