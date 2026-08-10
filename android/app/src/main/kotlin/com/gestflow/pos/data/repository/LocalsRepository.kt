package com.gestflow.pos.data.repository

import com.gestflow.pos.data.dto.LocalResponse
import com.gestflow.pos.data.remote.LocalsApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalsRepository @Inject constructor(
    private val localsApi: LocalsApi,
) {
    suspend fun listLocals(businessId: String): List<LocalResponse> =
        localsApi.listLocals(businessId)
}
