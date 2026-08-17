-- Adiciona coluna de preço ao item (texto formatado, ex: "R$ 119,90").
-- O preço é um snapshot extraído da URL no momento do cadastro (pode mudar depois).
-- RLS existente de wish_items já cobre a coluna nova (RLS é por linha, não por coluna).
ALTER TABLE public.wish_items ADD COLUMN IF NOT EXISTS price TEXT;