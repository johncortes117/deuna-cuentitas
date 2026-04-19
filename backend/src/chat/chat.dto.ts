import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartSessionDto {
  @ApiProperty({ example: 'NEG001', description: 'El identificador único del negocio (commerceId).' })
  commerceId: string;

  @ApiProperty({ example: 'admin', description: 'El rol del usuario (e.g., admin, vendedor).' })
  role: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'uuid-de-la-sesion', description: 'El ID de la sesión devuelto por session/start.' })
  sessionId: string;

  @ApiPropertyOptional({ example: '¿Cuáles son mis clientes más fieles?', description: 'El texto en lenguaje natural.' })
  text?: string;

  @ApiPropertyOptional({ example: 'quick_reply_1', description: 'ID de acción si se usó un botón predefinido.' })
  actionId?: string;
}
