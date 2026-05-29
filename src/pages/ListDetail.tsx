import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Gift, PartyPopper, ArrowLeft } from 'lucide-react';
import WishItemCard from '@/components/WishItemCard';
import ListSettingsDialog from '@/components/ListSettingsDialog';
import { VisibilityBadge } from '@/lib/listVisibility';
import type { Tables } from '@/integrations/supabase/types';

type WishItem = Tables<'wish_items'>;
type WishList = Tables<'wish_lists'>;

const ListDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<string>('para_mim');
  const [sizeColor, setSizeColor] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState('');

  const { data: list, isLoading: loadingList } = useQuery({
    queryKey: ['list', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('wish_lists').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as WishList | null;
    },
    enabled: !!id,
  });

  const { data: myMembership } = useQuery({
    queryKey: ['my-membership', id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_list_members')
        .select('role')
        .eq('list_id', id!)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const isOwner = !!list && list.owner_id === user?.id;
  const isEditor = myMembership?.role === 'editor';
  const canEdit = isOwner || isEditor;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['list-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_items')
        .select('*')
        .eq('list_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WishItem[];
    },
    enabled: !!id,
  });

  const pending = items.filter((i) => !i.purchased);
  const purchased = items.filter((i) => i.purchased);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['list-items', id] });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('wish_items').insert({
        user_id: user!.id,
        list_id: id!,
        name: name.trim(),
        link: link.trim() || null,
        category,
        size_color: sizeColor.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setName(''); setLink(''); setCategory('para_mim'); setSizeColor(''); setNotes(''); setNameError('');
      toast({ title: '✨ Item adicionado com sucesso!' });
    },
    onError: (e: any) => toast({ title: 'Erro ao adicionar', description: e.message, variant: 'destructive' }),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('wish_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Item removido.' }); },
    onError: (e: any) => toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' }),
  });

  const togglePurchased = useMutation({
    mutationFn: async ({ itemId, value }: { itemId: string; value: boolean }) => {
      const { error } = await supabase.from('wish_items').update({ purchased: value }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, { value }) => { invalidate(); toast({ title: value ? '🎉 Marcado como comprado!' : '↩️ Status revertido.' }); },
    onError: (e: any) => toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' }),
  });

  const editItem = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: any }) => {
      const { error } = await supabase.from('wish_items').update(updates).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: '✏️ Item atualizado!' }); },
    onError: (e: any) => toast({ title: 'Erro ao editar', description: e.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError('O nome do item é obrigatório.'); return; }
    setNameError('');
    addItem.mutate();
  };

  const handleDelete = (itemId: string, itemName: string) => {
    if (window.confirm(`Remover "${itemName}" da lista?`)) deleteItem.mutate(itemId);
  };

  if (loadingList) return <p className="text-center text-muted-foreground py-8">Carregando...</p>;
  if (!list) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-list')}><ArrowLeft className="h-4 w-4 mr-1.5" />Voltar</Button>
        <Card className="border-border bg-card border-dashed"><CardContent className="py-12 text-center"><p className="text-muted-foreground">Lista não encontrada ou sem acesso.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/my-list')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{list.name}</h2>
            <div className="mt-1"><VisibilityBadge visibility={list.visibility} /></div>
          </div>
        </div>
        {isOwner && <ListSettingsDialog list={list} />}
      </div>

      {canEdit && (
        <section>
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Adicionar novo desejo
          </h3>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Nome do item *</Label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }} placeholder="Ex: Fone de ouvido Bluetooth" className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
                  {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Link (opcional)</Label>
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-secondary border-border text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="para_mim">🙋 Para mim</SelectItem>
                      <SelectItem value="para_casa">🏠 Para casa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">🎨 Tamanho / Cor (opcional)</Label>
                  <Input value={sizeColor} onChange={(e) => setSizeColor(e.target.value)} placeholder="Ex: M, azul marinho, 38" className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">📝 Observações (opcional)</Label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: prefiro a versão preta, qualquer marca serve" rows={2} className="flex w-full rounded-md border bg-secondary border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </div>
                <Button type="submit" className="w-full" disabled={addItem.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  {addItem.isPending ? 'Adicionando...' : 'Adicionar item'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Meus desejos
          {pending.length > 0 && <span className="text-sm font-normal text-muted-foreground">({pending.length})</span>}
        </h3>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : pending.length === 0 ? (
          <Card className="border-border bg-card border-dashed">
            <CardContent className="py-12 text-center">
              <Gift className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">Nenhum desejo pendente.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pending.map((item) => (
              <WishItemCard
                key={item.id}
                item={item}
                isOwner={canEdit}
                onDelete={canEdit ? handleDelete : undefined}
                onTogglePurchased={canEdit ? (itemId, value) => togglePurchased.mutate({ itemId, value }) : undefined}
                onEdit={canEdit ? (itemId, updates) => editItem.mutate({ itemId, updates }) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {canEdit && purchased.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            Já garantidos 🎉
            <span className="text-sm font-normal text-muted-foreground">({purchased.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {purchased.map((item) => (
              <WishItemCard
                key={item.id}
                item={item}
                isOwner={canEdit}
                onDelete={canEdit ? handleDelete : undefined}
                onTogglePurchased={canEdit ? (itemId, value) => togglePurchased.mutate({ itemId, value }) : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ListDetail;
