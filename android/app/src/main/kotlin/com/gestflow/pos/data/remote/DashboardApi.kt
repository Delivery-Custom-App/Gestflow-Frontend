package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.MesasKpiResponse
import com.gestflow.pos.data.dto.PosMenuResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface DashboardApi {
    @GET("api/dashboard/mesas-kpis")
    suspend fun getMesasKpis(@Query("local_id") localId: String): MesasKpiResponse

    @GET("api/dashboard/menu")
    suspend fun getMenu(
        @Query("local_id") localId: String,
        @Query("search") search: String? = null,
    ): PosMenuResponse
}
