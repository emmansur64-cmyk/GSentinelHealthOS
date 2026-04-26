import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingService {
  private readonly dimensions = 256;

  // Lightweight local embedding alternative: hashed token embedding.
  // Avoids external embedding API dependency while enabling semantic-ish retrieval.
  embed(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = this.tokenize(text);

    for (const token of tokens) {
      const idx = this.hashToken(token) % this.dimensions;
      vec[idx] += 1;
    }

    return this.normalize(vec);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private tokenize(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).slice(0, 3000);
  }

  private hashToken(token: string): number {
    let h = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      h ^= token.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h >>> 0);
  }

  private normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((acc, x) => acc + x * x, 0));
    if (norm === 0) return vec;
    return vec.map((x) => x / norm);
  }
}
