import { Global, Module } from "@nestjs/common";
import { OperationsService } from "./operations.service.js";

@Global()
@Module({
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
