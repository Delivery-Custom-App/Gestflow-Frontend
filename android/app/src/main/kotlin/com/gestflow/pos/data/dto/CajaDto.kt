package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class CajaActivaResponse(
    val caja_id: String? = null,
    val name: String? = null,
    val terminal_id: String? = null,
)
