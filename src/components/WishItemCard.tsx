import { useState } from 'react';
import { ExternalLink, Trash2, CheckCircle2, Undo2, Pencil, X, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Tables } from '@/integrations/supabase/types';

type WishItem = Tables<'wish_items'>;

interface WishItemCardProps {
  item: WishItem;
  isOwner: boolean;
  onDelete?: (id: string, name: string) => void;
  onTogglePurchased?: (id: string, purchased: boolean) => void;
  onEdit?: (id: string, updates: { name: string; link: string | null; category: string; size_color: string | null; notes: string | null }) => void;
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
  const [editName, setEditName] = useState(item.name);
  const [editLink, setEditLink] = useState(item.link || '');
  const [editCategory, setEditCategory] = useState(item.category);
  const [editSizeColor, setEditSizeColor] = useState(item.size_color || '');
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [nameError, setNameError] = useState('');

  const startEditing = () => {
    setEditName(item.name);
    setEditLink(item.link || '');
    setEditCategory(item.category);
    setEditSizeColor(item.size_color || '');
    setEditNotes(item.notes || '');
    setNameError('');
    setEditing(true);
  };

  const handleSave = () => {
    if (!editName.trim()) {
      setNameError('O nome é obrigatório.');
      return;
    }
    onEdit?.(item.id, {
      name: editName.trim(),
      link: editLink.trim() || null,
      category: editCategory,
      size_color: editSizeColor.trim() || null,
      notes: editNotes.trim() || null,
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
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Nome *</Label>
            <Input value={editName} onChange={(e) => { setEditName(e.target.value); if (nameError) setNameError(''); }} className="bg-secondary border-border text-foreground h-11 text-sm" />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Link</Label>
            <Input value={editLink} onChange={(e) => setEditLink(e.target.value)} placeholder="https://..." className="bg-secondary border-border text-foreground h-11 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">Categoria</Label>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="bg-secondary border-border text-foreground h-11 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="para_mim">🙋 Para mim</SelectItem>
                <SelectItem value="para_casa">🏠 Para casa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">🎨 Tamanho / Cor</Label>
            <Input value={editSizeColor} onChange={(e) => setEditSizeColor(e.target.value)} className="bg-secondary border-border text-foreground h-11 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-foreground">📝 Observações</Label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="flex w-full resize-y min-h-[80px] rounded-md border bg-secondary border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
          </div>
          <Button onClick={handleSave} size="sm" className="w-full">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Salvar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-border bg-card group transition-colors ${purchased ? 'opacity-60' : 'hover:border-primary/30'}`}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-medium leading-snug break-words ${purchased ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.name}
          </p>
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
