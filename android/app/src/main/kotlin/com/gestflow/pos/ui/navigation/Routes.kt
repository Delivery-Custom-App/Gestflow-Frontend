package com.gestflow.pos.ui.navigation

object Routes {
    const val SELECT_LOCAL = "select_local"
    const val MESAS = "mesas/{localId}"
    const val PEDIDO = "pedido/{localId}/{mesaId}"
    const val CONFIGURACION = "configuracion/{localId}"

    fun mesas(localId: String) = "mesas/$localId"
    fun pedido(localId: String, mesaId: String) = "pedido/$localId/$mesaId"
    fun configuracion(localId: String) = "configuracion/$localId"
}
