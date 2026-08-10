package com.gestflow.pos.ui.localselect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestflow.pos.core.error.ApiError
import com.gestflow.pos.core.session.SessionManager
import com.gestflow.pos.data.dto.LocalResponse
import com.gestflow.pos.data.repository.LocalsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

sealed interface SelectLocalUiState {
    data object Loading : SelectLocalUiState
    data class Success(val locals: List<LocalResponse>) : SelectLocalUiState
    data class Error(val message: String) : SelectLocalUiState
}

@HiltViewModel
class SelectLocalViewModel @Inject constructor(
    private val localsRepository: LocalsRepository,
    private val sessionManager: SessionManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow<SelectLocalUiState>(SelectLocalUiState.Loading)
    val uiState: StateFlow<SelectLocalUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        val businessId = sessionManager.currentSession?.businessId
        if (businessId == null) {
            _uiState.value = SelectLocalUiState.Error("Tu usuario no tiene un negocio asociado")
            return
        }
        viewModelScope.launch {
            _uiState.value = SelectLocalUiState.Loading
            _uiState.value = try {
                SelectLocalUiState.Success(localsRepository.listLocals(businessId))
            } catch (e: HttpException) {
                SelectLocalUiState.Error(ApiError.from(e))
            } catch (e: Exception) {
                SelectLocalUiState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }

    fun selectLocal(localId: String) {
        sessionManager.setActiveLocalId(localId)
    }
}
