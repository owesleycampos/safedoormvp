'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Webhook, Search, CheckCircle, XCircle, Clock, AlertTriangle,
  Eye, Copy, RefreshCw, Shield, Link2, ChevronDown, ChevronUp,
  Zap, CreditCard, Ban, Bell,
} from 'lucide-react';

interface WebhookEventData {
  id: string;
  provider: string;
  externalId: string | null;
  eventType: string;
  status: string;
  schoolId: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
  payload: string;
}

interface WebhooksData {
  events: WebhookEventData[];
  stats: {
    totalReceived: number;
    processed: number;
    failed: number;
    ignored: number;
  };
  byProvider: Record<string, number>;
  byType: Record<string, number>;
  config: {
    webhookSecret: string | null;
    paymentProvider: string;
    webhookUrl: string;
  };
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  RECEIVED: { color: 'text-blue-400 bg-blue-400/10', icon: Clock, label: 'Recebido' },
  PROCESSED: { color: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle, label: 'Processado' },
  FAILED: { color: 'text-red-400 bg-red-400/10', icon: XCircle, label: 'Falhou' },
  IGNORED: { color: 'text-zinc-400 bg-zinc-400/10', icon: Ban, label: 'Ignorado' },
};

const providerColors: Record<string, string> = {
  STRIPE: 'text-violet-400 bg-violet-400/10',
  ASAAS: 'text-blue-400 bg-blue-400/10',
  MERCADOPAGO: 'text-cyan-400 bg-cyan-400/10',
  PAGARME: 'text-emerald-400 bg-emerald-400/10',
  MANUAL: 'text-zinc-400 bg-zinc-400/10',
  UNKNOWN: 'text-zinc-400 bg-zinc-400/10',
};

const eventTypeIcons: Record<string, typeof Zap> = {
  'payment': CreditCard,
  'subscription': Zap,
  'invoice': CreditCard,
  'confirmed': CheckCircle,
  'overdue': AlertTriangle,
  'cancelled': Ban,
  'failed': XCircle,
};

