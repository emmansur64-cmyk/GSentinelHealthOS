# Groq Vision - análisis asistido de imagen

Endpoint productivo: `POST /api/ai/image-analysis`

Variables:

```env
GROQ_IMAGE_ANALYSIS_API_KEY=
GROQ_IMAGE_ANALYSIS_BASE_URL=https://api.groq.com/openai/v1
GROQ_IMAGE_ANALYSIS_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_IMAGE_ANALYSIS_MAX_MB=10
```

Si `GROQ_IMAGE_ANALYSIS_API_KEY` queda vacía, el backend reutiliza `DOCTOR_CHAT_GROQ_API_KEY`, `GROQ_API_KEY` o `DOCUMENT_AI_API_KEY`.

El informe es preliminar, orientativo y requiere validación de un profesional médico. No debe utilizarse como diagnóstico definitivo ni como indicación de tratamiento.
