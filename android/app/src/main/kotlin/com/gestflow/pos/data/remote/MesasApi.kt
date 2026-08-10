package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.MesaCreateRequest
import com.gestflow.pos.data.dto.MesaResponse
import com.gestflow.pos.data.dto.MesaUpdateRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface MesasApi {
    @GET("api/mesas")
    suspend fun listMesas(
        @Query("local_id") localId: String,
        @Query("with_state") withState: Boolean = true,
    ): List<MesaResponse>

    @POST("api/mesas")
    suspend fun createMesa(@Body body: MesaCreateRequest): MesaResponse

    @PATCH("api/mesas/{mesaId}")
    suspend fun updateMesa(@Path("mesaId") mesaId: String, @Body body: MesaUpdateRequest): MesaResponse

    @DELETE("api/mesas/{mesaId}")
    suspend fun deleteMesa(@Path("mesaId") mesaId: String)
}
