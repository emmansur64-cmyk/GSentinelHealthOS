"""Generador de auditoría técnica PDF — GSentinelHealthOS."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import PageBreak
import datetime

OUTPUT = "AUDITORIA_TECNICA_GSENTINEL_2026.pdf"

# ── Paleta ──────────────────────────────────────────────────────────────
C_DARK    = HexColor("#0F172A")
C_PRIMARY = HexColor("#1E40AF")
C_SEC     = HexColor("#3B82F6")
C_GREEN   = HexColor("#065F46")
C_GREEN_L = HexColor("#D1FAE5")
C_RED     = HexColor("#991B1B")
C_RED_L   = HexColor("#FEE2E2")
C_AMBER   = HexColor("#92400E")
C_AMBER_L = HexColor("#FEF3C7")
C_GRAY    = HexColor("#64748B")
C_GRAY_L  = HexColor("#F1F5F9")
C_WHITE   = white
C_BG_HDR  = HexColor("#1E3A5F")

W, H = A4

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

# Estilos personalizados
TITLE   = S("TITLE",   fontSize=28, textColor=C_WHITE,   alignment=TA_CENTER, fontName="Helvetica-Bold",  leading=34, spaceAfter=4)
SUBTITLE= S("SUBTITLE",fontSize=13, textColor=HexColor("#93C5FD"), alignment=TA_CENTER, fontName="Helvetica", leading=17)
SECT    = S("SECT",    fontSize=13, textColor=C_WHITE,   fontName="Helvetica-Bold", leading=17, spaceBefore=2, spaceAfter=2)
H2      = S("H2",      fontSize=11, textColor=C_PRIMARY, fontName="Helvetica-Bold", leading=14, spaceBefore=8, spaceAfter=4)
H3      = S("H3",      fontSize=10, textColor=C_DARK,    fontName="Helvetica-Bold", leading=13, spaceBefore=6, spaceAfter=3)
BODY    = S("BODY",    fontSize=9,  textColor=C_DARK,    fontName="Helvetica",       leading=13, spaceAfter=3)
SMALL   = S("SMALL",   fontSize=8,  textColor=C_GRAY,    fontName="Helvetica",       leading=11, spaceAfter=2)
CODE    = S("CODE",    fontSize=8,  textColor=HexColor("#1E293B"), fontName="Courier", leading=11, backColor=C_GRAY_L, spaceAfter=2)
BOLD    = S("BOLD",    fontSize=9,  textColor=C_DARK,    fontName="Helvetica-Bold",  leading=13, spaceAfter=2)
CENTER  = S("CENTER",  fontSize=9,  textColor=C_GRAY,    alignment=TA_CENTER, fontName="Helvetica", leading=12)
WARN    = S("WARN",    fontSize=9,  textColor=C_RED,     fontName="Helvetica-Bold",  leading=13, spaceAfter=2)
OK_ST   = S("OK_ST",   fontSize=9,  textColor=C_GREEN,   fontName="Helvetica-Bold",  leading=13, spaceAfter=2)

def badge(text, bg, fg=C_WHITE):
    return Table([[Paragraph(text, S("b", fontSize=8, textColor=fg, fontName="Helvetica-Bold", leading=10, alignment=TA_CENTER))]],
                 colWidths=[3.5*cm], rowHeights=[0.5*cm],
                 style=TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),
                                   ("ROUNDEDCORNERS",[3]),
                                   ("ALIGN",(0,0),(-1,-1),"CENTER"),
                                   ("VALIGN",(0,0),(-1,-1),"MIDDLE")]))

def section_header(title, icon=""):
    tbl = Table([[Paragraph(f"{icon}  {title}", SECT)]],
                colWidths=[W - 4*cm],
                style=TableStyle([
                    ("BACKGROUND",(0,0),(-1,-1),C_BG_HDR),
                    ("TOPPADDING",(0,0),(-1,-1),7),
                    ("BOTTOMPADDING",(0,0),(-1,-1),7),
                    ("LEFTPADDING",(0,0),(-1,-1),14),
                    ("ROUNDEDCORNERS",[4]),
                ]))
    return tbl

def verdict_row(label, value, color_val=None):
    c = color_val or C_DARK
    return [Paragraph(f"<b>{label}</b>", BODY),
            Paragraph(str(value), S("vv", fontSize=9, textColor=c, fontName="Helvetica-Bold", leading=13))]

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#CBD5E1"), spaceAfter=6, spaceBefore=4)

# ── Tabla de hallazgos ──────────────────────────────────────────────────
def findings_table(rows, col_widths=None):
    col_widths = col_widths or [5*cm, 12.5*cm]
    data = [[Paragraph(f"<b>{r[0]}</b>", S("th", fontSize=8.5, textColor=C_WHITE, fontName="Helvetica-Bold", leading=11, alignment=TA_CENTER)),
             Paragraph(r[1], S("td", fontSize=8.5, textColor=C_WHITE, fontName="Helvetica", leading=11))]
            for r in rows[:1]] + \
           [[Paragraph(r[0], BOLD), Paragraph(r[1], BODY)] for r in rows[1:]]
    ts = TableStyle([
        ("BACKGROUND",(0,0),(-1,0),C_PRIMARY),
        ("BACKGROUND",(0,1),(-1,-1),C_GRAY_L),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
        ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
        ("TOPPADDING",(0,0),(-1,-1),5),
        ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ])
    return Table(data, colWidths=col_widths, style=ts, repeatRows=1)

# ────────────────────────────────────────────────────────────────────────
story = []

# ══════════════════════════════════════════════════════════════════════
# PORTADA
# ══════════════════════════════════════════════════════════════════════
cover = Table(
    [[Paragraph("AUDITORÍA TÉCNICA PROFUNDA", TITLE)],
     [Paragraph("GSentinelHealthOS + medical-agenda-saas", SUBTITLE)],
     [Spacer(1, 0.3*cm)],
     [Paragraph("Fecha: 23 de Abril de 2026  |  Versión: 1.0  |  Clasificación: CONFIDENCIAL", CENTER)],
     [Spacer(1, 0.2*cm)],
     [Paragraph("Ingeniero Auditor: GitHub Copilot — Especialista HealthTech &amp; IA Médica", CENTER)],
    ],
    colWidths=[W - 4*cm],
    style=TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),C_BG_HDR),
        ("TOPPADDING",(0,0),(-1,-1),22),
        ("BOTTOMPADDING",(0,0),(-1,-1),22),
        ("LEFTPADDING",(0,0),(-1,-1),24),
        ("RIGHTPADDING",(0,0),(-1,-1),24),
        ("ROUNDEDCORNERS",[6]),
    ])
)
story.append(cover)
story.append(Spacer(1, 0.6*cm))

# Resumen ejecutivo rápido
exec_data = [
    ["DIMENSIÓN", "NIVEL ACTUAL", "ESTADO"],
    ["Motor de IA", "Nivel 3 — Decisión Contextual", "⚠ PARCIAL"],
    ["Independencia MetaBrain", "AUTÓNOMO (local)", "✓ OK"],
    ["Agenda Médica", "Nivel PRO — Optimización real", "✓ SÓLIDO"],
    ["Dashboard Secretaria", "Nivel Medio-Alto", "⚠ MEJORAS"],
    ["Dashboard Médico", "Funcional, mejoras pendientes", "⚠ MEJORAS"],
    ["Pipeline WhatsApp", "DLQ + Retry implementados", "✓ OK"],
    ["Multi-tenant SaaS", "Implementado en medical-agenda", "✓ OK"],
    ["Microservicios IA externos", "NO DESPLEGADOS", "✗ CRÍTICO"],
    ["Veredicto Sistema", "PRE-PRODUCCIÓN AVANZADO", "⚠ NO PROD"],
]
ts_exec = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY),
    ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
    ("FONTSIZE",(0,0),(-1,-1),8.5),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("ALIGN",(0,0),(-1,-1),"LEFT"),
    ("ALIGN",(2,0),(-1,-1),"CENTER"),
    ("TOPPADDING",(0,0),(-1,-1),5),
    ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),8),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    # Colores de estado
    ("TEXTCOLOR",(2,1),(2,1),C_AMBER),
    ("TEXTCOLOR",(2,2),(2,2),C_GREEN),
    ("TEXTCOLOR",(2,3),(2,3),C_GREEN),
    ("TEXTCOLOR",(2,4),(2,4),C_AMBER),
    ("TEXTCOLOR",(2,5),(2,5),C_AMBER),
    ("TEXTCOLOR",(2,6),(2,6),C_GREEN),
    ("TEXTCOLOR",(2,7),(2,7),C_GREEN),
    ("TEXTCOLOR",(2,8),(2,8),C_RED),
    ("TEXTCOLOR",(2,9),(2,9),C_AMBER),
])
story.append(Table(exec_data, colWidths=[5.5*cm, 8*cm, 4*cm], style=ts_exec, repeatRows=1))
story.append(Spacer(1, 0.4*cm))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 1. ARQUITECTURA GENERAL
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("1. ARQUITECTURA GENERAL", "🏗"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Patrón detectado", H2))
story.append(Paragraph(
    "Arquitectura <b>híbrida event-driven + monolito modular</b>. El sistema combina "
    "un worker Python (Brain) consumiendo colas Redis con un frontend Next.js 14 "
    "(medical-agenda-saas) que expone API REST propia. No hay un bus de eventos centralizado "
    "(ej. Kafka/RabbitMQ); Redis actúa como broker simplificado con listas (BRPOP/LPUSH).",
    BODY))

story.append(Paragraph("Flujo completo mapeado", H2))
arch_data = [
    ["ETAPA", "COMPONENTE", "TECNOLOGÍA", "ESTADO"],
    ["1. Entrada", "WhatsApp Cloud API webhook", "HTTPS POST → gateway", "✓ OK"],
    ["2. Gateway", "whatsapp_gateway / FastAPI", "Python + Redis LPUSH", "✓ OK"],
    ["3. Cola entrada", "whatsapp:incoming (Redis)", "BRPOP blocking", "✓ OK"],
    ["4. Worker Brain", "BrainWorker → BrainOrchestrator", "Python asyncio", "✓ OK"],
    ["5. NLU / MetaBrain", "NLUEngine (rule+fuzzy+KB)", "Local — sin LLM", "✓ OK"],
    ["6. Cola salida", "whatsapp:outgoing (Redis)", "LPUSH + DLQ :dead", "✓ OK"],
    ["7. Envío WA", "WhatsAppOutgoingConsumer", "Graph API HTTP", "✓ OK"],
    ["8. API SaaS", "medical-agenda-saas / Next.js", "Prisma + PostgreSQL", "✓ OK"],
    ["9. Motor IA orq.", "IntelligentOrchestrator", "4 microservicios HTTP", "✗ NO EXISTE"],
]
ts_arch = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY),
    ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
    ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5),
    ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7),
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(3,9),(3,9),C_RED),
    ("FONTNAME",(3,9),(3,9),"Helvetica-Bold"),
])
story.append(Table(arch_data, colWidths=[2.5*cm, 5*cm, 4*cm, 3.5*cm], style=ts_arch, repeatRows=1))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Acoplamientos y SPOF detectados", H2))
spof_items = [
    ("Redis (single node)", "CRÍTICO — Es el único broker. Sin Redis, el sistema de mensajería WhatsApp colapsa completamente. No hay failover ni Redis Sentinel configurado en docker-compose.yml."),
    ("PostgreSQL (single node)", "ALTO — Un solo contenedor DB. Sin replicación. Pérdida de datos ante fallo de volumen."),
    ("WhatsApp Graph API", "MEDIO — Dependencia total de Meta. Sin circuit breaker a nivel gateway (el CB está en el orchestrator de IA, no en el envío real)."),
    ("IntelligentOrchestrator", "CRÍTICO — Referencia a 4 microservicios (dialogue-engine, inference-service, decision-service, nlg-service) que NO están implementados como servicios reales en el repo. Son clientes HTTP a endpoints inexistentes."),
]
for title, desc in spof_items:
    story.append(Paragraph(f"• <b>{title}:</b> {desc}", BODY))

story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 2. ANÁLISIS DE IA
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("2. ANÁLISIS DE IA — ESTADO REAL", "🧠"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("2.1 — Dos orquestadores en conflicto (HALLAZGO CRÍTICO)", H2))
story.append(Paragraph(
    "El repositorio contiene <b>DOS orquestadores distintos</b> que coexisten sin coordinación explícita:",
    BODY))

orqs = [
    ["ORQUESTADOR", "ARCHIVO", "TIPO", "ESTADO REAL"],
    ["BrainOrchestrator", "brain/services/orchestrator.py", "NLU rule-based + API calls", "ACTIVO en producción"],
    ["IntelligentOrchestrator", "brain/orchestration/orchestrator.py", "4 microservicios HTTP externos", "INACTIVO — servicios no existen"],
]
ts_orq = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8.5),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_RED_L, C_AMBER_L]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
])
story.append(Table(orqs, colWidths=[4.5*cm, 5.5*cm, 4.5*cm, 3*cm], style=ts_orq, repeatRows=1))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("2.2 — MetaBrain: ¿servicio externo o motor interno?", H2))
story.append(Paragraph(
    "<b>VEREDICTO: MetaBrain es 100% interno y local.</b> No es un servicio externo, no hay llamadas HTTP "
    "salientes, no hay SDK de terceros. 'MetaBrain' es el nombre interno del motor NLU definido en "
    "<i>brain/interpreters/nlu_engine.py</i>. Funciona completamente offline con:",
    BODY))
for item in [
    "Clasificación de intención mediante diccionarios de palabras clave (rule-based)",
    "Fuzzy matching con SequenceMatcher de Python stdlib (umbral 0.65–0.95)",
    "LessonCache con TTL de 5 minutos para lecciones del doctor",
    "KnowledgeMatcher para búsqueda exacta y aproximada en Knowledge Base",
    "Circuit breakers por servicio (shared.utils.resilience — código propio)",
]:
    story.append(Paragraph(f"    ✓  {item}", BODY))

story.append(Spacer(1, 0.2*cm))
story.append(Paragraph("2.3 — Clasificación del nivel de IA", H2))

ia_level_data = [
    ["CAPA", "COMPONENTE", "NIVEL", "DETALLE"],
    ["NLU / Intención", "NLUEngine (MetaBrain)", "Nivel 2–3", "Reglas + fuzzy + context boost"],
    ["Generación NLG", "LinguisticEngine", "Nivel 2", "Templates con variabilidad aleatoria, sin LLM"],
    ["Decisión conversac.", "BrainOrchestrator", "Nivel 2", "FSM de estados (booking, cancel, etc.)"],
    ["Orquestación avanzada", "IntelligentOrchestrator", "Nivel 3 (código)", "Código implementado pero microservicios destino AUSENTES"],
    ["Predicción no-show", "predictionEngine.ts (ONNX)", "Nivel 4", "Modelo ML real, sigmoid, features históricas"],
    ["Autoasignación turnos", "appointmentEngine.ts", "Nivel 3–4", "Scoring multicriteria: fragmentación, preferencia, no-show prob"],
    ["Imaging médica", "predictor.service.ts (ONNX)", "Nivel 3–4", "ONNX con fallback estructurado, softmax, multilabel"],
]
ts_ia = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(2,4),(2,4),C_RED), ("FONTNAME",(2,4),(2,4),"Helvetica-Bold"),
])
story.append(Table(ia_level_data, colWidths=[3.5*cm, 4.5*cm, 2.5*cm, 7*cm], style=ts_ia, repeatRows=1))
story.append(Spacer(1, 0.25*cm))

story.append(Paragraph("Hallazgo crítico: decision_engine/ está VACÍO", H3))
story.append(Paragraph(
    "La carpeta <b>brain/decision_engine/</b> no contiene ningún archivo. "
    "El motor de decisión clínica prometido en la arquitectura (triage, risk_level, flags) "
    "se genera únicamente como <i>fallback estático</i> en el orquestador "
    "(<code>_FALLBACK_DECISION = {risk_level: 'unknown', ...}</code>). "
    "No hay lógica real de triage médico implementada.",
    BODY))

story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 3. PIPELINE WHATSAPP
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("3. PIPELINE WHATSAPP", "📡"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Estado del pipeline de mensajería", H2))
wa_data = [
    ["COMPONENTE", "ESTADO", "EVIDENCIA"],
    ["Webhook entrada", "✓ Implementado", "whatsapp_gateway / FastAPI + verify token"],
    ["Cola Redis entrada", "✓ Implementado", "whatsapp:incoming — BRPOP blocking"],
    ["Retry en salida", "✓ Implementado", "max_retries=5, requeue RPUSH"],
    ["Dead Letter Queue", "✓ Implementado", "whatsapp:outgoing:dead — LPUSH tras 5 fallos"],
    ["Circuit Breaker (Brain)", "✓ Implementado", "CircuitBreakerRegistry por servicio"],
    ["Circuit Breaker (Gateway)", "✗ AUSENTE", "El outgoing_consumer no tiene CB propio"],
    ["Alertas DLQ en tiempo real", "✗ AUSENTE", "No hay webhook/notificación cuando crece DLQ"],
    ["Idempotencia de mensajes", "⚠ PARCIAL", "No hay deduplicación por message_id de Meta"],
    ["Rate limiting WhatsApp", "⚠ PARCIAL", "RateLimit en DB pero no se verifica antes de enviar"],
    ["Logging estructurado", "✓ Implementado", "mask_phone() presente, JSON logs"],
]
ts_wa = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8.5),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(1,6),(1,6),C_RED), ("FONTNAME",(1,6),(1,6),"Helvetica-Bold"),
    ("TEXTCOLOR",(1,7),(1,7),C_RED), ("FONTNAME",(1,7),(1,7),"Helvetica-Bold"),
    ("TEXTCOLOR",(1,8),(1,8),C_AMBER),
    ("TEXTCOLOR",(1,9),(1,9),C_AMBER),
])
story.append(Table(wa_data, colWidths=[5.5*cm, 3.5*cm, 8.5*cm], style=ts_wa, repeatRows=1))
story.append(Spacer(1, 0.25*cm))

story.append(Paragraph(
    "<b>Riesgo principal:</b> Si la DLQ crece silenciosamente (sin alertas), los mensajes fallidos "
    "de pacientes se pierden sin notificación. En un entorno médico, un paciente que no recibe "
    "confirmación de turno puede presentarse sin cita o ausentarse sin cancelar — impacto operativo directo.",
    WARN))
story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 4. AGENDA MÉDICA
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("4. AGENDA MÉDICA — CORE DEL NEGOCIO", "📅"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Nivel del motor de agenda: PRO con matices", H2))
story.append(Paragraph(
    "El <b>appointmentEngine.ts</b> es el componente más maduro del sistema. Implementa un motor "
    "de autoasignación con scoring multicriteria real, no CRUD simple.",
    BODY))

agenda_features = [
    ["FUNCIONALIDAD", "ESTADO", "NIVEL"],
    ["Slots dinámicos por regla de disponibilidad", "✓ Implementado", "PRO"],
    ["Control de solapamiento con DB lock", "✓ Implementado (lockDoctorForScheduling)", "PRO"],
    ["Predicción de no-show con ONNX", "✓ Implementado", "PRO"],
    ["Overbooking inteligente condicional", "✓ Implementado (env configurable)", "PRO"],
    ["Score de fragmentación de agenda", "✓ Implementado (fragmentationScore)", "PRO"],
    ["Preferencia horaria (mañana/tarde)", "✓ Implementado", "MEDIO"],
    ["Autoasignación de médico disponible", "✓ Implementado (findDoctorCandidates)", "PRO"],
    ["Reglas por día semana + fecha específica", "✓ Implementado", "PRO"],
    ["Buffer entre turnos configurable", "⚠ Implícito en slot_duration", "MEDIO"],
    ["Reglas por tipo de consulta (urgencia/control)", "✗ AUSENTE", "FALTA PRO"],
    ["Google Calendar sync bidireccional", "⚠ Mencionado en docs, no en engine", "PENDIENTE"],
    ["Cancelación automática por no confirmación", "✗ AUSENTE", "FALTA PRO"],
    ["Recordatorios automáticos pre-turno (WA)", "✗ AUSENTE en agenda engine", "FALTA PRO"],
]
ts_ag = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(2,11),(2,11),C_RED),("FONTNAME",(2,11),(2,11),"Helvetica-Bold"),
    ("TEXTCOLOR",(2,12),(2,12),C_RED),("FONTNAME",(2,12),(2,12),"Helvetica-Bold"),
    ("TEXTCOLOR",(2,13),(2,13),C_RED),("FONTNAME",(2,13),(2,13),"Helvetica-Bold"),
])
story.append(Table(agenda_features, colWidths=[7.5*cm, 5*cm, 2.5*cm + 2.5*cm], style=ts_ag, repeatRows=1))
story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 5. DASHBOARDS
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("5. DASHBOARDS — SECRETARIA Y MÉDICO", "🖥"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("5.1 — Dashboard Secretaria", H2))
story.append(Paragraph(
    "Implementado en <b>SecretariaDashboard (secretaria-dashboard.tsx)</b>. "
    "Es el dashboard más completo del sistema.",
    BODY))

sec_items = [
    ["FUNCIONALIDAD", "PRESENTE", "INTELIGENCIA"],
    ["FullCalendar con drag & drop de turnos", "✓ SÍ", "UI funcional"],
    ["Vista semanal y mensual", "✓ SÍ", "UI funcional"],
    ["Crear/editar turnos inline", "✓ SÍ", "Formulario completo"],
    ["Gestión de reglas de disponibilidad", "✓ SÍ", "Con slot_duration por regla"],
    ["Panel mensajes fallidos WhatsApp", "✓ SÍ (FailedMessagesPanel)", "Vista de errores de mensajería"],
    ["Importar agenda desde imagen/texto (AI Intake)", "✓ SÍ (OCR+parsing)", "IA real — interpreta PDFs/fotos"],
    ["Alertas de pacientes en espera", "⚠ Solo contador en Dashboard.jsx", "Sin alertas push"],
    ["Sugerencias inteligentes de horario", "✓ SÍ (via /api/recommendations)", "Scoring real con no-show"],
    ["Auto-asignación de turno", "✓ SÍ (/api/appointments/auto-assign)", "Motor de scoring completo"],
    ["Notificación en tiempo real (WebSocket)", "✗ AUSENTE", "Solo polling cada 30s"],
    ["Vista de ocupación por médico", "⚠ Solo en Dashboard overview", "Básica"],
    ["Filtro por especialidad", "✓ SÍ", "Funcional"],
]
ts_sec = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(1,11),(1,11),C_RED),
])
story.append(Table(sec_items, colWidths=[7*cm, 3.5*cm, 7*cm], style=ts_sec, repeatRows=1))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("5.2 — Dashboard Médico", H2))
story.append(Paragraph(
    "Implementado en <b>DoctorDashboard (doctor-dashboard.tsx)</b>. "
    "Orientado a la jornada diaria del médico.",
    BODY))

doc_items = [
    ["FUNCIONALIDAD", "PRESENTE", "EVALUACIÓN"],
    ["Turnos del día (auto-refresh 30s)", "✓ SÍ", "Actualización automática"],
    ["Historial de visitas previas del paciente", "✓ SÍ", "Desde BD, ordenado por fecha"],
    ["Notas clínicas del paciente (editable)", "✓ SÍ", "Campo libre + guardado"],
    ["Registro de evolución clínica", "✓ SÍ", "Se concatena a notes del turno"],
    ["Reprogramar turno desde el panel", "✓ SÍ", "Con fecha/hora + duración"],
    ["Crear turno de seguimiento", "✓ SÍ (/api/appointments/create-followup)", "Con días de intervalo"],
    ["Chat clínico con MetaBrain (IA)", "✓ SÍ", "Historial persistido, respuestas contextuales"],
    ["Chat libre SIN turno seleccionado", "✗ AUSENTE", "Requiere selectedAppointment activo"],
    ["Análisis de imagen médica (ONNX)", "✓ SÍ (en panel imaging)", "ONNX + fallback estructurado"],
    ["Alertas por riesgo clínico", "✗ AUSENTE", "No hay badges de riesgo en lista de turnos"],
    ["Soporte a decisión (sugerencias IA)", "⚠ Solo chat libre", "Sin panel de sugerencias estructurado"],
    ["Vista de estadísticas propias del médico", "✗ AUSENTE", "No hay métricas individuales"],
]
ts_doc = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(1,8),(1,8),C_RED), ("FONTNAME",(1,8),(1,8),"Helvetica-Bold"),
    ("TEXTCOLOR",(1,11),(1,11),C_RED),
    ("TEXTCOLOR",(1,12),(1,12),C_RED),
])
story.append(Table(doc_items, colWidths=[6.5*cm, 3.5*cm, 7.5*cm], style=ts_doc, repeatRows=1))

story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "<b>Nota sobre chat médico:</b> La memoria del usuario indica que el chat del doctor "
    "debe ser LIBRE (sin requerir turno seleccionado). El código actual en "
    "<i>doctor-dashboard.tsx</i> fuerza <code>selectedAppointment</code> como prerequisito "
    "para cargar el historial de chat. Esto bloquea el uso libre del chat entre consultas.",
    WARN))

story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 6. REDIS Y WORKERS
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("6. REDIS / WORKERS / CONCURRENCIA", "⚙️"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Estado de Redis y manejo de colas", H2))

redis_items = [
    ("Cola entrada", "whatsapp:incoming", "OK — BRPOP con timeout=5s"),
    ("Cola salida", "whatsapp:outgoing", "OK — retry + requeue"),
    ("DLQ salida", "whatsapp:outgoing:dead", "OK — LPUSH tras 5 reintentos"),
    ("Estado conversacional", "chat_state:{phone}", "OK — TTL configurable (settings.state_ttl_seconds)"),
    ("Bot pausado (kill-switch)", "bot_paused:{phone}", "OK — toggle manual"),
    ("Métricas del Brain", "brain:metrics:{name}", "OK — contadores con incrby"),
    ("Cache sesiones IA", "session:{id}", "Implementado en OrchestratorSessionManager"),
    ("Memoria semántica", "semantic_memory:{session}", "Implementado en SemanticMemory"),
]
for cola, key, estado in redis_items:
    story.append(Paragraph(f"• <b>{cola}</b> (<i>{key}</i>): {estado}", BODY))

story.append(Spacer(1, 0.2*cm))
story.append(Paragraph("Riesgos detectados en Redis", H2))

redis_risks = [
    ("Sin Redis Sentinel/Cluster", "CRÍTICO", "Single node Redis. Si cae, el sistema de mensajería cae completo. No hay configuración de HA en docker-compose.yml."),
    ("Sin persistencia garantizada", "ALTO", "Redis por defecto (docker redis:7-alpine) no tiene AOF habilitado. Mensajes en cola pueden perderse ante restart."),
    ("Race condition en StateManager", "BAJO-MEDIO", "El bloqueo usa Lua script para unlock pero la adquisición del lock tiene retry sin backoff exponencial (sleep fijo)."),
    ("Bulkhead inference: semaphore=5", "MEDIO", "Si inference-service existiera, máximo 5 requests concurrentes. Con múltiples workers escalaría como cuello de botella."),
    ("Sin monitoreo de longitud de cola", "MEDIO", "No hay alerta si whatsapp:incoming crece. Un burst de mensajes puede acumular sin notificación."),
]
for risk, level, desc in redis_risks:
    color_text = "✗" if level == "CRÍTICO" else "⚠"
    story.append(Paragraph(f"  {color_text}  <b>[{level}] {risk}:</b> {desc}", BODY))

story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 7. MOTOR NLG
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("7. MOTOR NLG — GENERACIÓN DE LENGUAJE", "💬"))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph(
    "El <b>LinguisticEngine</b> (brain/orchestration/linguistic_engine.py) es un generador "
    "de lenguaje propio sin LLM. Evaluación técnica:",
    BODY))

nlg_items = [
    ["CRITERIO", "ESTADO", "DETALLE"],
    ["Variabilidad de respuestas", "✓ Implementado", "_pick_unique() evita repetir la misma frase"],
    ["Contexto clínico en respuesta", "✓ Parcial", "Usa risk_level, triage, symptoms si los hay"],
    ["Templates dinámicos", "✓ SÍ", "risk_templates, triage_templates, symptom_templates"],
    ["Frases de emergencia", "✓ SÍ", "emergency_phrases aleatorias"],
    ["Adaptación casual vs clínico", "✓ SÍ", "detect_input_type() → shortcut casual o pipeline clínico"],
    ["Generación sin contexto suficiente", "✓ SÍ", "low_information_phrases con variabilidad"],
    ["Español rioplatense natural", "✓ SÍ", "Tuteo, 'contas', 'vos', sin robotismo"],
    ["Soporte multilenguaje", "✗ AUSENTE", "Solo español. Sin configuración de idioma."],
    ["Personalización por paciente", "✗ AUSENTE", "No usa nombre del paciente en respuestas WA"],
    ["Conector con historial de conversación", "⚠ Parcial", "History se pasa pero NLG no lo lee directamente"],
    ["Respuestas estructuradas (listas, botones)", "✗ AUSENTE", "Solo texto plano. Sin interactive messages WA"],
]
ts_nlg = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_PRIMARY), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),8),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.4,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7), ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("TEXTCOLOR",(1,10),(1,10),C_RED),
    ("TEXTCOLOR",(1,11),(1,11),C_RED),
    ("TEXTCOLOR",(1,12),(1,12),C_RED),
])
story.append(Table(nlg_items, colWidths=[5.5*cm, 3.5*cm, 8.5*cm], style=ts_nlg, repeatRows=1))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "<b>Evaluación:</b> El NLG es adecuado para un MVP en producción. La mayor limitación "
    "es la ausencia de WhatsApp Interactive Messages (botones, listas) que mejorarían "
    "significativamente la tasa de conversión en el flujo de booking.",
    BODY))
story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 8. PROBLEMAS CRÍTICOS TOP 5
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("8. PROBLEMAS CRÍTICOS — TOP 5", "🚨"))
story.append(Spacer(1, 0.3*cm))

criticos = [
    (
        "#1 BLOQUEANTE — Microservicios IA inexistentes",
        "El IntelligentOrchestrator (brain/orchestration/orchestrator.py) referencia 4 servicios HTTP "
        "(dialogue-engine, inference-service, decision-service, nlg-service) mediante clientes HTTP con "
        "circuit breakers y retry. Estos servicios NO EXISTEN como contenedores ni código en el repo. "
        "El sistema funciona porque el BrainOrchestrator (services/orchestrator.py) es el que realmente "
        "se usa en el worker, pero si alguien activa el IntelligentOrchestrator todos los requests fallan "
        "y caen al fallback estático. Nivel de riesgo: ARQUITECTURAL.",
        C_RED_L
    ),
    (
        "#2 CRÍTICO — Redis sin alta disponibilidad",
        "El broker de mensajería completo (incoming/outgoing queues, state, metrics) depende de un "
        "único nodo Redis sin Sentinel, sin Cluster, sin AOF persistencia. Un restart del contenedor "
        "Redis durante un pico de mensajes implica pérdida irreversible de conversaciones activas "
        "y mensajes pendientes. En un sistema médico esto equivale a citas perdidas.",
        C_RED_L
    ),
    (
        "#3 CRÍTICO — Chat médico no funciona sin turno seleccionado",
        "El DoctorDashboard requiere que haya un selectedAppointment activo para cargar el chat con "
        "MetaBrain (loadChatHistory usa selectedAppointment.patient.id como prerequisito). Si el médico "
        "no tiene turnos ese día, o quiere hacer una consulta libre, el chat está bloqueado. "
        "La preferencia del usuario es explícita: el chat debe ser libre.",
        C_AMBER_L
    ),
    (
        "#4 ALTO — decision_engine/ vacío + triage siempre 'unknown'",
        "La carpeta brain/decision_engine/ no tiene código. El campo triage_level retorna 'unknown' "
        "en todos los flujos de fallback. El sistema no tiene capacidad real de triaje clínico. "
        "Esto es un gap funcional importante para cualquier clínica que necesite priorización de urgencias.",
        C_AMBER_L
    ),
    (
        "#5 ALTO — Sin WebSockets / push notifications en paneles",
        "Todos los dashboards usan polling HTTP (30s para el panel médico, 15s para el dashboard "
        "interno de GSentinelHealthOS). En un entorno clínico real con 10+ médicos y 100+ turnos "
        "simultáneos, el polling genera carga innecesaria y latencia en alertas críticas. "
        "Un turno agregado por WhatsApp tarda hasta 30s en aparecer en el panel de la secretaria.",
        C_AMBER_L
    ),
]

for title, desc, bg in criticos:
    tbl = Table(
        [[Paragraph(f"<b>{title}</b>", S("ct", fontSize=9, textColor=C_DARK, fontName="Helvetica-Bold", leading=13))],
         [Paragraph(desc, BODY)]],
        colWidths=[W - 4*cm],
        style=TableStyle([
            ("BACKGROUND",(0,0),(-1,-1),bg),
            ("TOPPADDING",(0,0),(-1,-1),8),
            ("BOTTOMPADDING",(0,0),(-1,-1),8),
            ("LEFTPADDING",(0,0),(-1,-1),12),
            ("RIGHTPADDING",(0,0),(-1,-1),12),
            ("GRID",(0,0),(-1,-1),0.5,HexColor("#FECACA")),
            ("ROUNDEDCORNERS",[3]),
        ])
    )
    story.append(tbl)
    story.append(Spacer(1, 0.25*cm))

story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 9. QUÉ FALTA PARA SER PRO
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("9. QUÉ FALTA PARA SER PRO", "🚀"))
story.append(Spacer(1, 0.3*cm))

pro_items = [
    ("INFRAESTRUCTURA", [
        "Redis Sentinel o Redis Cluster + AOF persistencia habilitada",
        "PostgreSQL con réplica de lectura + backup automático (pg_dump en cron)",
        "Health checks reales en docker-compose (no solo el CMD)",
        "Rate limiter Redis en gateway (no solo en DB) para proteger ante floods",
    ]),
    ("IA y DECISIONES", [
        "Implementar realmente los 4 microservicios del IntelligentOrchestrator O eliminar la capa y unificar en BrainOrchestrator",
        "Poblar brain/decision_engine/ con lógica de triage (Manchester Triage System simplificado: 5 niveles por síntomas clave)",
        "Conectar predictionEngine ONNX al BrainOrchestrator (hoy solo existe en medical-agenda-saas, no en el worker de WA)",
        "Activar WhatsApp Interactive Messages (botones de selección de horario, confirmación de turno)",
    ]),
    ("PANELES Y UX MÉDICA", [
        "Chat médico libre sin prerequisito de turno seleccionado (ya documentado como preferencia del usuario)",
        "Botón de borrar historial de chat desde la interfaz (preferencia del usuario)",
        "WebSockets en secretaria-dashboard para actualización en tiempo real de nuevos turnos WA",
        "Panel de análisis de imagen: informe médico preliminar (hallazgos/impresión/recomendaciones) en vez de solo metadatos",
        "Badges de riesgo clínico en lista de turnos del médico (bajo/medio/alto basado en historial)",
        "Estadísticas propias del médico: tasa de no-show, ocupación promedio, tiempo promedio de consulta",
    ]),
    ("AGENDA MÉDICA", [
        "Reglas de duración por TIPO de consulta (primera vez: 45min, control: 20min, urgencia: 15min)",
        "Sistema de recordatorios automáticos 24h antes via WhatsApp (job scheduler)",
        "Cancelación automática con ventana de gracia si el paciente no confirma",
        "Integración completa Google Calendar (sincronización bidireccional — documentado pero no implementado en engine)",
    ]),
    ("SEGURIDAD Y COMPLIANCE", [
        "Auditoría completa implementada (AuditLog existe en schema, verificar que TODOS los endpoints la usen)",
        "Encriptación de datos sensibles en reposo (notas clínicas, documentos de pacientes)",
        "HIPAA/GDPR compliance review: retención de datos, derecho al olvido, anonimización",
        "2FA para roles médico y admin",
        "Firma digital de órdenes y evoluciones clínicas",
    ]),
]

for category, items in pro_items:
    story.append(Paragraph(category, H2))
    for item in items:
        story.append(Paragraph(f"    →  {item}", BODY))
    story.append(Spacer(1, 0.1*cm))

story.append(hr())
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════
# 10. VEREDICTO FINAL
# ══════════════════════════════════════════════════════════════════════
story.append(section_header("10. VEREDICTO FINAL", "🧾"))
story.append(Spacer(1, 0.35*cm))

verdict_data = [
    ["DIMENSIÓN", "VEREDICTO", "PUNTUACIÓN"],
    ["Arquitectura general", "Event-driven híbrida, SPOF en Redis", "6.5 / 10"],
    ["Motor de IA (autonomía)", "Autónomo local. MetaBrain = interno. Nivel 3 real.", "7 / 10"],
    ["Independencia de MetaBrain", "100% independiente. Sin servicios externos.", "10 / 10"],
    ["Motor IntelligentOrchestrator", "Código completo PERO microservicios destino no existen", "2 / 10"],
    ["Agenda médica", "Nivel PRO real. Scoring, ONNX, overbooking, locks.", "8.5 / 10"],
    ["Dashboard Secretaria", "Funcional y con IA embebida. Falta push real-time.", "7.5 / 10"],
    ["Dashboard Médico", "Útil clínicamente. Chat bloqueado sin turno.", "6 / 10"],
    ["Pipeline WhatsApp", "DLQ + Retry correctos. Sin CB en gateway ni dedup.", "7 / 10"],
    ["NLG propio", "Variabilidad buena. Sin botones interactivos.", "6.5 / 10"],
    ["Multi-tenant SaaS", "Implementado correctamente en medical-agenda-saas.", "8 / 10"],
    ["Seguridad", "Auth JWT, roles, audit log. Sin 2FA ni encriptación en reposo.", "6 / 10"],
    ["Preparación producción", "Pre-producción avanzado. 3 blockers críticos.", "5.5 / 10"],
]
ts_v = TableStyle([
    ("BACKGROUND",(0,0),(-1,0),C_BG_HDR), ("TEXTCOLOR",(0,0),(-1,0),C_WHITE),
    ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),9),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_GRAY_L, C_WHITE]),
    ("GRID",(0,0),(-1,-1),0.5,HexColor("#CBD5E1")),
    ("TOPPADDING",(0,0),(-1,-1),6), ("BOTTOMPADDING",(0,0),(-1,-1),6),
    ("LEFTPADDING",(0,0),(-1,-1),9), ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("ALIGN",(2,0),(-1,-1),"CENTER"),
    ("FONTNAME",(2,1),(-1,-1),"Helvetica-Bold"),
    ("TEXTCOLOR",(2,4),(2,4),C_RED),
])
story.append(Table(verdict_data, colWidths=[6*cm, 8.5*cm, 3*cm], style=ts_v, repeatRows=1))
story.append(Spacer(1, 0.4*cm))

# Resumen final
final_box = Table(
    [[Paragraph("DIAGNÓSTICO FINAL DEL SISTEMA", S("fb_h", fontSize=11, textColor=C_WHITE, fontName="Helvetica-Bold", leading=15, alignment=TA_CENTER))],
     [Paragraph(
        "GSentinelHealthOS es un sistema de agenda médica con IA real, en estado "
        "<b>PRE-PRODUCCIÓN AVANZADO</b>. Tiene componentes genuinamente sólidos "
        "(motor de autoasignación con ONNX, multi-tenant, DLQ, circuit breakers, ONNX imaging) "
        "y componentes rotos o incompletos (IntelligentOrchestrator sin microservicios, "
        "decision_engine vacío, Redis sin HA, chat médico con prerequisito bloqueante).",
        S("fb_b", fontSize=9.5, textColor=C_WHITE, fontName="Helvetica", leading=14)
     )],
     [Paragraph(
        "¿Es SaaS real? SÍ — multi-tenant con Prisma, planes, límites y slug funcionan.<br/>"
        "¿Es IA médica real? PARCIALMENTE — La predicción ONNX y el engine de autoasignación son IA real. "
        "El NLU del chatbot es rule-based avanzado. El triage clínico está AUSENTE.<br/>"
        "¿Está listo para PRO? NO — Requiere resolver los 5 problemas críticos antes de ir a producción real.",
        S("fb_c", fontSize=9, textColor=HexColor("#BFDBFE"), fontName="Helvetica", leading=13)
     )],
    ],
    colWidths=[W - 4*cm],
    style=TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),C_BG_HDR),
        ("TOPPADDING",(0,0),(-1,-1),12),
        ("BOTTOMPADDING",(0,0),(-1,-1),12),
        ("LEFTPADDING",(0,0),(-1,-1),18),
        ("RIGHTPADDING",(0,0),(-1,-1),18),
        ("ROUNDEDCORNERS",[6]),
        ("LINEBELOW",(0,0),(-1,0),0.5,HexColor("#3B82F6")),
        ("LINEBELOW",(0,1),(-1,1),0.5,HexColor("#3B82F6")),
    ])
)
story.append(final_box)
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph(
    f"Documento generado el 23 de abril de 2026 · Auditoría basada en análisis directo del código fuente · "
    f"GSentinelHealthOS — Uso interno confidencial",
    CENTER
))

# ══════════════════════════════════════════════════════════════════════
# BUILD
# ══════════════════════════════════════════════════════════════════════
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm,
    rightMargin=2*cm,
    topMargin=2*cm,
    bottomMargin=2*cm,
    title="Auditoría Técnica GSentinelHealthOS 2026",
    author="GitHub Copilot — HealthTech Audit",
)
doc.build(story)
print(f"PDF generado: {OUTPUT}")
