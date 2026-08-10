package com.gestflow.pos.ui.mesas.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.gestflow.pos.data.dto.MesasKpiResponse
import com.gestflow.pos.ui.theme.MesaEnCobro
import com.gestflow.pos.ui.theme.MesaLibre
import com.gestflow.pos.ui.theme.MesaOcupada

@Composable
fun MesasKpiRow(kpis: MesasKpiResponse?) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        KpiTile("Total", kpis?.total, MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
        KpiTile("Libres", kpis?.libres, MesaLibre, Modifier.weight(1f))
        KpiTile("Ocupadas", kpis?.ocupadas, MesaOcupada, Modifier.weight(1f))
        KpiTile("En cobro", kpis?.en_cobro, MesaEnCobro, Modifier.weight(1f))
    }
}

@Composable
private fun KpiTile(
    label: String,
    value: Int?,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(value?.toString() ?: "-", style = MaterialTheme.typography.headlineSmall, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall)
        }
    }
}
