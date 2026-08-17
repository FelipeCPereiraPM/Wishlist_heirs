import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Save, X, ImageIcon, Loader2 } from 'lucide-react';
import { itemSchema, type ItemFormValues } from '@/lib/itemValidation';
import { fetchPreview, isValidImageUrl, normalizeUrl } from '@/lib/productImage';
import { supabase } from '@/integrations/supabase/client';

interface ItemFormProps {
  defaultValues?: Partial<ItemFormValues>;
  onSubmit: (values: ItemFormValues) => void;
  submitLabel: string;
  submitIcon?: 'plus' | 'save';
  isPending?: boolean;
  compact?: boolean;
}

const ItemForm = ({
  defaultValues, onSubmit, submitLabel, submitIcon = 'plus',
  isPending, compact,
}: ItemFormProps) => {
  const {
    register, handleSubmit, formState: { errors }, reset, setValue, watch,
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      link: defaultValues?.link ?? '',
      image_url: defaultValues?.image_url ?? '',
      category: defaultValues?.category ?? 'para_mim',
      size_color: defaultValues?.size_color ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  const link = watch('link');
  const imageUrl = watch('image_url');
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: ao parar de digitar no link por 800ms, tenta extrair og:image.
  // Normaliza o link primeiro (aceita "mercadolivre.com.br/..." sem protocolo).
  useEffect(() => {
    const normalized = normalizeUrl(link);
    if (!normalized || !isValidImageUrl(normalized)) {
      setPreviewError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Se o usuário já preencheu a imagem manualmente, não sobrescreve.
      if (imageUrl && imageUrl.trim()) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      setPreviewing(true);
      setPreviewError(null);
      try {
        const result = await fetchPreview(normalized, session.access_token);
        if (result.image && isValidImageUrl(result.image)) {
          setValue('image_url', result.image);
        } else {
          setPreviewError('Não foi possível detectar a imagem automaticamente. Você pode colar a URL manualmente abaixo.');
        }
        if (result.title && !watch('name')) setValue('name', result.title);
      } catch (e: unknown) {
        // Falha não bloqueia o cadastro — apenas informa.
        setPreviewError(
          e instanceof Error && e.message
            ? `Não foi possível buscar a imagem: ${e.message}`
            : 'Não foi possível buscar a imagem automaticamente.',
        );
      } finally {
        setPreviewing(false);
      }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  const category = watch('category');
  const labelCls = compact ? 'text-xs text-foreground' : 'text-foreground';
  const inputCls = compact
    ? 'bg-secondary border-border text-foreground h-11 text-sm'
    : 'bg-secondary border-border text-foreground placeholder:text-muted-foreground';
  const rowCls = compact ? 'space-y-1.5' : 'space-y-2';
  const buttonCls = compact ? 'w-full' : 'w-full shadow-sm';

  const submit = (values: ItemFormValues) => {
    onSubmit(values);
    if (!defaultValues) reset();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className={compact ? 'flex flex-col gap-3' : 'space-y-4'} noValidate>
      <div className={rowCls}>
        <Label className={labelCls}>{compact ? 'Nome *' : 'Nome do item *'}</Label>
        <Input
          {...register('name')}
          placeholder={compact ? undefined : 'Ex: Fone de ouvido Bluetooth'}
          aria-invalid={!!errors.name}
          className={inputCls}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className={rowCls}>
        <Label className={labelCls}>{compact ? 'Link' : 'Link (opcional)'}</Label>
        <Input
          {...register('link')}
          placeholder={compact ? undefined : 'https://...'}
          aria-invalid={!!errors.link}
          className={inputCls}
        />
        {errors.link && <p className="text-xs text-destructive">{errors.link.message}</p>}
      </div>

      {/* Campo de imagem (camada E — editável; camada D — auto-preenchida pelo preview) */}
      <div className={rowCls}>
        <Label className={labelCls}>
          🖼️ Imagem {compact ? '' : '(opcional)'}
          {previewing && <Loader2 className="inline-block h-3 w-3 ml-1.5 animate-spin text-muted-foreground" />}
        </Label>
        {imageUrl && isValidImageUrl(imageUrl) && (
          <div className="relative w-fit mb-2">
            <img
              src={imageUrl}
              alt="Preview do produto"
              className="h-16 w-16 object-cover rounded-md border border-border"
              onError={() => setValue('image_url', '')}
            />
            <button
              type="button"
              onClick={() => setValue('image_url', '')}
              className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Remover imagem"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <Input
          {...register('image_url')}
          placeholder={compact ? undefined : 'URL da imagem ou aguarde auto-detecção ao colar o link'}
          aria-invalid={!!errors.image_url}
          className={inputCls}
        />
        {errors.image_url && <p className="text-xs text-destructive">{errors.image_url.message}</p>}
        {previewError && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
            <ImageIcon className="h-3 w-3 mt-0.5 shrink-0" />
            {previewError}
          </p>
        )}
        {!compact && !imageUrl && !previewError && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            Cole o link do produto e a imagem será buscada automaticamente.
          </p>
        )}
      </div>

      <div className={rowCls}>
        <Label className={labelCls}>Categoria</Label>
        <Select
          value={category}
          onValueChange={(v) => setValue('category', v as 'para_mim' | 'para_casa')}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="para_mim">🙋 Para mim</SelectItem>
            <SelectItem value="para_casa">🏠 Para casa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={rowCls}>
        <Label className={labelCls}>🎨 Tamanho / Cor {compact ? '' : '(opcional)'}</Label>
        <Input
          {...register('size_color')}
          placeholder={compact ? undefined : 'Ex: M, azul marinho, 38'}
          className={inputCls}
        />
      </div>

      <div className={rowCls}>
        <Label className={labelCls}>📝 Observações {compact ? '' : '(opcional)'}</Label>
        <textarea
          {...register('notes')}
          placeholder={compact ? undefined : 'Ex: prefiro a versão preta, qualquer marca serve'}
          rows={2}
          className="flex w-full resize-y min-h-[80px] rounded-md border bg-secondary border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <Button type="submit" className={buttonCls} disabled={isPending}>
        {submitIcon === 'save' ? (
          <Save className="h-4 w-4 mr-1.5" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        {isPending ? 'Aguarde...' : submitLabel}
      </Button>
    </form>
  );
};

export default ItemForm;