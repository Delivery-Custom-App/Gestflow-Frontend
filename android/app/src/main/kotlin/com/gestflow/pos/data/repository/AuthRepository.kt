package com.gestflow.pos.data.repository

import com.gestflow.pos.core.session.SessionManager
import com.gestflow.pos.data.dto.LoginRequest
import com.gestflow.pos.data.remote.AuthApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val sessionManager: SessionManager,
) {
    suspend fun login(email: String, password: String) {
        val response = authApi.login(LoginRequest(email, password))
        sessionManager.saveSession(response)
    }

    fun logout() {
        sessionManager.clearSession()
    }
}
