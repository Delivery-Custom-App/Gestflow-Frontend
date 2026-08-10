package com.gestflow.pos.ui.mesas.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.gestflow.pos.domain.model.MesaState
import com.gestflow.pos.ui.theme.label

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MesasFilterBar(
    query: String,
    onQueryChange: (String) -> Unit,
    selectedState: MesaState?,
    onStateChange: (MesaState?) -> Unit,
) {
    Column {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Buscar por nombre o número") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            singleLine = true,
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FilterChip(
                    selected = selectedState == null,
                    onClick = { onStateChange(null) },
                    label = { Text("Todas") },
                )
            }
            items(MesaState.entries) { state ->
                FilterChip(
                    selected = selectedState == state,
                    onClick = { onStateChange(if (selectedState == state) null else state) },
                    label = { Text(state.label()) },
                )
            }
        }
    }
}
