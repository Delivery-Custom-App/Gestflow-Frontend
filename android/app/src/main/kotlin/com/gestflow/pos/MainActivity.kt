package com.gestflow.pos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.gestflow.pos.ui.SessionGateViewModel
import com.gestflow.pos.ui.login.LoginScreen
import com.gestflow.pos.ui.navigation.GestflowNavHost
import dagger.hilt.android.AndroidEntryPoint

/**
 * Paso 3 del plan: navegacion real (Navigation Compose) entre seleccion de
 * local y listado de mesas, detras del gate de sesion.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            GestflowPosApp()
        }
    }
}

@Composable
fun GestflowPosApp(gateViewModel: SessionGateViewModel = hiltViewModel()) {
    val session by gateViewModel.sessionFlow.collectAsState()

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            val currentSession = session
            if (currentSession == null) {
                LoginScreen(onLoginSuccess = { /* sessionFlow ya se actualiza solo */ })
            } else {
                GestflowNavHost(session = currentSession, onLogout = { gateViewModel.logout() })
            }
        }
    }
}
