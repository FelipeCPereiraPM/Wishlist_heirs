// Helpers para imagem de produto:
// - fetchPreview: chama a serverless /api/preview para extrair og:image
// - faviconUrl: URL do favicon da loja (fallback quando não há imagem)
// - isValidImageUrl: valida que a URL é http/https antes de renderizar

export interface PreviewResult {
  image: string | null;
  title: string | null;
}

// Chama a serverless function /api/preview com o token de autenticação do usuário.
export async function fetchPreview(url: string, accessToken: string): Promise<PreviewResult> {
  const res = await fetch('/api/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
  return res.json();
}

// URL do favicon da loja via Google S2 (serviço gratuito do Google).
// Retorna o logo da loja — usado como fallback quando a imagem do produto quebra ou não existe.
export function faviconUrl(link: string | null): string | null {
  if (!link) return null;
  try {
    const host = new URL(link).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return null;
  }
}

// Valida que uma URL de imagem é http/https (não javascript:, data:, etc).
export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}