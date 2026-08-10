package com.gestflow.pos.core.session

/**
 * Sesion activa. [activeLocalId] es el local elegido por el usuario para operar
 * (puede diferir de [localId], que es el local fijo asignado al usuario en el
 * backend -- ver SelectLocalScreen para ADMIN/SUPERADMIN con varios locales).
 */
data class Session(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
    val name: String?,
    val role: String,
    val businessId: String?,
    val localId: String?,
    val activeLocalId: String? = localId,
)
