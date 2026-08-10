package com.gestflow.pos.ui.mesas

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.gestflow.pos.data.dto.MesaResponse
import com.gestflow.pos.domain.model.MesaState
import com.gestflow.pos.domain.model.canDeleteMesa
import com.gestflow.pos.domain.model.canManageMesas
import com.gestflow.pos.ui.mesas.components.MesaCard
import com.gestflow.pos.ui.mesas.components.MesasFilterBar
import com.gestflow.pos.ui.mesas.components.MesasKpiRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MesasListScreen(
    role: String?,
    onLogout: () -> Unit,
    onOpenDrawer: () -> Unit,
    onMesaClick: (mesaId: String, state: String) -> Unit,
    viewModel: MesasListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val kpis by viewModel.kpis.collectAsState()
    val formState by viewModel.formState.collectAsState()

    val canManage = role.canManageMesas()
    val canDelete = role.canDeleteMesa()

    var formTarget by remember { mutableStateOf<MesaFormMode?>(null) }
    var deleteTarget by remember { mutableStateOf<MesaResponse?>(null) }

    LaunchedEffect(formState) {
        if (formState is MesaFormUiState.Success) {
            formTarget = null
            deleteTarget = null
            viewModel.resetFormState()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mesas") },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Filled.Menu, contentDescription = "Menú")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Actualizar")
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Filled.ExitToApp, contentDescription = "Cerrar sesión")
                    }
                },
            )
        },
        floatingActionButton = {
            if (canManage) {
                FloatingActionButton(onClick = { formTarget = MesaFormMode.Create }) {
                    Icon(Icons.Filled.Add, contentDescription = "Crear mesa")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp)) {
            MesasKpiRow(kpis)
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 16.dp))

            when (val state = uiState) {
                is MesasUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is MesasUiState.Error -> {
                    Text(state.message, color = MaterialTheme.colorScheme.error)
                }
                is MesasUiState.Success -> {
                    if (state.mesas.isEmpty()) {
                        Text("Este local todavía no tiene mesas creadas")
                    } else {
                        var query by remember { mutableStateOf("") }
                        var selectedState by remember { mutableStateOf<MesaState?>(null) }
                        val filtered = remember(state.mesas, query, selectedState) {
                            applyMesaFilters(state.mesas, query, selectedState)
                        }

                        MesasFilterBar(
                            query = query,
                            onQueryChange = { query = it },
                            selectedState = selectedState,
                            onStateChange = { selectedState = it },
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))

                        if (filtered.isEmpty()) {
                            Text("Ninguna mesa coincide con el filtro")
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 88.dp),
                            ) {
                                items(filtered, key = { it.id }) { mesa ->
                                    MesaCard(
                                        mesa = mesa,
                                        onClick = { onMesaClick(mesa.id, mesa.state) },
                                        canEdit = canManage,
                                        canDelete = canDelete,
                                        onEdit = { formTarget = MesaFormMode.Edit(mesa) },
                                        onDelete = { deleteTarget = mesa },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    formTarget?.let { mode ->
        MesaFormSheet(
            mode = mode,
            formState = formState,
            onDismiss = {
                formTarget = null
                viewModel.resetFormState()
            },
            onSubmit = { name, capacidad ->
                when (mode) {
                    is MesaFormMode.Create -> viewModel.createMesa(name, capacidad)
                    is MesaFormMode.Edit -> viewModel.updateMesa(mode.mesa.id, name, capacidad)
                }
            },
        )
    }

    deleteTarget?.let { mesa ->
        DeleteMesaDialog(
            mesa = mesa,
            formState = formState,
            onDismiss = {
                deleteTarget = null
                viewModel.resetFormState()
            },
            onConfirm = { viewModel.deleteMesa(mesa.id) },
        )
    }
}
