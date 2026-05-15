import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { MedicalAssistantService } from './medical-assistant.service';
import { MedicalAssistantRequest, MedicalAssistantResponse } from './medical-assistant.types';
import { ApiKeyGuard } from '../ingress/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('api/assistant')
export class MedicalAssistantController {
  constructor(private readonly medicalAssistantService: MedicalAssistantService) {}

  @Post('whatsapp')
  @HttpCode(200)
  async whatsappFlow(@Body() body: MedicalAssistantRequest): Promise<MedicalAssistantResponse> {
    return this.medicalAssistantService.handleWhatsAppMessage(body);
  }
}
