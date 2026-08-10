package com.gestflow.pos.data.repository

import com.gestflow.pos.data.dto.MercadoPagoPosCreateRequest
import com.gestflow.pos.data.dto.MercadoPagoPosResponse
import com.gestflow.pos.data.remote.WebhooksApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MercadoPagoPosRepository @Inject constructor(
    private val webhooksApi: WebhooksApi,
) {
    suspend fun list(localId: String): List<MercadoPagoPosResponse> = webhooksApi.listMercadoPagoPos(localId)

    suspend fun link(localId: String, mpPosId: String, name: String?): MercadoPagoPosResponse =
        webhooksApi.createMercadoPagoPos(MercadoPagoPosCreateRequest(mp_pos_id = mpPosId, local_id = localId, name = name))

    suspend fun unlink(posId: String) {
        webhooksApi.deleteMercadoPagoPos(posId)
    }
}
