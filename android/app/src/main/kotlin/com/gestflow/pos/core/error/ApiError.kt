package com.gestflow.pos.core.error

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException

/**
 * Extrae un mensaje legible del body de error del backend, que siempre viaja
 * como {"detail": ...} -- pero "detail" puede ser un string (errores de negocio,
 * ej. 409 de mesa con ordenes activas), una lista de errores de validacion
 * Pydantic, o un objeto. Replica formatApiErrorDetail de apiClient.js (web).
 */
object ApiError {
    private val json = Json { ignoreUnknownKeys = true }

    fun from(exception: HttpException): String {
        val body = exception.response()?.errorBody()?.string()
        return fromBody(body) ?: "Error HTTP ${exception.code()}"
    }

    fun fromBody(body: String?): String? {
        if (body.isNullOrBlank()) return null
        return try {
            val element = json.parseToJsonElement(body)
            val detail = element.jsonObject["detail"] ?: return body
            formatDetail(detail)
        } catch (_: Exception) {
            body
        }
    }

    private fun formatDetail(detail: kotlinx.serialization.json.JsonElement): String {
        return when (detail) {
            is JsonPrimitive -> detail.content
            is JsonArray -> detail.jsonArray.joinToString("; ") { item ->
                (item as? JsonObject)?.get("msg")?.jsonPrimitive?.content ?: item.toString()
            }
            is JsonObject -> detail.toString()
            else -> detail.toString()
        }
    }
}
