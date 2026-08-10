package com.gestflow.pos.ui.localselect

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun SelectLocalScreen(
    onLocalSelected: (String) -> Unit,
    viewModel: SelectLocalViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Elegí un local", style = MaterialTheme.typography.headlineSmall)
        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 16.dp))

        when (val state = uiState) {
            is SelectLocalUiState.Loading -> {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            is SelectLocalUiState.Error -> {
                Text(state.message, color = MaterialTheme.colorScheme.error)
            }
            is SelectLocalUiState.Success -> {
                if (state.locals.isEmpty()) {
                    Text("No hay locales disponibles para tu negocio")
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.locals) { local ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        viewModel.selectLocal(local.id)
                                        onLocalSelected(local.id)
                                    },
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(local.name, style = MaterialTheme.typography.titleMedium)
                                    local.address?.let { Text(it) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
