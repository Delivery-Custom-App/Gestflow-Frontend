package com.gestflow.pos.ui.mesas.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.gestflow.pos.data.dto.MesaResponse
import com.gestflow.pos.domain.model.derivedState
import com.gestflow.pos.ui.theme.label
import com.gestflow.pos.ui.theme.toColor

@Composable
fun MesaCard(
    mesa: MesaResponse,
    onClick: () -> Unit,
    canEdit: Boolean = false,
    canDelete: Boolean = false,
    onEdit: () -> Unit = {},
    onDelete: () -> Unit = {},
) {
    val state = mesa.derivedState()
    val color = state.toColor()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        border = BorderStroke(2.dp, color),
        colors = CardDefaults.cardColors(),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(mesa.name, style = MaterialTheme.typography.titleMedium)
                mesa.capacidad?.let { Text("Capacidad: $it", style = MaterialTheme.typography.bodySmall) }
                Text(state.label(), color = color, style = MaterialTheme.typography.labelLarge)
            }
            if (canEdit) {
                IconButton(onClick = onEdit) {
                    Icon(Icons.Filled.Edit, contentDescription = "Editar mesa")
                }
            }
            if (canDelete) {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Eliminar mesa")
                }
            }
        }
    }
}