function getEventIcon(eventType: string) {
  for (const [key, icon] of Object.entries(eventTypeIcons)) {
    if (eventType.toLowerCase().includes(key)) return icon;
  }
  return Bell;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatEventType(type: string) {
  return type
    .replace(/_/g, ' ')
    .replace(/\./g, ' > ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WebhooksClient({ data }: { data: WebhooksData }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [newSecret, setNewSecret] = useState('');
  const [newProvider, setNewProvider] = useState(data.config.paymentProvider);
  const [savingConfig, setSavingConfig] = useState(false);

  const filtered = data.events.filter((e) => {
    const matchSearch = search === '' ||
      e.eventType.toLowerCase().includes(search.toLowerCase()) ||
      e.provider.toLowerCase().includes(search.toLowerCase()) ||
      e.externalId?.toLowerCase().includes(search.toLowerCase()) ||
      e.schoolId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || e.status === statusFilter;
    const matchProvider = providerFilter === 'ALL' || e.provider === providerFilter;
    return matchSearch && matchStatus && matchProvider;
  });

  const providers = Array.from(new Set(data.events.map((e) => e.provider)));

  function copyWebhookUrl() {
    const url = `${window.location.origin}${data.config.webhookUrl}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      await fetch('/api/odono/webhooks-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookSecret: newSecret || undefined,
          paymentProvider: newProvider,
        }),
      });
      router.refresh();
      setShowConfig(false);
      setNewSecret('');
    } finally {
      setSavingConfig(false);
    }
  }

  async function retryEvent(eventId: string) {
    await fetch('/api/odono/webhooks-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action: 'retry' }),
    });
    router.refresh();
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-1">Integração com gateways de pagamento</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <Shield className="h-4 w-4" />
          Configurar
        </button>
      </div>

      {/* Webhook URL + Config */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            URL do Webhook:
          </div>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 min-w-0 truncate">
            {typeof window !== 'undefined' ? window.location.origin : 'https://seudominio.com'}{data.config.webhookUrl}
          </code>
          <button
            onClick={copyWebhookUrl}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-accent transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Secret: {data.config.webhookSecret || 'Não configurado'}
          </span>
          <span className={`px-1.5 py-0.5 rounded font-medium ${providerColors[data.config.paymentProvider] || ''}`}>
            {data.config.paymentProvider}
          </span>
        </div>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="rounded-lg border border-emerald-500/30 bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            Configuração de Webhooks
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Gateway de Pagamento</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
              >
                <option value="MANUAL">Manual</option>
                <option value="STRIPE">Stripe</option>
                <option value="ASAAS">Asaas</option>
                <option value="MERCADOPAGO">MercadoPago</option>
                <option value="PAGARME">Pagar.me</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Webhook Secret (novo)</label>
              <input
                type="text"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Deixe vazio para manter o atual"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {savingConfig ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Recebidos" value={data.stats.totalReceived} icon={Webhook} color="blue" />
        <StatCard label="Processados" value={data.stats.processed} icon={CheckCircle} color="emerald" />
        <StatCard label="Falharam" value={data.stats.failed} icon={XCircle} color="red" />
        <StatCard label="Ignorados" value={data.stats.ignored} icon={Ban} color="zinc" />
      </div>

      {/* Provider breakdown */}
      {Object.keys(data.byProvider).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(data.byProvider).map(([provider, count]) => (
            <span key={provider} className={`text-xs font-medium px-2 py-1 rounded ${providerColors[provider] || ''}`}>
              {provider}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por tipo, provider, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-border bg-background"
        >
          <option value="ALL">Todos os status</option>
          <option value="RECEIVED">Recebido</option>
          <option value="PROCESSED">Processado</option>
          <option value="FAILED">Falhou</option>
          <option value="IGNORED">Ignorado</option>
        </select>
        {providers.length > 1 && (
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-border bg-background"
          >
            <option value="ALL">Todos os providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {/* Events List */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {filtered.length === 0 && (
          <div className="p-8 text-center">
            <Webhook className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum webhook recebido.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure a URL acima no seu gateway de pagamento.
            </p>
          </div>
        )}
        {filtered.map((event) => {
          const config = statusConfig[event.status] || statusConfig.RECEIVED;
          const StatusIcon = config.icon;
          const EventIcon = getEventIcon(event.eventType);
          const isExpanded = expandedId === event.id;

          return (
            <div key={event.id} className="hover:bg-muted/30 transition-colors">
              {/* Main row */}
              <div
                className="p-3 lg:p-4 flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : event.id)}
              >
                {/* Status icon */}
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <StatusIcon className="h-4 w-4" />
                </div>

                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EventIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatEventType(event.eventType)}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${providerColors[event.provider] || ''}`}>
                      {event.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {event.externalId && (
                      <span className="font-mono truncate max-w-[150px]">{event.externalId}</span>
                    )}
                    {event.schoolId && (
                      <span>Escola: {event.schoolId.slice(0, 8)}...</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline ${config.color}`}>
                  {config.label}
                </span>

                {/* Time */}
                <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden md:inline">
                  {formatDateTime(event.createdAt)}
                </span>

                {/* Expand */}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/50 bg-muted/20">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <p className="font-medium mt-0.5">{config.label}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Provider</span>
                      <p className="font-medium mt-0.5">{event.provider}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recebido</span>
                      <p className="font-medium mt-0.5">{formatDateTime(event.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Processado</span>
                      <p className="font-medium mt-0.5">{event.processedAt ? formatDateTime(event.processedAt) : '—'}</p>
                    </div>
                    {event.schoolId && (
                      <div>
                        <span className="text-muted-foreground">School ID</span>
                        <p className="font-mono font-medium mt-0.5 truncate">{event.schoolId}</p>
                      </div>
                    )}
                    {event.invoiceId && (
                      <div>
                        <span className="text-muted-foreground">Invoice ID</span>
                        <p className="font-mono font-medium mt-0.5 truncate">{event.invoiceId}</p>
                      </div>
                    )}
                    {event.subscriptionId && (
                      <div>
                        <span className="text-muted-foreground">Subscription ID</span>
                        <p className="font-mono font-medium mt-0.5 truncate">{event.subscriptionId}</p>
                      </div>
                    )}
                  </div>

                  {event.errorMessage && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                      <strong>Erro:</strong> {event.errorMessage}
                    </div>
                  )}

                  {/* Payload */}
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Payload</p>
                    <pre className="text-[11px] bg-zinc-950 text-zinc-300 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono">
                      {(() => {
                        try { return JSON.stringify(JSON.parse(event.payload), null, 2); }
                        catch { return event.payload; }
                      })()}
                    </pre>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {event.status === 'FAILED' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); retryEvent(event.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reprocessar
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(event.payload);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar Payload
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
    red: 'text-red-400 bg-red-400/10',
    zinc: 'text-zinc-400 bg-zinc-400/10',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className={`h-3.5 w-3.5 ${colorMap[color]?.split(' ')[0]}`} />
        {label}
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
