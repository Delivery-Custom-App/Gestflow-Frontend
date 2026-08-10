package com.gestflow.pos.domain.model

import com.gestflow.pos.data.dto.MesaResponse

enum class MesaState {
    LIBRE,
    OCUPADA,
    EN_COBRO,
    INACTIVA,
}

/**
 * Mismo criterio que MesasVisualization.jsx (web): si is_active es false, gana
 * "inactiva" sin importar el state calculado; si no, usa mesa.state (default libre).
 */
fun MesaResponse.derivedState(): MesaState {
    if (!is_active) return MesaState.INACTIVA
    return when (state.lowercase()) {
        "ocupada" -> MesaState.OCUPADA
        "en_cobro" -> MesaState.EN_COBRO
        else -> MesaState.LIBRE
    }
}
