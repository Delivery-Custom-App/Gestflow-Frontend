package com.gestflow.pos.ui.mesas

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestflow.pos.core.error.ApiError
import com.gestflow.pos.data.dto.MesaResponse
import com.gestflow.pos.data.dto.MesasKpiResponse
import com.gestflow.pos.data.repository.MesasRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

sealed interface MesasUiState {
    data object Loading : MesasUiState
    data class Success(val mesas: List<MesaResponse>) : MesasUiState
    data class Error(val message: String) : MesasUiState
}

sealed interface MesaFormUiState {
    data object Idle : MesaFormUiState
    data object Saving : MesaFormUiState
    data object Success : MesaFormUiState
    data class Error(val message: String) : MesaFormUiState
}

private const val KPI_POLL_INTERVAL_MS = 30_000L

@HiltViewModel
class MesasListViewModel @Inject constructor(
    private val mesasRepository: MesasRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val localId: String = checkNotNull(savedStateHandle["localId"])

    private val _uiState = MutableStateFlow<MesasUiState>(MesasUiState.Loading)
    val uiState: StateFlow<MesasUiState> = _uiState.asStateFlow()

    private val _kpis = MutableStateFlow<MesasKpiResponse?>(null)
    val kpis: StateFlow<MesasKpiResponse?> = _kpis.asStateFlow()

    private val _formState = MutableStateFlow<MesaFormUiState>(MesaFormUiState.Idle)
    val formState: StateFlow<MesaFormUiState> = _formState.asStateFlow()

    init {
        refresh()
        pollKpis()
    }

    fun resetFormState() {
        _formState.value = MesaFormUiState.Idle
    }

    fun createMesa(name: String, capacidad: Int) {
        submitForm { mesasRepository.createMesa(localId, name, capacidad) }
    }

    fun updateMesa(mesaId: String, name: String, capacidad: Int) {
        submitForm { mesasRepository.updateMesa(mesaId, name, capacidad) }
    }

    fun deleteMesa(mesaId: String) {
        submitForm { mesasRepository.deleteMesa(mesaId) }
    }

    private fun submitForm(action: suspend () -> Unit) {
        viewModelScope.launch {
            _formState.value = MesaFormUiState.Saving
            _formState.value = try {
                action()
                refresh()
                refreshKpisOnce()
                MesaFormUiState.Success
            } catch (e: HttpException) {
                MesaFormUiState.Error(ApiError.from(e))
            } catch (e: Exception) {
                MesaFormUiState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    private suspend fun refreshKpisOnce() {
        try {
            _kpis.value = mesasRepository.getKpis(localId)
        } catch (_: Exception) {
            // No critico, el polling regular lo reintenta.
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = MesasUiState.Loading
            _uiState.value = try {
                MesasUiState.Success(mesasRepository.listMesas(localId))
            } catch (e: HttpException) {
                MesasUiState.Error(ApiError.from(e))
            } catch (e: Exception) {
                MesasUiState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    private fun pollKpis() {
        viewModelScope.launch {
            while (true) {
                try {
                    _kpis.value = mesasRepository.getKpis(localId)
                } catch (_: Exception) {
                    // KPIs no son criticos -- si falla, se reintenta en el proximo ciclo.
                }
                delay(KPI_POLL_INTERVAL_MS)
            }
        }
    }
}
