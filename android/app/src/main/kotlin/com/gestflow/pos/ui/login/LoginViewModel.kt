package com.gestflow.pos.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.gestflow.pos.core.error.ApiError
import com.gestflow.pos.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

sealed interface LoginUiState {
    data object Idle : LoginUiState
    data object Loading : LoginUiState
    data object Success : LoginUiState
    data class Error(val message: String) : LoginUiState
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = LoginUiState.Error("Ingresa email y contraseña")
            return
        }
        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading
            _uiState.value = try {
                authRepository.login(email.trim(), password)
                LoginUiState.Success
            } catch (e: HttpException) {
                LoginUiState.Error(ApiError.from(e))
            } catch (e: Exception) {
                LoginUiState.Error("No se pudo conectar: ${e.message}")
            }
        }
    }
}
