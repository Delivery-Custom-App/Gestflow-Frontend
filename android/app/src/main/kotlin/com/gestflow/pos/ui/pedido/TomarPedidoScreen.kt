package com.gestflow.pos.ui.pedido

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import com.gestflow.pos.data.dto.MenuCategoryGroup
import com.gestflow.pos.data.dto.MenuProductItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TomarPedidoScreen(
    onBack: () -> Unit,
    onOrderCreated: () -> Unit,
    viewModel: TomarPedidoViewModel = hiltViewModel(),
) {
    val menuState by viewModel.menuState.collectAsState()
    val cajaId by viewModel.cajaId.collectAsState()
    val cart by viewModel.cart.collectAsState()
    val orderState by viewModel.orderState.collectAsState()

    LaunchedEffect(orderState) {
        if (orderState is OrderSubmitState.Success) onOrderCreated()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tomar pedido") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Volver")
                    }
                },
            )
        },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                Column(modifier = Modifier.padding(16.dp)) {
                    if (viewModel.hasNoCajaAssigned()) {
                        Text(
                            "No tienes una caja asignada en este local. Contacta a un administrador.",
                            color = MaterialTheme.colorScheme.error,
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                    }
                    if (orderState is OrderSubmitState.Error) {
                        Text((orderState as OrderSubmitState.Error).message, color = MaterialTheme.colorScheme.error)
                        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Total: $${viewModel.cartTotal()}", style = MaterialTheme.typography.titleMedium)
                        Button(
                            onClick = { viewModel.confirmOrder() },
                            enabled = cart.isNotEmpty() &&
                                !viewModel.hasNoCajaAssigned() &&
                                orderState !is OrderSubmitState.Submitting,
                        ) {
                            if (orderState is OrderSubmitState.Submitting) {
                                CircularProgressIndicator(modifier = Modifier.padding(2.dp))
                            } else {
                                Text("Confirmar pedido")
                            }
                        }
                    }
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (val state = menuState) {
                is MenuUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is MenuUiState.Error -> {
                    Text(state.message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
                }
                is MenuUiState.Success -> {
                    if (state.menu.categories.isEmpty()) {
                        Text("Este local todavía no tiene productos en el menú", modifier = Modifier.padding(16.dp))
                    } else {
                        // Todas las categorías empiezan expandidas; el usuario puede contraerlas.
                        var collapsed by remember { mutableStateOf(setOf<String>()) }

                        LazyColumn(modifier = Modifier.padding(16.dp)) {
                            state.menu.categories.forEach { category ->
                                item(key = "header_${category.id}") {
                                    CategoryHeader(
                                        category = category,
                                        expanded = category.id !in collapsed,
                                        onToggle = {
                                            collapsed = if (category.id in collapsed) {
                                                collapsed - category.id
                                            } else {
                                                collapsed + category.id
                                            }
                                        },
                                    )
                                }
                                if (category.id !in collapsed) {
                                    items(category.products, key = { it.id }) { product ->
                                        ProductRow(
                                            product = product,
                                            qty = cart[product.id] ?: 0,
                                            onIncrement = { viewModel.incrementQty(product.id) },
                                            onDecrement = { viewModel.decrementQty(product.id) },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryHeader(
    category: MenuCategoryGroup,
    expanded: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(top = 12.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "${category.name} (${category.product_count})",
            style = MaterialTheme.typography.titleMedium,
        )
        Icon(
            imageVector = if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
            contentDescription = if (expanded) "Contraer" else "Expandir",
        )
    }
}

@Composable
private fun ProductRow(
    product: MenuProductItem,
    qty: Int,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.padding(end = 8.dp)) {
            Text(product.name, style = MaterialTheme.typography.bodyLarge)
            Text("$${product.price}", style = MaterialTheme.typography.bodySmall)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onDecrement, enabled = qty > 0) {
                Text("−", style = MaterialTheme.typography.titleLarge)
            }
            Text("$qty", style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = onIncrement) {
                Icon(Icons.Filled.Add, contentDescription = "Agregar")
            }
        }
    }
}
