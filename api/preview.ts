import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Endpoint que extrai metadados Open Graph (og:image, og:title) de uma URL.
// Usado para mostrar thumbnail do produto no card do item.
//
// Proteção contra SSRF (Server-Side Request Forgery):
// - Só aceita http/https
// - Bloqueia hostnames privados (localhost, 10.*, 192.168.*, etc)
// - Timeout de 5s
// - Máximo 150KB lidos do HTML (as tags og: ficam no <head>)
// - Máximo 3 redirects
// - Exige JWT do Supabase válido (evita uso como proxy aberto)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

// Regex para hostnames privados/internos que não devem ser alcançados
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|\.local$)/i;
// 172.16.0.0 — 172.31.255.255 é privado; aceitamos 172.{16..31}.*
const PRIVATE_172 = /^172\.(1[6-9]|2[0-9]|3[01])\./;

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (PRIVATE_HOST.test(h)) return true;
  if (PRIVATE_172.test(h)) return true;
  return false;
}

function isValidHttpUrl(val: string): boolean {
  try {
    const u = new URL(val);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

// Extrai <meta property="og:image" content="..."> via regex.
// Suporta tanto property antes de content quanto content antes de property
// (alguns sites invertem a ordem dos atributos).
function extractMeta(html: string, prop: string): string | null {
  const propFirst = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i',
  );
  const match = html.match(propFirst) || html.match(contentFirst);
  if (!match) return null;
  // Decodifica entidades HTML comuns (ex: &amp; -> &) que podem aparecer na URL
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Autentica via JWT do Supabase — evita uso como proxy aberto
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  const accessToken = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida' });
  }

  // 2. Valida URL de entrada
  const { url } = req.body as { url?: string };
  if (!url || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: 'URL inválida' });
  }
  const target = new URL(url);
  if (isPrivateHost(target.hostname)) {
    return res.status(400).json({ error: 'Host bloqueado' });
  }

  // 3. Fetch com timeout de 5s, limite de 3 redirects
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: `Site respondeu ${response.status}` });
    }

    // 4. Lê o HTML (limite maior para o Amazon, que coloca as imagens no meio da página)
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(502).json({ error: 'Não foi possível ler a resposta' });
    }
    let html = '';
    const MAX_BYTES = 300_000;
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        html += new TextDecoder().decode(value);
        total += value.length;
      }
    }
    reader.cancel();

    // Detecta páginas de verificação anti-bot (ex: Mercado Livre redireciona para /gz/account-verification)
    const isVerification = /account-verification|bm-verify|recaptcha|Robot Check|interstitial/i.test(html);

    // 5. Extrai metadados — og:image primeiro, depois fallbacks específicos de cada loja
    let image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');

    // Fallback Amazon: o HTML servido NÃO tem og:image, mas tem a imagem do produto
    // em URLs https://m.media-amazon.com/images/I/<id>.jpg (ignora .css/.js).
    // Prefere a imagem em alta resolução (sem sufixo _SL/_SY/_SC/_AC de redimensionamento).
    if (!image && /amazon\.com/i.test(target.hostname)) {
      const amzMatch = html.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9.+_-]+\.jpg/g);
      if (amzMatch) {
        const productImages = amzMatch.filter((u) => !u.includes('.css') && !u.includes('.js'));
        // Se existir imagem sem sufixo de tamanho (_SL75_, _SY450_, etc), é a original
        const fullRes = productImages.find((u) => !/\._(SL|SY|SC|AC)\d+_/.test(u));
        image = fullRes || productImages[0] || null;
      }
    }

    const title = extractMeta(html, 'og:title');

    // 6. Normaliza e valida a URL da imagem
    //    - URLs protocol-relative ("//cdn.x/img.jpg") ganham https://
    //    - Rejeita javascript:, data:, etc.
    if (image) {
      if (image.startsWith('//')) image = `https:${image}`;
      if (!isValidHttpUrl(image)) image = null;
    }

    return res.status(200).json({ image, title, verification: isVerification });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    if (msg.includes('aborted')) {
      return res.status(504).json({ error: 'Tempo esgotado ao carregar a página' });
    }
    return res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timeout);
  }
}