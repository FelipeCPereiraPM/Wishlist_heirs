import { useState } from 'react';
import { ExternalLink, Trash2, CheckCircle2, Undo2, Pencil, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ItemForm from '@/components/ItemForm';
import type { ItemFormValues } from '@/lib/itemValidation';
import { faviconUrl, isValidImageUrl } from '@/lib/productImage';
import type { Tables } from '@/integrations/supabase/types';

type WishItem = Tables<'wish_items'>;

interface WishItemCardProps {
  item: WishItem;
  isOwner: boolean;
  onDelete?: (id: string, name: string) => void;
  onTogglePurchased?: (id: string, purchased: boolean) => void;
  onEdit?: (id: string, updates: { name: string; link: string | null; category: string; size_color: string | null; notes: string | null; image_url?: string | null }) => void;
}

const formatDate = (dateStr: string) =>
  format(new Date(dateStr), "'adicionado em' d 'de' MMMM 'de' yyyy", { locale: ptBR });

const CategoryBadge = ({ category }: { category: string }) =>
  category === 'para_mim' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: 'hsl(250, 60%, 55%, 0.15)', color: 'hsl(250, 60%, 70%)' }}>
      🙋 Para mim
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: 'hsl(25, 85%, 55%, 0.15)', color: 'hsl(25, 85%, 70%)' }}>
      🏠 Para casa
    </span>
  );

const WishItemCard = ({ item, isOwner, onDelete, onTogglePurchased, onEdit }: WishItemCardProps) => {
  const purchased = item.purchased;
  const [editing, setEditing] = useState(false);
  // Estado de fallback: se a imagem principal quebra, cai para o favicon da loja (camada F)
  const [imgError, setImgError] = useState(false);

  const startEditing = () => setEditing(true);

  const handleSave = (values: ItemFormValues) => {
    onEdit?.(item.id, {
      name: values.name,
      link: values.link,
      category: values.category,
      size_color: values.size_color,
      notes: values.notes,
      image_url: values.image_url,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="border-primary/30 bg-card">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Editando item</span>
            <button onClick={() => setEditing(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ItemForm
            compact
            defaultValues={{
              name: item.name,
              link: item.link ?? '',
              image_url: item.image_url ?? '',
              category: item.category,
              size_color: item.size_color ?? '',
              notes: item.notes ?? '',
            }}
            onSubmit={handleSave}
            submitLabel="Salvar"
            submitIcon="save"
          />
        </CardContent>
      </Card>
    );
  }

  // Cadeia de fallback da imagem:
  // 1. image_url válida → mostra a imagem do produto
  // 2. onError → favicon da loja (camada F)
  // 3. Sem link nem image_url → não renderiza thumbnail
  const hasImage = isValidImageUrl(item.image_url);
  const showImage = hasImage && !imgError;
  const fallbackFavicon = imgError ? faviconUrl(item.link) : null;
  const showFavicon = isValidImageUrl(fallbackFavicon);

  return (
    <Card className={`border-border bg-card group transition-colors ${purchased ? 'opacity-60' : 'hover:border-primary/30'}`}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          {/* Thumbnail lateral 64px (camada D + F) */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {(showImage || showFavicon) && (
              <img
                src={showImage ? item.image_url! : fallbackFavicon!}
                alt=""
                className="h-16 w-16 object-cover rounded-md border border-border shrink-0"
                onError={() => { if (showImage) setImgError(true); }}
              />
            )}
            <p className={`font-medium leading-snug break-words ${purchased ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.name}
            </p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-0.5 shrink-0">
              {!purchased && onEdit && (
                <button
                  onClick={startEditing}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  title="Editar item"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(item.id, item.name)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  title="Excluir item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <CategoryBadge category={item.category} />
          {purchased && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary">
              ✅ Comprado
            </span>
          )}
        </div>

        {item.size_color && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>🎨</span>
            <span>{item.size_color}</span>
          </p>
        )}

        {item.notes && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <span className="shrink-0">📝</span>
            <span className="italic">{item.notes}</span>
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className="text-xs text-muted-foreground">
            {formatDate(item.created_at)}
          </span>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-accent bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-lg transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver produto
            </a>
          )}
        </div>

        {isOwner && onTogglePurchased && (
          <div className="pt-1 border-t border-border">
            {!purchased ? (
              <button
                onClick={() => onTogglePurchased(item.id, true)}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 py-2.5 rounded-lg transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marcar como comprado
              </button>
            ) : (
              <button
                onClick={() => onTogglePurchased(item.id, false)}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary py-2.5 rounded-lg transition-colors"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Desfazer
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WishItemCard;