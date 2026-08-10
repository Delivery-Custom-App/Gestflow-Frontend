package com.gestflow.pos.ui.mesas

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.gestflow.pos.data.dto.MesaResponse

sealed interface MesaFormMode {
    data object Create : MesaFormMode
    data class Edit(val mesa: MesaResponse) : MesaFormMode
}

@Composable
fun MesaFormSheet(
    mode: MesaFormMode,
    formState: MesaFormUiState,
    onDismiss: () -> Unit,
    onSubmit: (name: String, capacidad: Int) -> Unit,
) {
    var name by remember { mutableStateOf((mode as? MesaFormMode.Edit)?.mesa?.name ?: "") }
    var capacidadText by remember {
        mutableStateOf((mode as? MesaFormMode.Edit)?.mesa?.capacidad?.toString() ?: "")
    }
    var validationError by remember { mutableStateOf<String?>(null) }

    val saving = formState is MesaFormUiState.Saving

    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text(if (mode is MesaFormMode.Edit) "Editar mesa" else "Nueva mesa") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nombre") },
                    singleLine = true,
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth(),
                )
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                OutlinedTextField(
                    value = capacidadText,
                    onValueChange = { capacidadText = it.filter { c -> c.isDigit() } },
                    label = { Text("Capacidad") },
                    singleLine = true,
                    enabled = !saving,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                val error = validationError ?: (formState as? MesaFormUiState.Error)?.message
                if (error != null) {
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                    Text(error, color = MaterialTheme.colorScheme.error)
                }
                if (saving) {
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                    CircularProgressIndicator()
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !saving,
                onClick = {
                    val capacidad = capacidadText.toIntOrNull()
                    validationError = when {
                        name.isBlank() -> "El nombre es obligatorio"
                        capacidad == null || capacidad <= 0 -> "La capacidad debe ser mayor a 0"
                        else -> null
                    }
                    if (validationError == null && capacidad != null) {
                        onSubmit(name.trim(), capacidad)
                    }
                },
            ) {
                Text("Guardar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !saving) {
                Text("Cancelar")
            }
        },
    )
}
