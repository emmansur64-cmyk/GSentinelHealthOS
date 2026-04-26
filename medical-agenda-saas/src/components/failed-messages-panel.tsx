"use client";

/**
 * Panel de mensajes fallidos (Dead Letter Queue) para secretaria/admin.
 *
 * Muestra:
 * - Estadísticas de mensajes fallidos
 * - Lista de mensajes pendientes
 * - Acciones: reintentar, resolver, descartar
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";

type FailedMessage = {
  id: string;
  message_id: string;
  from_phone: string;
  error_message: string;
  retry_count: number;
  status: string;
  last_attempt: string;
  created_at: string;
};

type Stats = {
  pending: number;
  retrying: number;
  resolved: number;
  discarded: number;
  total: number;
};

type APIResponse = {
  items: FailedMessage[];
  total: number;
  stats: Stats;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  retrying: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  discarded: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  retrying: "Reintentando",
  resolved: "Resuelto",
  discarded: "Descartado",
};

export function FailedMessagesPanel() {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Modal state
  const [selectedMessage, setSelectedMessage] = useState<FailedMessage | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"retry" | "resolve" | "discard" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/admin/failed-messages?${params}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async () => {
    if (!selectedMessage || !actionType) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/failed-messages/${selectedMessage.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          reason: actionReason || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al ejecutar acción");
      }

      // Refresh data
      await fetchData();
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (message: FailedMessage, action: "retry" | "resolve" | "discard") => {
    setSelectedMessage(message);
    setActionType(action);
    setActionReason("");
    setActionDialogOpen(true);
  };

  const closeDialog = () => {
    setActionDialogOpen(false);
    setSelectedMessage(null);
    setActionType(null);
    setActionReason("");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatPhone = (phone: string) => {
    // Formato: +54 9 11 1234-5678
    if (phone.startsWith("+54")) {
      return phone.replace(/(\+54)(\d)(\d{2})(\d{4})(\d{4})/, "$1 $2 $3 $4-$5");
    }
    return phone;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Mensajes Fallidos (DLQ)
            </CardTitle>
            <CardDescription>
              Mensajes de WhatsApp que no pudieron procesarse
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Estadísticas */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard
              label="Pendientes"
              value={data.stats.pending}
              icon={<Clock className="h-4 w-4 text-yellow-500" />}
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter(statusFilter === "pending" ? undefined : "pending")}
            />
            <StatCard
              label="Reintentando"
              value={data.stats.retrying}
              icon={<RefreshCw className="h-4 w-4 text-blue-500" />}
              active={statusFilter === "retrying"}
              onClick={() => setStatusFilter(statusFilter === "retrying" ? undefined : "retrying")}
            />
            <StatCard
              label="Resueltos"
              value={data.stats.resolved}
              icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              active={statusFilter === "resolved"}
              onClick={() => setStatusFilter(statusFilter === "resolved" ? undefined : "resolved")}
            />
            <StatCard
              label="Descartados"
              value={data.stats.discarded}
              icon={<XCircle className="h-4 w-4 text-gray-500" />}
              active={statusFilter === "discarded"}
              onClick={() => setStatusFilter(statusFilter === "discarded" ? undefined : "discarded")}
            />
            <StatCard
              label="Total"
              value={data.stats.total}
              icon={<AlertTriangle className="h-4 w-4 text-gray-400" />}
              active={!statusFilter}
              onClick={() => setStatusFilter(undefined)}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : data?.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay mensajes fallidos
            {statusFilter && ` con estado "${STATUS_LABELS[statusFilter]}"`}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-center">Reintentos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último intento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-mono text-sm">
                      {formatPhone(msg.from_phone)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={msg.error_message}>
                      {msg.error_message}
                    </TableCell>
                    <TableCell className="text-center">
                      {msg.retry_count}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[msg.status]}>
                        {STATUS_LABELS[msg.status] ?? msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(msg.last_attempt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {msg.status === "pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openActionDialog(msg, "retry")}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Reintentar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog(msg, "discard")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Descartar
                          </Button>
                        </div>
                      )}
                      {msg.status === "retrying" && (
                        <span className="text-sm text-blue-500">En proceso...</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginación simple */}
        {data && data.total > 50 && (
          <div className="text-sm text-gray-500 mt-4 text-center">
            Mostrando {data.items.length} de {data.total} mensajes
          </div>
        )}
      </CardContent>

      {/* Dialog de acciones */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "retry" && "Reintentar mensaje"}
              {actionType === "resolve" && "Marcar como resuelto"}
              {actionType === "discard" && "Descartar mensaje"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "retry" && (
                <>
                  El mensaje de <strong>{formatPhone(selectedMessage?.from_phone ?? "")}</strong>{" "}
                  será reencolado para procesamiento.
                </>
              )}
              {actionType === "resolve" && (
                <>
                  El mensaje será marcado como resuelto y no se reintentará.
                </>
              )}
              {actionType === "discard" && (
                <>
                  El mensaje será descartado permanentemente. Esta acción no se puede deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {(actionType === "resolve" || actionType === "discard") && (
            <div className="py-4">
              <label className="text-sm font-medium">
                {actionType === "discard" ? "Razón (requerida)" : "Notas (opcional)"}
              </label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  actionType === "discard"
                    ? "Ej: Mensaje de spam, número inválido..."
                    : "Ej: Se contactó al paciente por otro medio..."
                }
                className="mt-2"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading || (actionType === "discard" && !actionReason)}
              variant={actionType === "discard" ? "destructive" : "default"}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "retry" && "Reintentar"}
              {actionType === "resolve" && "Resolver"}
              {actionType === "discard" && "Descartar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Componente auxiliar para las tarjetas de estadísticas
function StatCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        p-3 rounded-lg border text-left transition-colors
        ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}
      `}
    >
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </button>
  );
}
