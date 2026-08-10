package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.LocalResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface LocalsApi {
    @GET("api/locals")
    suspend fun listLocals(@Query("business_id") businessId: String): List<LocalResponse>
}
