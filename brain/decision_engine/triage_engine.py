"""Motor de triage clínico basado en el Sistema de Triage de Manchester (MTS).

Implementación determinística, 100% offline, sin dependencias externas.

Niveles de triage según MTS:
  rojo     → Inmediato       (riesgo vital, max 0 min)
  naranja  → Muy urgente     (15 min)
  amarillo → Urgente         (60 min)
  verde    → Normal          (120 min)
  azul     → No urgente      (diferible / ambulatorio)

Entradas:
  symptoms          : list[str] — síntomas reportados en texto libre
  duration_days     : float | None — duración en días (puede ser fracción: 0.5 = 12h)
  age               : int | None — edad del paciente en años
  chronic_conditions: list[str] — enfermedades crónicas preexistentes

Salida:
  {
    "triage_level"      : str   — rojo / naranja / amarillo / verde / azul
    "risk_score"        : float — 0.0 a 1.0 (1.0 = máximo riesgo)
    "recommended_action": str
    "flags"             : list[str]
    "matched_criteria"  : list[str]  — reglas que dispararon el nivel
  }
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from typing import Any

# ── Normalización ─────────────────────────────────────────────────────────────

def _n(text: str) -> str:
    """Normaliza a minúsculas sin acentos."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _contains(haystack: str, *needles: str) -> bool:
    return any(needle in haystack for needle in needles)


# ── Reglas de triage (en orden de prioridad descendente) ──────────────────────

@dataclass
class _Rule:
    """Una regla de triage. level: rojo=5, naranja=4, amarillo=3, verde=2, azul=1."""
    name: str
    level: str
    score: float
    check: Any  # callable(symptoms_text, duration, age, chronic_text) -> bool


