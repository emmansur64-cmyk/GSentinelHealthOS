import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { PowerShellExecutor } from './powershell.executor';

@Module({
  providers: [PowerShellExecutor, ExecutionService],
  exports: [PowerShellExecutor, ExecutionService],
})
export class ExecutionModule {}