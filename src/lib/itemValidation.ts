import { z } from 'zod';

// Normaliza URL: se não tiver protocolo, prefixa https://
const normalizeUrl = (val: string): string => {
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

// Campo de link: opcional, mas se preenchido deve ser URL válida.
// Aceita "amazon.com" sem protocolo — normaliza antes de validar.
const linkField = z
  .string()
  .max(2048, 'Link muito longo.')
  .optional()
  .transform(normalizeUrl)
  .refine(
    (val) => !val || /^https:\/\/[^\s]+$/.test(val),
    'Link inválido. Use um endereço como https://...',
  )
  .transform((val) => (val === '' ? null : val));

export const itemSchema = z.object({
  name: z.string().min(1, 'O nome do item é obrigatório.'),
  link: linkField,
  image_url: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null))
    .refine(
      (val) => !val || /^https:\/\/[^\s]+$/.test(val),
      'URL de imagem inválida.',
    ),
  category: z.enum(['para_mim', 'para_casa']),
  size_color: z.string().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  notes: z.string().optional().transform((v) => (v?.trim() ? v.trim() : null)),
});

export type ItemFormValues = z.infer<typeof itemSchema>;