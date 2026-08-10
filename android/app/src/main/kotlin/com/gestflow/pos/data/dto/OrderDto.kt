package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class OrderItemCreateRequest(
    val product_id: String? = null,
    val recipe_id: String? = null,
    val item_name: String? = null,
    val quantity: Int,
    val unit_price: Int,
)

@Serializable
data class OrderCreateRequest(
    val local_id: String,
    val mesa_id: String? = null,
    val caja_id: String? = null,
    val source: String = "dine-in",
    // v1: sin cobro real ni terminal de pago -- se fija CASH siempre (ver plan seccion 4.4).
    val payment_method: String = "CASH",
    val items: List<OrderItemCreateRequest>,
)

@Serializable
data class OrderResponse(
    val id: String,
    val local_id: String,
    val mesa_id: String? = null,
    val caja_id: String? = null,
    val status: String,
    val payment_method: String,
    val source: String,
    val subtotal: Int,
    val total: Int,
    val created_at: String,
)
