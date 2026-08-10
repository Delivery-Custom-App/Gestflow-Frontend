package com.gestflow.pos.ui.mesas

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import com.gestflow.pos.data.dto.MesaResponse

@Composable
fun DeleteMesaDialog(
    mesa: MesaResponse,
    formState: MesaFormUiState,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    val saving = formState is MesaFormUiState.Saving
    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text("Eliminar mesa") },
        text = {
            Text(
                buildString {
                    append("¿Eliminar \"${mesa.name}\"? Esta acción no se puede deshacer.")
                    if (formState is MesaFormUiState.Error) {
                        append("\n\n")
                        append(formState.message)
                    }
                },
                color = if (formState is MesaFormUiState.Error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !saving) {
                Text("Eliminar", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !saving) {
                Text("Cancelar")
            }
        },
    )
}
