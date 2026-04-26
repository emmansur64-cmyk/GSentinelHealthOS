import { z } from "zod";

export const DOCUMENT_ANALYSIS_SCHEMA_VERSION = "1.0.0";

const qualityEnum = z.enum(["high", "medium", "low"]);
const confidenceNumber = z.number().min(0).max(1);

const bboxSchema = z
  .object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0),
  })
  .strict();

const statusFlagEnum = z.enum(["normal", "high", "low", "critical", "abnormal"]);

const diagnosisSchema = z
  .object({
    code_system: z.string().trim().min(1).max(40),
    code: z.string().trim().max(40).default(""),
    description: z.string().trim().max(500).default(""),
    confidence: confidenceNumber,
  })
  .strict();

const medicationSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    dose: z.string().trim().max(120).default(""),
    route: z.string().trim().max(120).default(""),
    frequency: z.string().trim().max(200).default(""),
    duration: z.string().trim().max(200).default(""),
    instructions: z.string().trim().max(2000).default(""),
    confidence: confidenceNumber,
  })
  .strict();

const labResultSchema = z
  .object({
    test_name: z.string().trim().min(1).max(200),
    value: z.string().trim().max(120).default(""),
    unit: z.string().trim().max(40).default(""),
    reference_range: z.string().trim().max(120).default(""),
    flag: statusFlagEnum.default("normal"),
    confidence: confidenceNumber,
  })
  .strict();

const billingItemSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    quantity: z.number().int().min(0),
    unit_price: z.number().min(0),
    total_price: z.number().min(0),
  })
  .strict();

const sectionCoordinateSchema = z
  .object({
    section_name: z.string().trim().min(1).max(120),
    bbox: bboxSchema,
  })
  .strict();

