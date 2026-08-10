package com.gestflow.pos.data.remote

import com.gestflow.pos.data.dto.OrderCreateRequest
import com.gestflow.pos.data.dto.OrderResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface OrdersApi {
    @POST("api/orders")
    suspend fun createOrder(@Body body: OrderCreateRequest): OrderResponse
}
