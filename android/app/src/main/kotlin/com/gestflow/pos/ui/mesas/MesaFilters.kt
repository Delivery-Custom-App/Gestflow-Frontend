package com.gestflow.pos.ui.mesas

import com.gestflow.pos.data.dto.MesaResponse
import com.gestflow.pos.domain.model.MesaState
import com.gestflow.pos.domain.model.derivedState

/**
 * Filtro 100% client-side sobre la lista de mesas ya cargada (igual que
 * MesasFilters.jsx en el frontend web -- no hay endpoint de filtro server-side).
 * Sin filtro de zona: el negocio no usa el concepto de zonas, solo mesas.
 */
fun applyMesaFilters(
    mesas: List<MesaResponse>,
    query: String,
    state: MesaState?,
): List<MesaResponse> {
    val trimmedQuery = query.trim()
    return mesas.filter { mesa ->
        val matchesQuery = trimmedQuery.isEmpty() ||
            mesa.name.contains(trimmedQuery, ignoreCase = true) ||
            mesa.numero?.toString() == trimmedQuery
        val matchesState = state == null || mesa.derivedState() == state
        matchesQuery && matchesState
    }
}
