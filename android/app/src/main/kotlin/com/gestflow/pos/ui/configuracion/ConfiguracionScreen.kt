package com.gestflow.pos.ui.configuracion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.gestflow.pos.data.dto.MercadoPagoPosResponse

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfiguracionScreen(
    onBack: () -> Unit,
    viewModel: ConfiguracionViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val actionState by viewModel.actionState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    LaunchedEffect(actionState) {
        if (actionState is PosActionState.Idle) showAddDialog = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Configuración") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Vincular terminal")
            }
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp)) {
            Text("Terminales MercadoPago", style = MaterialTheme.typography.titleMedium)
            Text(
                "Lectores de tarjeta vinculados a este local para cobrar pedidos.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 16.dp))

            when (val state = uiState) {
                is PosListUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is PosListUiState.Error -> {
                    Text(state.message, color = MaterialTheme.colorScheme.error)
                }
                is PosListUiState.Success -> {
                    if (state.devices.isEmpty()) {
                        Text("No hay terminales vinculados todavía. Usa el botón + para agregar uno.")
                    } else {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(state.devices, key = { it.id }) { device ->
                                MercadoPagoPosCard(
                                    device = device,
                                    onDelete = { viewModel.unlinkDevice(device.id) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AddPosDialog(
            actionState = actionState,
            onDismiss = {
                showAddDialog = false
                viewModel.resetActionState()
            },
            onSubmit = { mpPosId, name -> viewModel.linkDevice(mpPosId, name) },
        )
    }
}

@Composable
private fun MercadoPagoPosCard(device: MercadoPagoPosResponse, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    device.name ?: "POS ${device.machine_id ?: device.mp_pos_id ?: device.id}",
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    "Modo: ${device.operating_mode ?: "STANDALONE"}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Desvincular")
            }
        }
    }
}

@Composable
private fun AddPosDialog(
    actionState: PosActionState,
    onDismiss: () -> Unit,
    onSubmit: (mpPosId: String, name: String?) -> Unit,
) {
    var mpPosId by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    val saving = actionState is PosActionState.Saving

    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text("Vincular terminal MercadoPago") },
        text = {
            Column {
                Text(
                    "Usa el ID del dispositivo desde el panel de MercadoPago (ej: PAX_A920__12345678).",
                    style = MaterialTheme.typography.bodySmall,
                )
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                OutlinedTextField(
                    value = mpPosId,
                    onValueChange = { mpPosId = it },
                    label = { Text("ID del dispositivo") },
                    singleLine = true,
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth(),
                )
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nombre del terminal (opcional)") },
                    singleLine = true,
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (actionState is PosActionState.Error) {
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                    Text(actionState.message, color = MaterialTheme.colorScheme.error)
                }
                if (saving) {
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                    CircularProgressIndicator()
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !saving && mpPosId.isNotBlank(),
                onClick = { onSubmit(mpPosId.trim(), name.trim().ifBlank { null }) },
            ) {
                Text("Vincular")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !saving) {
                Text("Cancelar")
            }
        },
    )
}
