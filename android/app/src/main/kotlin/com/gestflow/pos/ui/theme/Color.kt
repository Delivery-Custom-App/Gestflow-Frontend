package com.gestflow.pos.ui.theme

import androidx.compose.ui.graphics.Color
import com.gestflow.pos.domain.model.MesaState

// Convertidos desde los tokens HSL confirmados en src/index.css del frontend web
// (ver plan seccion 4.11): libre=160 84% 39%, ocupada=0 84% 60%, en_cobro=38 92% 50%,
// inactiva=214 20% 69%.
val MesaLibre = Color(0xFF10B77F)
val MesaOcupada = Color(0xFFEF4343)
val MesaEnCobro = Color(0xFFF59F0A)
val MesaInactiva = Color(0xFFA0AEC0)

fun MesaState.toColor(): Color = when (this) {
    MesaState.LIBRE -> MesaLibre
    MesaState.OCUPADA -> MesaOcupada
    MesaState.EN_COBRO -> MesaEnCobro
    MesaState.INACTIVA -> MesaInactiva
}

fun MesaState.label(): String = when (this) {
    MesaState.LIBRE -> "Libre"
    MesaState.OCUPADA -> "Ocupada"
    MesaState.EN_COBRO -> "En cobro"
    MesaState.INACTIVA -> "Inactiva"
}
