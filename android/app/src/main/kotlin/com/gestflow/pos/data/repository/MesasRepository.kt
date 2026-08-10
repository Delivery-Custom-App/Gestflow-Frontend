package com.gestflow.pos.data.repository

import com.gestflow.pos.data.dto.MesaCreateRequest
import com.gestflow.pos.data.dto.MesaResponse
import com.gestflow.pos.data.dto.MesaUpdateRequest
import com.gestflow.pos.data.dto.MesasKpiResponse
import com.gestflow.pos.data.remote.DashboardApi
import com.gestflow.pos.data.remote.MesasApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MesasRepository @Inject constructor(
    private val mesasApi: MesasApi,
    private val dashboardApi: DashboardApi,
) {
    suspend fun listMesas(localId: String): List<MesaResponse> =
        mesasApi.listMesas(localId, withState = true)

    suspend fun getKpis(localId: String): MesasKpiResponse =
        dashboardApi.getMesasKpis(localId)

    suspend fun createMesa(localId: String, name: String, capacidad: Int): MesaResponse =
        mesasApi.createMesa(MesaCreateRequest(local_id = localId, name = name, capacidad = capacidad))

    suspend fun updateMesa(mesaId: String, name: String, capacidad: Int): MesaResponse =
        mesasApi.updateMesa(mesaId, MesaUpdateRequest(name = name, capacidad = capacidad))

    suspend fun deleteMesa(mesaId: String) {
        mesasApi.deleteMesa(mesaId)
    }
}