def _build_rules() -> list[_Rule]:
    return [

        # ── ROJO — Emergencias vitales ────────────────────────────────────────
        _Rule("paro_cardiaco", "rojo", 1.00,
              lambda s, d, a, c: _contains(s, "paro cardiaco", "paro cardiorespiratorio",
                                           "no respira", "no tiene pulso", "apnea")),

        _Rule("inconsciente", "rojo", 0.98,
              lambda s, d, a, c: _contains(s, "inconsciente", "no reacciona",
                                           "perdida de conciencia", "sin conciencia",
                                           "desmayo prolongado")),

        _Rule("convulsion_activa", "rojo", 0.97,
              lambda s, d, a, c: _contains(s, "convulsion", "convulsionando",
                                           "ataque epileptico", "status epileptico")),

        _Rule("shock_hemorragico", "rojo", 0.96,
              lambda s, d, a, c: _contains(s, "hemorragia grave", "sangrado masivo",
                                           "shock hemorragico", "shock anafilactico",
                                           "asfixia", "ahoga")),

        _Rule("iam_evc", "rojo", 0.95,
              lambda s, d, a, c: _contains(s, "infarto", "ataque al corazon",
                                           "derrame cerebral", "accidente cerebrovascular",
                                           "avc", "apoplejia")),

        _Rule("sobredosis", "rojo", 0.94,
              lambda s, d, a, c: _contains(s, "sobredosis", "intoxicacion grave",
                                           "veneno", "envenenamiento")),

        _Rule("trauma_grave", "rojo", 0.93,
              lambda s, d, a, c: _contains(s, "trauma grave", "accidente grave",
                                           "politraumatismo", "aplastamiento")),

        # ── NARANJA — Muy urgente ─────────────────────────────────────────────
        _Rule("dolor_pecho_disnea", "naranja", 0.88,
              lambda s, d, a, c: _contains(s, "dolor pecho", "dolor de pecho",
                                           "opresion en el pecho", "presion en el pecho",
                                           "dolor toracico") and
                                 _contains(s, "dificultad respirar", "falta de aire",
                                           "disnea", "no puede respirar")),

        _Rule("dolor_pecho_solo", "naranja", 0.82,
              lambda s, d, a, c: _contains(s, "dolor pecho", "dolor de pecho",
                                           "dolor toracico", "opresion en el pecho")),

        _Rule("disnea_severa", "naranja", 0.85,
              lambda s, d, a, c: _contains(s, "no puede respirar", "dificultad respirar",
                                           "falta de aire severa", "ahogo",
                                           "saturacion baja")),

        _Rule("evc_sospecha", "naranja", 0.87,
              lambda s, d, a, c: _contains(s, "debilidad brazo", "cara caida",
                                           "habla trabada", "confusion brusca",
                                           "vision perdida brusca", "asimetria facial")),

        _Rule("taquicardia_arritmia", "naranja", 0.80,
              lambda s, d, a, c: _contains(s, "taquicardia", "arritmia",
                                           "palpitaciones fuertes", "corazon acelerado",
                                           "fibrilacion")),

        _Rule("hipertension_crisis", "naranja", 0.81,
              lambda s, d, a, c: _contains(s, "presion muy alta", "crisis hipertensiva",
                                           "200 de presion", "tension muy alta")),

        _Rule("fractura_abierta", "naranja", 0.79,
              lambda s, d, a, c: _contains(s, "fractura abierta", "hueso expuesto",
                                           "fractura expuesta")),

        _Rule("quemadura_grave", "naranja", 0.83,
              lambda s, d, a, c: _contains(s, "quemadura grave", "quemadura extensa",
                                           "quemadura tercer grado")),

        _Rule("hematuria_vomito_sangre", "naranja", 0.78,
              lambda s, d, a, c: _contains(s, "sangre en orina", "orina con sangre",
                                           "hematuria", "vomitos con sangre",
                                           "vomitar sangre", "hemoptisis")),

        # Cardíaco agudo en paciente con antecedentes cardíacos
        _Rule("cardiaco_cronico_sintoma", "naranja", 0.84,
              lambda s, d, a, c: _contains(c, "cardiopatia", "insuficiencia cardiaca",
                                           "stent", "marcapasos", "infarto previo") and
                                 _contains(s, "dolor", "disnea", "falta de aire",
                                           "palpitaciones")),

        _Rule("fiebre_alta_neonato", "naranja", 0.87,
              lambda s, d, a, c: (a is not None and a < 3) and _contains(s, "fiebre")),

        # ── AMARILLO — Urgente ────────────────────────────────────────────────
        _Rule("fiebre_prolongada", "amarillo", 0.65,
              lambda s, d, a, c: _contains(s, "fiebre") and
                                 d is not None and d >= 3),

        _Rule("dolor_abdominal_moderado", "amarillo", 0.62,
              lambda s, d, a, c: _contains(s, "dolor abdominal", "dolor de panza",
                                           "dolor estomago", "dolor de barriga")),

        _Rule("traumatismo_cabeza", "amarillo", 0.70,
              lambda s, d, a, c: _contains(s, "golpe en la cabeza", "traumatismo craneal",
                                           "traumatismo de craneo", "cabeza golpeada",
                                           "nuca golpeada")),

        _Rule("fractura_cerrada", "amarillo", 0.66,
              lambda s, d, a, c: _contains(s, "fractura", "hueso roto", "fracturado") and
                                 not _contains(s, "fractura abierta", "hueso expuesto")),

        _Rule("convulsion_pasada", "amarillo", 0.68,
              lambda s, d, a, c: _contains(s, "tuvo convulsion", "le dio convulsion",
                                           "convulsiono") and
                                 not _contains(s, "convulsionando", "convulsion activa")),

        _Rule("dolor_intenso", "amarillo", 0.60,
              lambda s, d, a, c: _contains(s, "dolor intenso", "dolor muy fuerte",
                                           "dolor insoportable", "dolor severo")),

        _Rule("deshidratacion_vomitos", "amarillo", 0.63,
              lambda s, d, a, c: _contains(s, "vomito", "vomitos") and
                                 _contains(s, "no puede tomar liquidos", "deshidratado",
                                           "sin poder beber")),

        _Rule("fiebre_nino", "amarillo", 0.65,
              lambda s, d, a, c: (a is not None and 3 <= a <= 12) and
                                 _contains(s, "fiebre alta", "40 grados", "39 grados")),

        _Rule("disnea_moderada", "amarillo", 0.64,
              lambda s, d, a, c: _contains(s, "falta de aire", "disnea", "le cuesta respirar") and
                                 not _contains(s, "severa", "no puede", "saturacion baja")),

        _Rule("confusion_moderada", "amarillo", 0.67,
              lambda s, d, a, c: _contains(s, "confuso", "desorientado", "no reconoce") and
                                 not _contains(s, "brusca", "confusion brusca")),

        # Cronico descompensado
        _Rule("diabetico_sintoma_agudo", "amarillo", 0.70,
              lambda s, d, a, c: _contains(c, "diabetes") and
                                 _contains(s, "hipoglucemia", "azucar baja",
                                           "glucemia", "mucho sed", "vision borrosa")),

        _Rule("asmatico_crisis", "amarillo", 0.72,
              lambda s, d, a, c: _contains(c, "asma") and
                                 _contains(s, "falta de aire", "broncoespasmo",
                                           "silbido al respirar", "sibilancias")),

        _Rule("rabdomiolisis_sospecha", "amarillo", 0.76,
              lambda s, d, a, c: _contains(s, "dolor muscular") and
                                 _contains(s, "orina oscura", "mioglobinuria", "debilidad")),

        _Rule("rabdomiolisis_complicada", "naranja", 0.86,
              lambda s, d, a, c: _contains(s, "dolor muscular") and
                                 _contains(s, "orina oscura", "mioglobinuria") and
                                 _contains(s, "ck muy elevada", "creatinina elevada", "hiperpotasemia")),

        # ── VERDE — Normal / leve ─────────────────────────────────────────────
        _Rule("fiebre_corta", "verde", 0.40,
              lambda s, d, a, c: _contains(s, "fiebre") and
                                 (d is None or d < 3)),

        _Rule("tos", "verde", 0.35,
              lambda s, d, a, c: _contains(s, "tos") and
                                 not _contains(s, "sangre", "hemoptisis")),

        _Rule("dolor_leve", "verde", 0.38,
              lambda s, d, a, c: _contains(s, "dolor leve", "molestia", "incomodidad")),

        _Rule("nausea_leve", "verde", 0.36,
              lambda s, d, a, c: _contains(s, "nausea", "nauseas", "mareo leve") and
                                 not _contains(s, "vomitos", "deshidratado")),

        _Rule("rash_leve", "verde", 0.37,
              lambda s, d, a, c: _contains(s, "sarpullido", "rash", "picazon", "urticaria leve")),

        _Rule("diarrea_leve", "verde", 0.36,
              lambda s, d, a, c: _contains(s, "diarrea") and
                                 not _contains(s, "sangre", "sangrado")),

        _Rule("cansancio", "verde", 0.32,
              lambda s, d, a, c: _contains(s, "cansancio", "fatiga", "falta de energia") and
                                 not _contains(s, "extremo", "severo")),

        _Rule("cefalea_leve", "verde", 0.38,
              lambda s, d, a, c: _contains(s, "dolor de cabeza", "cefalea") and
                                 not _contains(s, "thunderclap", "intenso", "el peor de su vida")),

        # ── AZUL — No urgente / ambulatorio ──────────────────────────────────
        _Rule("consulta_seguimiento", "azul", 0.20,
              lambda s, d, a, c: _contains(s, "control", "seguimiento", "chequeo",
                                           "revision", "renovar receta", "resultado")),

        _Rule("sintoma_cronico_estable", "azul", 0.18,
              lambda s, d, a, c: _contains(s, "siempre tengo", "cronica", "habitual",
                                           "de siempre", "ya lo tengo hace") and
                                 not _contains(s, "empeoro", "peor", "agudo")),
    ]


