package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.CajaActivaResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface CajasApi {
    @GET("api/cajas/activa")
    suspend fun getCajaActiva(@Query("local_id") localId: String): CajaActivaResponse
}
