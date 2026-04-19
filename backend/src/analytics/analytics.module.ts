import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

/**
 * AnalyticsModule — acceso de solo lectura a los datos de transacciones.
 *
 * No expone ningún controller HTTP. Es consumido internamente
 * por ChatModule → AgentService. El LLM nunca accede directamente
 * a este servicio; solo lo hace a través de las tools tipadas del agente.
 */
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
