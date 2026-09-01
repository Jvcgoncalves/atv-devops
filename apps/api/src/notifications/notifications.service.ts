import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Alert, Identification, NtfyConfig, NtfyLogEntry } from "@hvac/contracts";
import { shouldNotifyAlert } from "@hvac/domain";
import { HvacRepository } from "../database/hvac.repository.js";
import { mapIdentification, mapNtfyConfig, mapNtfyLog } from "../mappers/response-mappers.js";
import { AuditService } from "../audit/audit.service.js";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(HvacRepository) private readonly repository: HvacRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getConfig(): Promise<NtfyConfig> {
    return mapNtfyConfig(await this.repository.getNtfyConfig());
  }

  async updateConfig(patch: Partial<NtfyConfig>): Promise<NtfyConfig> {
    const config = await this.repository.updateNtfyConfig({
      ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
      ...(patch.server === undefined ? {} : { server_url: patch.server }),
      ...(patch.topic === undefined ? {} : { topic: patch.topic }),
      ...(patch.minLevel === undefined ? {} : { min_level: patch.minLevel }),
    });
    await this.audit.record("registro", "Configuracao ntfy atualizada", null, "operador");
    return mapNtfyConfig(config);
  }

  async listLog(): Promise<NtfyLogEntry[]> {
    return (await this.repository.listNtfyLogs()).map(mapNtfyLog);
  }

  async sendAlert(alert: Alert): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled || !shouldNotifyAlert(alert.level, config.minLevel)) return;
    const url = `${config.server.replace(/\/+$/, "")}/${config.topic.replace(/^\/+/, "")}`;
    const title = alert.level === "critico" ? "HVAC - ALARME CRITICO" : "HVAC - Atencao";
    const priority = alert.level === "critico" ? "urgent" : "high";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Title: title, Priority: priority, Tags: alert.level === "critico" ? "rotating_light" : "warning" },
        body: alert.mensagem,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        this.logger.error(`ntfy delivery failed: HTTP ${response.status}`);
        return;
      }
      await this.repository.insertNtfyLog({
        alert_id: alert.id,
        sent_at: new Date().toISOString(),
        url,
        priority,
        title,
        message: alert.mensagem,
        tags: [alert.level === "critico" ? "rotating_light" : "warning"],
      });
    } catch (error) {
      this.logger.error(`ntfy delivery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getIdentification(): Promise<Identification> {
    return mapIdentification(await this.repository.getIdentification());
  }

  async updateIdentification(patch: Partial<Identification>): Promise<Identification> {
    const identification = await this.repository.updateIdentification({
      ...(patch.estabelecimento === undefined ? {} : { establishment: patch.estabelecimento }),
      ...(patch.cnes === undefined ? {} : { cnes: patch.cnes }),
      ...(patch.sistema === undefined ? {} : { system_name: patch.sistema }),
      ...(patch.responsavelTecnico === undefined ? {} : { responsible_technician: patch.responsavelTecnico }),
      ...(patch.registro === undefined ? {} : { professional_registration: patch.registro }),
    });
    await this.audit.record("registro", "Identificacao do relatorio de auditoria atualizada", null, "operador");
    return mapIdentification(identification);
  }
}
