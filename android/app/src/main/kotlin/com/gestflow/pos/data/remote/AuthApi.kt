package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.LoginRequest
import com.gestflow.pos.data.dto.LoginResponse
import com.gestflow.pos.data.dto.RefreshRequest
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("api/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): LoginResponse
}
