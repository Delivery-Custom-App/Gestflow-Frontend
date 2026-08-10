package com.gestflow.pos.core.session

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.gestflow.pos.data.dto.LoginResponse
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Persiste la sesion (tokens + datos de usuario) en EncryptedSharedPreferences
 * (guia oficial de Google para datos sensibles -- ver plan seccion 2).
 * Expone un StateFlow para que la UI reaccione a login/logout/expiracion.
 */
@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "gestflow_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val _sessionFlow = MutableStateFlow(loadFromPrefs())
    val sessionFlow: StateFlow<Session?> = _sessionFlow.asStateFlow()

    val currentSession: Session? get() = _sessionFlow.value

    fun saveSession(response: LoginResponse) {
        val session = Session(
            accessToken = response.access_token,
            refreshToken = response.refresh_token,
            userId = response.user.id,
            email = response.user.email,
            name = response.user.name,
            role = response.user.role,
            businessId = response.user.business_id,
            localId = response.user.local_id,
            activeLocalId = response.user.local_id,
        )
        persist(session)
        _sessionFlow.value = session
    }

    fun updateTokens(accessToken: String, refreshToken: String) {
        val current = _sessionFlow.value ?: return
        val updated = current.copy(accessToken = accessToken, refreshToken = refreshToken)
        persist(updated)
        _sessionFlow.value = updated
    }

    fun setActiveLocalId(localId: String) {
        val current = _sessionFlow.value ?: return
        val updated = current.copy(activeLocalId = localId)
        persist(updated)
        _sessionFlow.value = updated
    }

    fun clearSession() {
        prefs.edit().clear().apply()
        _sessionFlow.value = null
    }

    private fun persist(session: Session) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, session.accessToken)
            .putString(KEY_REFRESH_TOKEN, session.refreshToken)
            .putString(KEY_USER_ID, session.userId)
            .putString(KEY_EMAIL, session.email)
            .putString(KEY_NAME, session.name)
            .putString(KEY_ROLE, session.role)
            .putString(KEY_BUSINESS_ID, session.businessId)
            .putString(KEY_LOCAL_ID, session.localId)
            .putString(KEY_ACTIVE_LOCAL_ID, session.activeLocalId)
            .apply()
    }

    private fun loadFromPrefs(): Session? {
        val accessToken = prefs.getString(KEY_ACCESS_TOKEN, null) ?: return null
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null) ?: return null
        val userId = prefs.getString(KEY_USER_ID, null) ?: return null
        val email = prefs.getString(KEY_EMAIL, null) ?: return null
        val role = prefs.getString(KEY_ROLE, null) ?: return null
        return Session(
            accessToken = accessToken,
            refreshToken = refreshToken,
            userId = userId,
            email = email,
            name = prefs.getString(KEY_NAME, null),
            role = role,
            businessId = prefs.getString(KEY_BUSINESS_ID, null),
            localId = prefs.getString(KEY_LOCAL_ID, null),
            activeLocalId = prefs.getString(KEY_ACTIVE_LOCAL_ID, null),
        )
    }

    private companion object {
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_USER_ID = "user_id"
        const val KEY_EMAIL = "email"
        const val KEY_NAME = "name"
        const val KEY_ROLE = "role"
        const val KEY_BUSINESS_ID = "business_id"
        const val KEY_LOCAL_ID = "local_id"
        const val KEY_ACTIVE_LOCAL_ID = "active_local_id"
    }
}
