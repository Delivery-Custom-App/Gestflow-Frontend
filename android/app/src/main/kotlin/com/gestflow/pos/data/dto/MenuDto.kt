package com.gestflow.pos.data.dto

import kotlinx.serialization.Serializable

@Serializable
data class MenuProductItem(
    val id: String,
    val name: String,
    val description: String? = null,
    val price: Int,
    val is_active: Boolean = true,
)

@Serializable
data class MenuCategoryGroup(
    val id: String,
    val name: String,
    val product_count: Int,
    val products: List<MenuProductItem>,
)

@Serializable
data class PosMenuResponse(
    val local_id: String,
    val total_products: Int,
    val categories: List<MenuCategoryGroup>,
)
