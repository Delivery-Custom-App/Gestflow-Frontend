package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class MercadoPagoPosResponse(
    val id: String,
    val local_id: String,
    val mp_pos_id: String? = null,
    val name: String? = null,
    val pos_id: String? = null,
    val terminal_id: String? = null,
    val operating_mode: String? = null,
    val machine_id: String? = null,
    // access_token vive en esta fila en el backend (select "*") pero nunca se
    // mapea/muestra en la app -- ignoreUnknownKeys descarta el resto de campos.
)

@Serializable
data class MercadoPagoPosCreateRequest(
    val mp_pos_id: String,
    val local_id: String,
    val name: String? = null,
)
