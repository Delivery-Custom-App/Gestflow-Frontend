package com.gestflow.pos.data.repository

import com.gestflow.pos.data.dto.CajaActivaResponse
import com.gestflow.pos.data.dto.OrderCreateRequest
import com.gestflow.pos.data.dto.OrderItemCreateRequest
import com.gestflow.pos.data.dto.OrderResponse
import com.gestflow.pos.data.dto.PosMenuResponse
import com.gestflow.pos.data.remote.CajasApi
import com.gestflow.pos.data.remote.DashboardApi
import com.gestflow.pos.data.remote.OrdersApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PedidoRepository @Inject constructor(
    private val dashboardApi: DashboardApi,
    private val cajasApi: CajasApi,
    private val ordersApi: OrdersApi,
) {
    suspend fun getMenu(localId: String): PosMenuResponse = dashboardApi.getMenu(localId)

    suspend fun getCajaActiva(localId: String): CajaActivaResponse = cajasApi.getCajaActiva(localId)

    suspend fun createOrder(
        localId: String,
        mesaId: String,
        cajaId: String?,
        items: List<OrderItemCreateRequest>,
    ): OrderResponse = ordersApi.createOrder(
        OrderCreateRequest(local_id = localId, mesa_id = mesaId, caja_id = cajaId, items = items),
    )
}