export const documentAnalysisSchema = z
  .object({
    schema_version: z.literal(DOCUMENT_ANALYSIS_SCHEMA_VERSION),
    document_type: z.string().trim().min(1).max(120),
    language: z.string().trim().min(2).max(40),
    quality: qualityEnum,
    quality_score: z.number().min(0).max(1),
    orientation_correction_applied: z.boolean(),
    detected_sections: z.array(z.string().trim().min(1).max(120)),
    raw_extracted_text: z.string().max(200000),
    observations: z.array(z.string().trim().min(1).max(5000)),

    patient: z
      .object({
        full_name: z.string().trim().max(200).default(""),
        document_id: z.string().trim().max(80).default(""),
        dob: z.string().trim().max(40).default(""),
        sex: z.string().trim().max(30).default(""),
        age: z.number().int().min(0).max(130).nullable(),
        insurance: z.string().trim().max(200).default(""),
      })
      .strict(),

    provider: z
      .object({
        professional_name: z.string().trim().max(200).default(""),
        license_number: z.string().trim().max(80).default(""),
        specialty: z.string().trim().max(120).default(""),
        facility_name: z.string().trim().max(200).default(""),
        facility_id: z.string().trim().max(80).default(""),
      })
      .strict(),

    document_metadata: z
      .object({
        document_id: z.string().trim().max(120).default(""),
        issue_date: z.string().trim().max(40).default(""),
        service_date: z.string().trim().max(40).default(""),
        page_count: z.number().int().min(1),
        currency: z.string().trim().max(20).default(""),
        country: z.string().trim().max(80).default(""),
      })
      .strict(),

    clinical_content: z
      .object({
        chief_complaint: z.string().trim().max(4000).default(""),
        diagnoses: z.array(diagnosisSchema),
        medications: z.array(medicationSchema),
        allergies: z.array(z.string().trim().min(1).max(300)),
        vitals: z
          .object({
            blood_pressure: z.string().trim().max(60).default(""),
            heart_rate_bpm: z.number().int().min(0).max(350).nullable(),
            temperature_c: z.number().min(20).max(46).nullable(),
            respiratory_rate: z.number().int().min(0).max(120).nullable(),
            oxygen_saturation_pct: z.number().min(0).max(100).nullable(),
            weight_kg: z.number().min(0).max(500).nullable(),
            height_cm: z.number().min(0).max(300).nullable(),
          })
          .strict(),
        lab_results: z.array(labResultSchema),
        imaging_findings: z.array(z.string().trim().min(1).max(2000)),
        recommendations: z.array(z.string().trim().min(1).max(2000)),
        follow_up: z
          .object({
            required: z.boolean(),
            date: z.string().trim().max(40).default(""),
            notes: z.string().trim().max(2000).default(""),
          })
          .strict(),
      })
      .strict(),

    administrative_content: z
      .object({
        billing_items: z.array(billingItemSchema),
        subtotal: z.number().min(0),
        tax: z.number().min(0),
        total: z.number().min(0),
        authorization_number: z.string().trim().max(120).default(""),
        claim_number: z.string().trim().max(120).default(""),
      })
      .strict(),

    layout_analysis: z
      .object({
        has_header: z.boolean(),
        has_table: z.boolean(),
        has_signature: z.boolean(),
        has_stamp: z.boolean(),
        has_qr_or_barcode: z.boolean(),
        sections_with_coordinates: z.array(sectionCoordinateSchema),
      })
      .strict(),

    security_and_risk: z
      .object({
        contains_sensitive_data: z.boolean(),
        possible_red_flags: z.array(z.string().trim().min(1).max(300)),
        tampering_suspected: z.boolean(),
      })
      .strict(),

    confidence: z
      .object({
        overall: confidenceNumber,
        by_section: z
          .object({
            patient: confidenceNumber,
            provider: confidenceNumber,
            clinical_content: confidenceNumber,
            administrative_content: confidenceNumber,
            layout_analysis: confidenceNumber,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

export function validateDocumentAnalysis(payload: unknown): DocumentAnalysis {
  return documentAnalysisSchema.parse(payload);
}

export function safeValidateDocumentAnalysis(payload: unknown) {
  return documentAnalysisSchema.safeParse(payload);
}

export const documentAnalysisJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://gsentinelhealthos/schemas/document-analysis.schema.json",
  title: "DocumentAnalysis",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "document_type",
    "language",
    "quality",
    "quality_score",
    "orientation_correction_applied",
    "detected_sections",
    "raw_extracted_text",
    "observations",
    "patient",
    "provider",
    "document_metadata",
    "clinical_content",
    "administrative_content",
    "layout_analysis",
    "security_and_risk",
    "confidence"
  ],
  properties: {
    schema_version: { type: "string", const: DOCUMENT_ANALYSIS_SCHEMA_VERSION },
    document_type: { type: "string", minLength: 1, maxLength: 120 },
    language: { type: "string", minLength: 2, maxLength: 40 },
    quality: { type: "string", enum: ["high", "medium", "low"] },
    quality_score: { type: "number", minimum: 0, maximum: 1 },
    orientation_correction_applied: { type: "boolean" },
    detected_sections: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 120 }
    },
    raw_extracted_text: { type: "string" },
    observations: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 5000 }
    },
    patient: {
      type: "object",
      additionalProperties: false,
      required: ["full_name", "document_id", "dob", "sex", "age", "insurance"],
      properties: {
        full_name: { type: "string" },
        document_id: { type: "string" },
        dob: { type: "string" },
        sex: { type: "string" },
        age: { type: ["integer", "null"], minimum: 0, maximum: 130 },
        insurance: { type: "string" }
      }
    },
    provider: {
      type: "object",
      additionalProperties: false,
      required: ["professional_name", "license_number", "specialty", "facility_name", "facility_id"],
      properties: {
        professional_name: { type: "string" },
        license_number: { type: "string" },
        specialty: { type: "string" },
        facility_name: { type: "string" },
        facility_id: { type: "string" }
      }
    },
    document_metadata: {
      type: "object",
      additionalProperties: false,
      required: ["document_id", "issue_date", "service_date", "page_count", "currency", "country"],
      properties: {
        document_id: { type: "string" },
        issue_date: { type: "string" },
        service_date: { type: "string" },
        page_count: { type: "integer", minimum: 1 },
        currency: { type: "string" },
        country: { type: "string" }
      }
    },
    clinical_content: {
      type: "object",
      additionalProperties: false,
      required: [
        "chief_complaint",
        "diagnoses",
        "medications",
        "allergies",
        "vitals",
        "lab_results",
        "imaging_findings",
        "recommendations",
        "follow_up"
      ],
      properties: {
        chief_complaint: { type: "string" },
        diagnoses: { type: "array" },
        medications: { type: "array" },
        allergies: { type: "array", items: { type: "string" } },
        vitals: { type: "object" },
        lab_results: { type: "array" },
        imaging_findings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        follow_up: { type: "object" }
      }
    },
    administrative_content: {
      type: "object",
      additionalProperties: false,
      required: ["billing_items", "subtotal", "tax", "total", "authorization_number", "claim_number"],
      properties: {
        billing_items: { type: "array" },
        subtotal: { type: "number", minimum: 0 },
        tax: { type: "number", minimum: 0 },
        total: { type: "number", minimum: 0 },
        authorization_number: { type: "string" },
        claim_number: { type: "string" }
      }
    },
    layout_analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "has_header",
        "has_table",
        "has_signature",
        "has_stamp",
        "has_qr_or_barcode",
        "sections_with_coordinates"
      ],
      properties: {
        has_header: { type: "boolean" },
        has_table: { type: "boolean" },
        has_signature: { type: "boolean" },
        has_stamp: { type: "boolean" },
        has_qr_or_barcode: { type: "boolean" },
        sections_with_coordinates: { type: "array" }
      }
    },
    security_and_risk: {
      type: "object",
      additionalProperties: false,
      required: ["contains_sensitive_data", "possible_red_flags", "tampering_suspected"],
      properties: {
        contains_sensitive_data: { type: "boolean" },
        possible_red_flags: { type: "array", items: { type: "string" } },
        tampering_suspected: { type: "boolean" }
      }
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "by_section"],
      properties: {
        overall: { type: "number", minimum: 0, maximum: 1 },
        by_section: {
          type: "object",
          additionalProperties: false,
          required: ["patient", "provider", "clinical_content", "administrative_content", "layout_analysis"],
          properties: {
            patient: { type: "number", minimum: 0, maximum: 1 },
            provider: { type: "number", minimum: 0, maximum: 1 },
            clinical_content: { type: "number", minimum: 0, maximum: 1 },
            administrative_content: { type: "number", minimum: 0, maximum: 1 },
            layout_analysis: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  }
} as const;
