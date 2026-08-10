package com.gestflow.pos.ui

import androidx.lifecycle.ViewModel
import com.gestflow.pos.core.session.Session
import com.gestflow.pos.core.session.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/**
 * Decide que mostrar en la raiz de la app segun haya o no sesion persistida
 * (Paso 2 del plan: "cerrar y reabrir la app y comprobar que sigue logueado").
 */
@HiltViewModel
class SessionGateViewModel @Inject constructor(
    private val sessionManager: SessionManager,
) : ViewModel() {
    val sessionFlow: StateFlow<Session?> = sessionManager.sessionFlow

    fun logout() = sessionManager.clearSession()
}
