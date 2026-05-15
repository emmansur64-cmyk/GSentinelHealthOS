import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { MedicalAssistantService } from './medical-assistant.service';
import { MedicalAssistantChatDto, MedicalAssistantRequest, MedicalAssistantResponse } from './medical-assistant.types';
import { ApiKeyGuard } from '../ingress/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('api/assistant')
export class MedicalAssistantController {
  constructor(private readonly medicalAssistantService: MedicalAssistantService) {}

  @Post('chat')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: () => new BadRequestException({
        statusCode: 400,
        message: 'Invalid chat request payload.',
        error: 'Bad Request',
      }),
    }),
  )
  async clinicalChat(@Body() body: MedicalAssistantChatDto): Promise<MedicalAssistantResponse> {
    const normalizedInput: MedicalAssistantRequest = {
      ...body,
      message: body.message ?? body.query ?? '',
    };

    return this.medicalAssistantService.handleMedicalChatMessage(normalizedInput);
  }
}
