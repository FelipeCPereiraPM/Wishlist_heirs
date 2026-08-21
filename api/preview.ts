import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Endpoint que extrai metadados Open Graph (og:image, og:title) e o preço de uma URL.
// Usado para mostrar thumbnail + valor do produto no card do item.
//
// Proteção contra SSRF (Server-Side Request Forgery):
// - Só aceita http/https
// - Bloqueia hostnames privados (localhost, 10.*, 192.168.*, etc)
// - Timeout de 5s
// - Máximo ~1.2MB lidos do HTML
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

// Símbolo de moeda por código ISO. Sem código (ou desconhecido), assume R$.
const CURRENCY_SYMBOLS: Record<string, string> = {
  BRL: 'R$', USD: 'US$', EUR: '€', GBP: '£', ARS: 'AR$', MXN: 'MX$',
  CLP: 'CLP$', COP: 'COP$', CAD: 'C$', AUD: 'A$', JPY: 'JP¥', CNY: 'CN¥',
};

// Formata um valor numérico + moeda para "R$ X,XX" (pt-BR).
// Aceita "886.74", "BRL", "USD", etc. Retorna null se não for um número válido.
function formatPrice(value: string, currency?: string): string | null {
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const symbol = (currency && CURRENCY_SYMBOLS[currency.toUpperCase()]) || 'R$';
  return `${symbol} ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Caminha recursivamente pela estrutura JSON-LD em busca de um preço válido.
// Cobre: offers no nível raiz, @graph, hasVariant/variants (Shopify ProductGroup),
// offers em array, e objetos do tipo Offer com "price".
function findPrice(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findPrice(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  const price = obj.price;
  if (price !== undefined && price !== null && price !== '' && price !== 0) {
    const currency = typeof obj.priceCurrency === 'string' ? obj.priceCurrency : undefined;
    const formatted = formatPrice(String(price), currency);
    if (formatted) return formatted;
  }

  for (const key of ['offers', 'hasVariant', 'variants', '@graph', 'itemListElement', 'mainEntity']) {
    const child = obj[key];
    if (child && typeof child === 'object') {
      const found = findPrice(child);
      if (found) return found;
    }
  }
  return null;
}

// Extrai o preço do HTML. Prioridade:
//   1. JSON-LD (application/ld+json) — percorre @graph/hasVariant/offers recursivamente
//   2. Meta product:price:amount + product:price:currency (padrão Open Graph)
//   3. Amazon: bloco JSON "twister-plus-buying-options-price-data" (displayPrice)
function extractPrice(html: string, hostname: string): string | null {
  // 1. JSON-LD
  const ldBlocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    if (!inner.includes('price')) continue;
    try {
      const data = JSON.parse(inner);
      const found = findPrice(data);
      if (found) return found;
    } catch {
      // JSON-LD malformado — regex simples em "price"
      const price = inner.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/);
      if (price) return formatPrice(price[1]);
    }
  }

  // 2. Meta product:price:amount
  const amount = extractMeta(html, 'product:price:amount');
  const currency = extractMeta(html, 'product:price:currency');
  if (amount) return formatPrice(amount, currency || undefined);

  // 3. Amazon específico
  if (/amazon\.com/i.test(hostname)) {
    const displayPrice = html.match(/"displayPrice"\s*:\s*"([^"]+)"/);
    if (displayPrice) {
      const v = displayPrice[1].trim();
      if (v) return v;
    }
    const priceAmount = html.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (priceAmount) return formatPrice(priceAmount[1]);
  }

  return null;
}

// Fallback: usa o Jina Reader (r.jina.ai) que renderiza a página com headless
// browser e devolve o HTML completo (incluindo preços injetados via JS).
// Gratuito sem API key (limite de ~20 req/min). Timeout próprio de 8s.
async function fetchPriceViaJina(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: {
        'X-No-Cache': 'true',
        'X-Return-Format': 'html',
        'User-Agent': 'Mozilla/5.0 (compatible; WishlistHeirs/1.0)',
      },
    });
    if (!res.ok) return null;
    const body = await res.text();
    // Extrai o preço do HTML renderizado (usa os mesmos padrões do extractPrice)
    const priceAmount = body.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (priceAmount) return formatPrice(priceAmount[1]);
    const displayPrice = body.match(/"displayPrice"\s*:\s*"([^"]+)"/);
    if (displayPrice && displayPrice[1].trim()) {
      return displayPrice[1].replace(/&#160;/g, ' ').replace(/&nbsp;/g, ' ').trim();
    }
    const offers = body.match(/"offers"\s*:\s*\{[^}]*"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/);
    if (offers) return formatPrice(offers[1]);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Mercado Livre só serve o conteúdo completo para crawlers de mídia social
// (facebookexternalhit); para outros bots redireciona a /gz/account-verification.
// Tentamos vários UAs de crawler social em sequência.
const SOCIAL_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com/bot.html)',
];

// Faz o fetch da URL e lê o HTML em streaming até ~1.2MB.
// Sem "parada antecipada": o preço costuma vir DEPOIS da imagem (ou em JSON-LD
// no final do corpo), então truncar cedo quebra a extração em várias lojas.
async function fetchHtml(url: string, userAgent: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`Site respondeu ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Não foi possível ler a resposta');
    }
    let html = '';
    const MAX_BYTES = 1_200_000;
    let total = 0;
    const decoder = new TextDecoder();
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        html += decoder.decode(value, { stream: true });
        total += value.length;
      }
    }
    html += decoder.decode();
    reader.cancel();
    return html;
  } finally {
    clearTimeout(timeout);
  }
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

  // 3. Busca o HTML. Para Mercado Livre, tenta vários User-Agents de crawler social;
  //    para os demais, usa o UA de navegador padrão.
  const isML = /mercadolivre\.com|mercadolibre\.com/i.test(target.hostname);
  const userAgents = isML ? SOCIAL_UAS : [DEFAULT_UA];

  let html: string | null = null;
  let lastError: string | null = null;
  for (const ua of userAgents) {
    try {
      const candidate = await fetchHtml(url, ua);
      // Página de verificação anti-bot sem dados úteis: tenta o próximo UA.
      const isBotPage = /account-verification|bm-verify|recaptcha|Robot Check|interstitial/i.test(candidate)
        && !candidate.includes('og:image')
        && !candidate.includes('application/ld+json');
      if (isML && isBotPage) {
        lastError = 'Página de verificação anti-bot';
        continue;
      }
      html = candidate;
      lastError = null;
      break;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'Erro desconhecido';
    }
  }

  if (!html) {
    const msg = lastError || 'Não foi possível carregar a página';
    if (msg.includes('aborted')) {
      return res.status(504).json({ error: 'Tempo esgotado ao carregar a página' });
    }
    return res.status(502).json({ error: msg });
  }

  // Detecta páginas de verificação anti-bot (ex: Mercado Livre redireciona para /gz/account-verification)
  const isVerification = /account-verification|bm-verify|recaptcha|Robot Check|interstitial/i.test(html);

  // 4. Extrai metadados — og:image primeiro, depois fallbacks específicos de cada loja
  let image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');

  // Fallback Mercado Livre: serve a imagem principal como
  // <link rel="preload" as="image" href="https://http2.mlstatic.com/D_NQ_...-O.jpg">
  // (só quando requisitado com User-Agent de crawler social, já aplicado acima).
  if (!image && isML) {
    const preload = html.match(/<link[^>]+rel="preload"[^>]+as="image"[^>]+href="([^"]+)"/i)
      || html.match(/<link[^>]+href="([^"]+)"[^>]+as="image"/i);
    if (preload) {
      image = preload[1].replace(/&amp;/g, '&');
    }
    // Fallback: primeira imagem de produto http2.mlstatic.com/D_
    if (!image) {
      const dImg = html.match(/https:\/\/http2\.mlstatic\.com\/D_[^"'\s]+\.(?:jpg|png|webp)/i);
      if (dImg) image = dImg[0];
    }
  }

  // Fallback Amazon: o HTML servido NÃO tem og:image. A imagem principal do produto
  // é a tag <img id="landingImage"> — ancoramos nela para NÃO pegar imagens de
  // carrosséis de produtos relacionados/patrocinados (ex: air fryer em página de
  // utensílio de cozinha), que aparecem antes no HTML.
  if (!image && /amazon\.com/i.test(target.hostname)) {
    // 1. Tag principal <img id="landingImage"> — fonte confiável da imagem do produto
    const landingImg = html.match(/<img[^>]*id="landingImage"[^>]*>/i);
    if (landingImg) {
      const tag = landingImg[0];
      const oldHires = tag.match(/data-old-hires="([^"]+)"/);
      const src = tag.match(/src="([^"]+)"/);
      image = (oldHires?.[1] || src?.[1] || '').replace(/&amp;/g, '&') || null;
    }

    // 2. Fallback: data-a-dynamic-image (JSON com as resoluções da imagem principal)
    if (!image) {
      const dyn = html.match(/data-a-dynamic-image="\{&quot;(https:\/\/m\.media-amazon\.com\/images\/I\/[^&]+)\.jpg/g);
      if (dyn && dyn[1]) {
        image = dyn[1] + '.jpg';
      }
    }

    // 3. Último recurso: hiRes JSON (só se não achou nada acima).
    //    Evita a varredura genérica de m.media-amazon.com, que pode pegar
    //    imagem de produto patrocinado/relacionado e exibir produto errado.
    if (!image) {
      const hiRes = html.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
      if (hiRes) {
        image = hiRes[1].replace(/&amp;/g, '&');
      }
    }
  }

  const title = extractMeta(html, 'og:title');
  let price = extractPrice(html, target.hostname);

  // Fallback: o Amazon (e alguns SPAs) renderiza o preço via JavaScript e não o
  // expõe no HTML cru. Usa o Jina Reader (gratuito) que renderiza a página com
  // headless browser e devolve o HTML completo com o preço.
  // Limitado a domínios conhecidos para não adicionar latência em sites sem preço.
  if (!price && /amazon\.com/i.test(target.hostname)) {
    price = await fetchPriceViaJina(url);
  }

  // 5. Normaliza e valida a URL da imagem
  //    - URLs protocol-relative ("//cdn.x/img.jpg") ganham https://
  //    - Rejeita javascript:, data:, etc.
  if (image) {
    if (image.startsWith('//')) image = `https:${image}`;
    if (!isValidHttpUrl(image)) image = null;
  }

  return res.status(200).json({ image, title, price, verification: isVerification });
}
