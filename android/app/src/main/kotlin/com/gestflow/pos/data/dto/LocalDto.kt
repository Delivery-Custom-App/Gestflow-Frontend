package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class LocalResponse(
    val id: String,
    val business_id: String,
    val name: String,
    val address: String? = null,
    val phone: String? = null,
)
