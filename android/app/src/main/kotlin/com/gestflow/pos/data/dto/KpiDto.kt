package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class MesasKpiResponse(
    val local_id: String,
    val total: Int,
    val libres: Int,
    val ocupadas: Int,
    val en_cobro: Int,
    val generated_at: String,
)
