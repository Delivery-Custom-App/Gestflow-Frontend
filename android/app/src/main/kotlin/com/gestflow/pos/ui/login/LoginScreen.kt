package com.gestflow.pos.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is LoginUiState.Success) {
            onLoginSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Gestflow POS", style = MaterialTheme.typography.headlineMedium)

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 32.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Contraseña") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 20.dp))

        val loading = uiState is LoginUiState.Loading
        Button(
            onClick = { viewModel.login(email, password) },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.padding(2.dp))
            } else {
                Text("Ingresar")
            }
        }

        val errorState = uiState
        if (errorState is LoginUiState.Error) {
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))
            Text(
                text = errorState.message,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}
