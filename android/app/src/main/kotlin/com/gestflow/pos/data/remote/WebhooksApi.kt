package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.MercadoPagoPosCreateRequest
import com.gestflow.pos.data.dto.MercadoPagoPosResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Nombrado "Webhooks" porque asi vive el router en el backend (webhooks.py). */
interface WebhooksApi {
    @GET("api/webhooks/mercadopago-pos")
    suspend fun listMercadoPagoPos(@Query("local_id") localId: String): List<MercadoPagoPosResponse>

    @POST("api/webhooks/mercadopago-pos")
    suspend fun createMercadoPagoPos(@Body body: MercadoPagoPosCreateRequest): MercadoPagoPosResponse

    @DELETE("api/webhooks/mercadopago-pos/{posId}")
    suspend fun deleteMercadoPagoPos(@Path("posId") posId: String)
}
