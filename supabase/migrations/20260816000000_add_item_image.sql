-- Adiciona coluna de URL de imagem ao item.
-- A URL é armazenada como texto (não é um arquivo no Storage) — a imagem é carregada
-- direto do CDN da loja (hotlinking) para evitar custo de storage e bandwidth.
-- RLS existente de wish_items já cobre a coluna nova (RLS é por linha, não por coluna).
ALTER TABLE public.wish_items ADD COLUMN IF NOT EXISTS image_url TEXT;