_RULES: list[_Rule] = _build_rules()

# ── Acciones recomendadas por nivel ──────────────────────────────────────────

_ACTIONS: dict[str, str] = {
    "rojo":     "Activar servicio de emergencias (911 / ambulancia). Atención inmediata.",
    "naranja":  "Presentarse a guardia de urgencias en los próximos 15 minutos.",
    "amarillo": "Consulta médica presencial dentro de las próximas 1-2 horas.",
    "verde":    "Consulta médica programada. Turnos disponibles según agenda.",
    "azul":     "Consulta ambulatoria o de seguimiento. Sin urgencia inmediata.",
}

_LEVEL_RANK: dict[str, int] = {
    "rojo": 5, "naranja": 4, "amarillo": 3, "verde": 2, "azul": 1,
}

# ── API pública ───────────────────────────────────────────────────────────────

@dataclass
class TriageInput:
    symptoms: list[str] = field(default_factory=list)
    duration_days: float | None = None
    age: int | None = None
    chronic_conditions: list[str] = field(default_factory=list)


@dataclass
class TriageResult:
    triage_level: str
    risk_score: float
    recommended_action: str
    flags: list[str]
    matched_criteria: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "triage_level": self.triage_level,
            "risk_score": round(self.risk_score, 3),
            "recommended_action": self.recommended_action,
            "flags": self.flags,
            "matched_criteria": self.matched_criteria,
        }


