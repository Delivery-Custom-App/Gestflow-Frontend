package com.gestflow.pos.core.network

import com.gestflow.pos.core.session.SessionManager
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * Agrega "Authorization: Bearer <token>" a cada request usando la sesion actual.
 * Sin refresh automatico en 401 todavia (queda para un paso posterior, cuando
 * sea facil de probar deliberadamente) -- por ahora un 401 se maneja en cada
 * ViewModel mostrando el error / forzando logout.
 */
class AuthInterceptor @Inject constructor(
    private val sessionManager: SessionManager,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = sessionManager.currentSession?.accessToken
        val request = if (token != null) {
            original.newBuilder().addHeader("Authorization", "Bearer $token").build()
        } else {
            original
        }
        return chain.proceed(request)
    }
}
