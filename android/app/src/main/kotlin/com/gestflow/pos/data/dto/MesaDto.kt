package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class MesaResponse(
    val id: String,
    val local_id: String,
    val name: String,
    val numero: Int? = null,
    val capacidad: Int? = null,
    val zona: String? = null,
    val state: String = "libre",
    val is_delivery: Boolean = false,
    val is_active: Boolean = true,
    val created_at: String? = null,
)

@Serializable
data class MesaCreateRequest(
    val local_id: String,
    val name: String,
    val capacidad: Int,
    // El negocio no usa el concepto de zonas -- el backend la acepta opcional,
    // nunca se pide en el formulario.
    val zona: String? = null,
    val is_delivery: Boolean = false,
    val is_active: Boolean = true,
)

@Serializable
data class MesaUpdateRequest(
    val name: String? = null,
    val capacidad: Int? = null,
    val zona: String? = null,
    val is_active: Boolean? = null,
)