def evaluate(
    symptoms: list[str],
    duration_days: float | None = None,
    age: int | None = None,
    chronic_conditions: list[str] | None = None,
) -> TriageResult:
    """Evalúa el nivel de triage según los síntomas y contexto clínico.

    Determinístico: misma entrada → mismo resultado siempre.
    Sin IO, sin red, sin modelos externos.

    Args:
        symptoms         : lista de síntomas en texto libre (español)
        duration_days    : días de evolución (0.5 = 12 horas). None = desconocido.
        age              : edad en años. None = desconocida.
        chronic_conditions: lista de condiciones crónicas conocidas.

    Returns:
        TriageResult con triage_level, risk_score, recommended_action, flags,
        matched_criteria.
    """
    chronic_conditions = chronic_conditions or []

    # Normalizar entradas
    symptoms_text = _n(" ".join(symptoms))
    chronic_text = _n(" ".join(chronic_conditions))

    # Evaluar todas las reglas
    best_level = "azul"
    best_score = 0.10
    matched: list[str] = []
    flags: list[str] = []

    for rule in _RULES:
        try:
            fired = rule.check(symptoms_text, duration_days, age, chronic_text)
        except Exception:
            continue

        if not fired:
            continue

        matched.append(rule.name)
        if rule.score > best_score:
            best_score = rule.score
            best_level = rule.level

    # Ajustes contextuales al score final
    best_score = _apply_age_modifier(best_score, age, best_level)
    best_score = _apply_chronic_modifier(best_score, chronic_text, best_level)
    best_score = min(best_score, 1.0)

    # Generar flags descriptivos
    flags = _build_flags(best_level, age, chronic_text, symptoms_text, duration_days)

    # Si no se disparó ninguna regla pero hay síntomas → verde por defecto
    if not matched and symptoms:
        best_level = "verde"
        best_score = 0.30
        matched.append("sintoma_generico")

    # Si literalmente no hay síntomas → azul
    if not symptoms:
        best_level = "azul"
        best_score = 0.10

    return TriageResult(
        triage_level=best_level,
        risk_score=best_score,
        recommended_action=_ACTIONS[best_level],
        flags=flags,
        matched_criteria=matched,
    )


# ── Modificadores contextuales ────────────────────────────────────────────────

def _apply_age_modifier(score: float, age: int | None, level: str) -> float:
    if age is None:
        return score
    # Menores de 3 años o mayores de 80: +10% en niveles moderados a bajos
    if (age < 3 or age > 80) and level in {"amarillo", "verde", "azul"}:
        return min(score + 0.10, 1.0)
    return score


def _apply_chronic_modifier(score: float, chronic_text: str, level: str) -> float:
    high_risk_conditions = (
        "cardiopatia", "insuficiencia cardiaca", "epoc", "diabetes insulino",
        "inmunosuprimido", "cancer", "insuficiencia renal", "cirrosis",
        "transplantado", "anticoagulado",
    )
    if any(cond in chronic_text for cond in high_risk_conditions):
        if level in {"amarillo", "verde"}:
            return min(score + 0.08, 1.0)
    return score


def _build_flags(
    level: str,
    age: int | None,
    chronic_text: str,
    symptoms_text: str,
    duration_days: float | None,
) -> list[str]:
    flags: list[str] = []

    if level == "rojo":
        flags.append("emergency_alert")

    if level in {"rojo", "naranja"}:
        flags.append("requires_immediate_attention")

    if age is not None:
        if age < 3:
            flags.append("pediatric_neonate")
        elif age < 12:
            flags.append("pediatric")
        elif age > 80:
            flags.append("elderly_high_risk")

    if chronic_text and any(
        w in chronic_text for w in ("cardiopatia", "insuficiencia cardiaca", "stent")
    ):
        flags.append("cardiac_history")

    if chronic_text and "diabetes" in chronic_text:
        flags.append("diabetic_patient")

    if duration_days is not None and duration_days >= 7:
        flags.append("prolonged_evolution")

    return flags


# ── Wrapper con firma de diccionario (spec público) ───────────────────────────

def evaluate_input(input: dict) -> dict:  # noqa: A002
    """Evalúa el triage a partir de un dict de entrada.

    Firma compatible con la especificación del motor clínico:

        input = {
            "symptoms"          : list[str]  — síntomas en texto libre
            "age"               : int | None
            "duration"          : float | None  — días de evolución
            "chronic_conditions": list[str]
        }

    Retorna::

        {
            "triage_level": str    — rojo / naranja / amarillo / verde / azul
            "risk_score"  : float  — 0.0 – 1.0
            "action"      : str    — acción recomendada
        }

    Para la salida completa (flags, matched_criteria) usar ``evaluate()`` directamente.
    """
    result = evaluate(
        symptoms=input.get("symptoms") or [],
        duration_days=input.get("duration"),
        age=input.get("age"),
        chronic_conditions=input.get("chronic_conditions"),
    )
    return {
        "triage_level": result.triage_level,
        "risk_score": round(result.risk_score, 3),
        "action": result.recommended_action,
    }
