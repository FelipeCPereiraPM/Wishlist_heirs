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
import { toastError } from '@/lib/toast';
import { ToastAction } from '@/components/ui/toast';
import QueryError from '@/components/QueryError';
import { Plus, Gift, PartyPopper, ArrowLeft } from 'lucide-react';
import WishItemCard from '@/components/WishItemCard';
import ListSettingsDialog from '@/components/ListSettingsDialog';
import DeleteItemDialog from '@/components/DeleteItemDialog';
import { VisibilityBadge } from '@/lib/listVisibility';
import { getListIcon } from './MyLists';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

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
  const [filter, setFilter] = useState<'all' | 'para_mim' | 'para_casa'>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const listQuery = useQuery({
    queryKey: ['list', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('wish_lists').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as WishList | null;
    },
    enabled: !!id,
  });
  const list = listQuery.data;
  const loadingList = listQuery.isLoading;

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

  const itemsQuery = useQuery({
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
  const items = itemsQuery.data ?? [];
  const isLoading = itemsQuery.isLoading;

  const pending = items.filter((i) => !i.purchased);
  const purchased = items.filter((i) => i.purchased);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['list-items', id] });
    queryClient.invalidateQueries({ queryKey: ['trash-count'] });
  };

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
    onError: (e: unknown) => toastError(e, 'Erro ao adicionar'),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      // Soft-delete: marca como removido. A retenção de 30 dias é feita por um cron no banco.
      const { error } = await supabase
        .from('wish_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, itemId) => {
      // Remoção otimista imediata da UI
      queryClient.setQueryData<WishItem[]>(['list-items', id], (old) =>
        old ? old.filter((i) => i.id !== itemId) : []
      );
      // Atualiza o badge da lixeira na navegação
      queryClient.invalidateQueries({ queryKey: ['trash-count'] });
      toast({
        title: '🗑️ Item enviado para a lixeira',
        description: 'Você pode desfazer agora ou recuperá-lo na Lixeira em até 30 dias.',
        duration: 10000,
        action: (
          <ToastAction
            altText="Desfazer"
            onClick={async () => {
              const { error } = await supabase
                .from('wish_items')
                .update({ deleted_at: null })
                .eq('id', itemId);
              if (error) {
                toast({ title: 'Erro ao restaurar', description: error.message, variant: 'destructive' });
              } else {
                toast({ title: '↩️ Item restaurado.' });
                invalidate();
              }
            }}
          >
            Desfazer
          </ToastAction>
        ),
      });
    },
    onError: (e: unknown) => toastError(e, 'Erro ao remover'),
  });

  const togglePurchased = useMutation({
    mutationFn: async ({ itemId, value }: { itemId: string; value: boolean }) => {
      const { error } = await supabase.from('wish_items').update({ purchased: value }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, { value }) => { invalidate(); toast({ title: value ? '🎉 Marcado como comprado!' : '↩️ Status revertido.' }); },
    onError: (e: unknown) => toastError(e, 'Erro ao atualizar'),
  });

  const editItem = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: TablesUpdate<'wish_items'> }) => {
      const { error } = await supabase.from('wish_items').update(updates).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: '✏️ Item atualizado!' }); },
    onError: (e: unknown) => toastError(e, 'Erro ao editar'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError('O nome do item é obrigatório.'); return; }
    setNameError('');
    addItem.mutate();
  };

  const handleDelete = (itemId: string, itemName: string) => {
    setDeleteTarget({ id: itemId, name: itemName });
  };

  if (loadingList) return <p className="text-center text-muted-foreground py-8">Carregando...</p>;
  if (listQuery.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-list')}><ArrowLeft className="h-4 w-4 mr-1.5" />Voltar</Button>
        <QueryError onRetry={() => listQuery.refetch()} message="Não foi possível carregar a lista." />
      </div>
    );
  }
  if (!list) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-list')}><ArrowLeft className="h-4 w-4 mr-1.5" />Voltar</Button>
        <Card className="border-border bg-card border-dashed"><CardContent className="py-12 text-center"><p className="text-muted-foreground">Lista não encontrada ou sem acesso.</p></CardContent></Card>
      </div>
    );
  }

  const filteredPending = pending.filter((i) => filter === 'all' || i.category === filter);
  const filteredPurchased = purchased.filter((i) => filter === 'all' || i.category === filter);

  const ListIcon = getListIcon(list.icon);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate('/my-list')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <ListIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{list.name}</h2>
            <div className="mt-1"><VisibilityBadge visibility={list.visibility} /></div>
          </div>
        </div>
        {isOwner && <ListSettingsDialog list={list} />}
      </div>

      {/* Grid Layout: Left (Items + Filters) | Right (Add Wish Form) */}
      <div className={`grid grid-cols-1 ${canEdit ? 'md:grid-cols-12' : ''} gap-4 md:gap-8 items-start`}>
        
        {/* LADO ESQUERDO: Filtros e Itens (Aparece embaixo no mobile, na esquerda no desktop) */}
        <div className={`${canEdit ? 'md:col-span-8 order-2 md:order-1' : 'w-full'} space-y-6`}>
          
          {/* Barra de Filtros */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-muted-foreground block">Filtrar categoria</Label>
            <div className="flex flex-wrap gap-2 p-1 bg-secondary/50 rounded-lg border border-border/40 w-fit">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                ✨ Todos
              </button>
              <button
                onClick={() => setFilter('para_mim')}
                className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  filter === 'para_mim'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                🙋 Para mim
              </button>
              <button
                onClick={() => setFilter('para_casa')}
                className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  filter === 'para_casa'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                🏠 Para casa
              </button>
            </div>
          </div>

          {/* Lista de Desejos */}
          <div className="space-y-8">
            {/* Desejos Pendentes */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Meus desejos
                {filteredPending.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">({filteredPending.length})</span>
                )}
              </h3>

              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : filteredPending.length === 0 ? (
                <Card className="border-border bg-card border-dashed">
                  <CardContent className="py-12 text-center">
                    <Gift className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Nenhum desejo encontrado nesta categoria.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredPending.map((item) => (
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

            {/* Já Garantidos */}
            {canEdit && filteredPurchased.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  Já garantidos 🎉
                  <span className="text-sm font-normal text-muted-foreground">({filteredPurchased.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredPurchased.map((item) => (
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
        </div>

        {/* LADO DIREITO: Formulário de Cadastro (Aparece no topo no mobile, na direita no desktop) */}
        {canEdit && (
          <div className="md:col-span-4 order-1 md:order-2 md:sticky md:top-6 space-y-6">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Adicionar novo desejo
            </h3>
            <Card className="border-border bg-card shadow-md">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Nome do item *</Label>
                    <Input
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                      placeholder="Ex: Fone de ouvido Bluetooth"
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    />
                    {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Link (opcional)</Label>
                    <Input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://..."
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-secondary border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="para_mim">🙋 Para mim</SelectItem>
                        <SelectItem value="para_casa">🏠 Para casa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">🎨 Tamanho / Cor (opcional)</Label>
                    <Input
                      value={sizeColor}
                      onChange={(e) => setSizeColor(e.target.value)}
                      placeholder="Ex: M, azul marinho, 38"
                      className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">📝 Observações (opcional)</Label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: prefiro a versão preta, qualquer marca serve"
                      rows={2}
                      className="flex w-full resize-y min-h-[80px] rounded-md border bg-secondary border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <Button type="submit" className="w-full shadow-sm" disabled={addItem.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    {addItem.isPending ? 'Adicionando...' : 'Adicionar item'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <DeleteItemDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => {
          if (deleteTarget) deleteItem.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        isPending={deleteItem.isPending}
      />
    </div>
  );
};

export default ListDetail;
