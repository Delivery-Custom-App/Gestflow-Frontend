package com.gestflow.pos.ui.configuracion

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestflow.pos.core.error.ApiError
import com.gestflow.pos.data.dto.MercadoPagoPosResponse
import com.gestflow.pos.data.repository.MercadoPagoPosRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

sealed interface PosListUiState {
    data object Loading : PosListUiState
    data class Success(val devices: List<MercadoPagoPosResponse>) : PosListUiState
    data class Error(val message: String) : PosListUiState
}

sealed interface PosActionState {
    data object Idle : PosActionState
    data object Saving : PosActionState
    data class Error(val message: String) : PosActionState
}

@HiltViewModel
class ConfiguracionViewModel @Inject constructor(
    private val repository: MercadoPagoPosRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val localId: String = checkNotNull(savedStateHandle["localId"])

    private val _uiState = MutableStateFlow<PosListUiState>(PosListUiState.Loading)
    val uiState: StateFlow<PosListUiState> = _uiState.asStateFlow()

    private val _actionState = MutableStateFlow<PosActionState>(PosActionState.Idle)
    val actionState: StateFlow<PosActionState> = _actionState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = PosListUiState.Loading
            _uiState.value = try {
                PosListUiState.Success(repository.list(localId))
            } catch (e: HttpException) {
                PosListUiState.Error(ApiError.from(e))
            } catch (e: Exception) {
                PosListUiState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    fun linkDevice(mpPosId: String, name: String?) {
        viewModelScope.launch {
            _actionState.value = PosActionState.Saving
            _actionState.value = try {
                repository.link(localId, mpPosId, name)
                refresh()
                PosActionState.Idle
            } catch (e: HttpException) {
                PosActionState.Error(ApiError.from(e))
            } catch (e: Exception) {
                PosActionState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    fun unlinkDevice(posId: String) {
        viewModelScope.launch {
            _actionState.value = PosActionState.Saving
            _actionState.value = try {
                repository.unlink(posId)
                refresh()
                PosActionState.Idle
            } catch (e: HttpException) {
                PosActionState.Error(ApiError.from(e))
            } catch (e: Exception) {
                PosActionState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    fun resetActionState() {
        _actionState.value = PosActionState.Idle
    }
}
