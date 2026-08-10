package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RefreshRequest(
    val refresh_token: String,
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String? = null,
    val role: String,
    val business_id: String? = null,
    val local_id: String? = null,
    val is_active: Boolean,
)

@Serializable
data class LoginResponse(
    val access_token: String,
    val refresh_token: String,
    val user: UserDto,
)
