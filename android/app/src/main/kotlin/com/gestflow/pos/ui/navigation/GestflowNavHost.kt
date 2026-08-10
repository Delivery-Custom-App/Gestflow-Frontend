package com.gestflow.pos.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.gestflow.pos.core.session.Session
import com.gestflow.pos.domain.model.canManageMesas
import com.gestflow.pos.ui.configuracion.ConfiguracionScreen
import com.gestflow.pos.ui.localselect.SelectLocalScreen
import com.gestflow.pos.ui.mesas.MesasListScreen
import com.gestflow.pos.ui.pedido.TomarPedidoScreen
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GestflowNavHost(session: Session, onLogout: () -> Unit) {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val startDestination = session.activeLocalId?.let { Routes.mesas(it) } ?: Routes.SELECT_LOCAL
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route

    fun openDrawer() = scope.launch { drawerState.open() }
    fun closeDrawer() = scope.launch { drawerState.close() }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = session.activeLocalId != null,
        drawerContent = {
            ModalDrawerSheet {
                Text(
                    "Gestflow POS",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = androidx.compose.ui.Modifier.padding(16.dp),
                )
                HorizontalDivider()
                NavigationDrawerItem(
                    label = { Text("Mesas") },
                    selected = currentRoute == Routes.MESAS,
                    onClick = {
                        closeDrawer()
                        session.activeLocalId?.let { navController.navigate(Routes.mesas(it)) }
                    },
                    modifier = androidx.compose.ui.Modifier.padding(horizontal = 12.dp),
                )
                if (session.role.canManageMesas()) {
                    NavigationDrawerItem(
                        label = { Text("Configuración") },
                        selected = currentRoute == Routes.CONFIGURACION,
                        onClick = {
                            closeDrawer()
                            session.activeLocalId?.let { navController.navigate(Routes.configuracion(it)) }
                        },
                        modifier = androidx.compose.ui.Modifier.padding(horizontal = 12.dp),
                    )
                }
            }
        },
    ) {
        NavHost(navController = navController, startDestination = startDestination) {
            composable(Routes.SELECT_LOCAL) {
                SelectLocalScreen(
                    onLocalSelected = { localId ->
                        navController.navigate(Routes.mesas(localId)) {
                            popUpTo(Routes.SELECT_LOCAL) { inclusive = true }
                        }
                    },
                )
            }
            composable(
                route = Routes.MESAS,
                arguments = listOf(navArgument("localId") { type = NavType.StringType }),
            ) { backStackEntry ->
                val localId = checkNotNull(backStackEntry.arguments?.getString("localId"))
                MesasListScreen(
                    role = session.role,
                    onLogout = onLogout,
                    onOpenDrawer = { openDrawer() },
                    onMesaClick = { mesaId, state ->
                        if (state.lowercase() == "libre") {
                            navController.navigate(Routes.pedido(localId, mesaId))
                        }
                        // Detalle de orden para mesa ocupada/en_cobro llega en el Paso 7 del plan.
                    },
                )
            }
            composable(
                route = Routes.PEDIDO,
                arguments = listOf(
                    navArgument("localId") { type = NavType.StringType },
                    navArgument("mesaId") { type = NavType.StringType },
                ),
            ) {
                TomarPedidoScreen(
                    onBack = { navController.popBackStack() },
                    onOrderCreated = { navController.popBackStack() },
                )
            }
            composable(
                route = Routes.CONFIGURACION,
                arguments = listOf(navArgument("localId") { type = NavType.StringType }),
            ) {
                ConfiguracionScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
