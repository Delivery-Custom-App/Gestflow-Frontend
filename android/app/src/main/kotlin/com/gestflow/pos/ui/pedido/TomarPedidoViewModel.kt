package com.gestflow.pos.ui.pedido

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestflow.pos.core.error.ApiError
import com.gestflow.pos.data.dto.MenuProductItem
import com.gestflow.pos.data.dto.OrderItemCreateRequest
import com.gestflow.pos.data.dto.PosMenuResponse
import com.gestflow.pos.data.repository.PedidoRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

sealed interface MenuUiState {
    data object Loading : MenuUiState
    data class Success(val menu: PosMenuResponse) : MenuUiState
    data class Error(val message: String) : MenuUiState
}

sealed interface OrderSubmitState {
    data object Idle : OrderSubmitState
    data object Submitting : OrderSubmitState
    data object Success : OrderSubmitState
    data class Error(val message: String) : OrderSubmitState
}

@HiltViewModel
class TomarPedidoViewModel @Inject constructor(
    private val pedidoRepository: PedidoRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val localId: String = checkNotNull(savedStateHandle["localId"])
    val mesaId: String = checkNotNull(savedStateHandle["mesaId"])

    private val _menuState = MutableStateFlow<MenuUiState>(MenuUiState.Loading)
    val menuState: StateFlow<MenuUiState> = _menuState.asStateFlow()

    /** null mientras carga; luego el id de la caja o "" si el usuario no tiene caja asignada. */
    private val _cajaId = MutableStateFlow<String?>(null)
    val cajaId: StateFlow<String?> = _cajaId.asStateFlow()
    private var cajaChecked = false

    private val _cart = MutableStateFlow<Map<String, Int>>(emptyMap())
    val cart: StateFlow<Map<String, Int>> = _cart.asStateFlow()

    private val _orderState = MutableStateFlow<OrderSubmitState>(OrderSubmitState.Idle)
    val orderState: StateFlow<OrderSubmitState> = _orderState.asStateFlow()

    init {
        loadMenu()
        loadCajaActiva()
    }

    private fun loadMenu() {
        viewModelScope.launch {
            _menuState.value = MenuUiState.Loading
            _menuState.value = try {
                MenuUiState.Success(pedidoRepository.getMenu(localId))
            } catch (e: HttpException) {
                MenuUiState.Error(ApiError.from(e))
            } catch (e: Exception) {
                MenuUiState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    private fun loadCajaActiva() {
        viewModelScope.launch {
            _cajaId.value = try {
                pedidoRepository.getCajaActiva(localId).caja_id
            } catch (_: Exception) {
                null
            }
            cajaChecked = true
        }
    }

    /** true solo despues de confirmar que no hay caja (para no bloquear mientras carga). */
    fun hasNoCajaAssigned(): Boolean = cajaChecked && _cajaId.value == null

    fun incrementQty(productId: String) {
        _cart.value = _cart.value.toMutableMap().apply { this[productId] = (this[productId] ?: 0) + 1 }
    }

    fun decrementQty(productId: String) {
        _cart.value = _cart.value.toMutableMap().apply {
            val current = this[productId] ?: return
            if (current <= 1) remove(productId) else this[productId] = current - 1
        }
    }

    private fun allProducts(): List<MenuProductItem> =
        (_menuState.value as? MenuUiState.Success)?.menu?.categories?.flatMap { it.products } ?: emptyList()

    fun cartTotal(): Int {
        val products = allProducts().associateBy { it.id }
        return _cart.value.entries.sumOf { (productId, qty) -> (products[productId]?.price ?: 0) * qty }
    }

    fun confirmOrder() {
        val items = _cart.value
        if (items.isEmpty()) {
            _orderState.value = OrderSubmitState.Error("Agrega al menos un producto")
            return
        }
        val products = allProducts().associateBy { it.id }
        val orderItems = items.mapNotNull { (productId, qty) ->
            val product = products[productId] ?: return@mapNotNull null
            OrderItemCreateRequest(product_id = productId, quantity = qty, unit_price = product.price)
        }
        viewModelScope.launch {
            _orderState.value = OrderSubmitState.Submitting
            _orderState.value = try {
                pedidoRepository.createOrder(localId, mesaId, _cajaId.value, orderItems)
                OrderSubmitState.Success
            } catch (e: HttpException) {
                OrderSubmitState.Error(ApiError.from(e))
            } catch (e: Exception) {
                OrderSubmitState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }
}
