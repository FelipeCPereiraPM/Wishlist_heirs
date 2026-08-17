import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/toast';
import { Trash2, RotateCcw, AlertTriangle, ExternalLink } from 'lucide-react';
import QueryError from '@/components/QueryError';
import { faviconUrl, isValidImageUrl } from '@/lib/productImage';
import { getListIcon } from './MyLists';
import type { Tables } from '@/integrations/supabase/types';

type WishList = Tables<'wish_lists'>;
type WishItem = Tables<'wish_items'>;

const PURGE_DAYS = 30;

const daysLeft = (deletedAt: string) => {
  const deleted = new Date(deletedAt).getTime();
  const purgeAt = deleted + PURGE_DAYS * 24 * 60 * 60 * 1000;
  const ms = purgeAt - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

const Trash = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmListId, setConfirmListId] = useState<string | null>(null);

  const trashedListsQuery = useQuery({
    queryKey: ['trash-lists', user?.id],
    queryFn: async () => {
      // RLS "Owner can view own trashed lists" retorna só as excluídas do dono
      const { data, error } = await supabase
        .from('wish_lists')
        .select('*')
        .eq('owner_id', user!.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data as WishList[];
    },
    enabled: !!user,
  });
  const trashedLists = trashedListsQuery.data ?? [];
  const isLoading = trashedListsQuery.isLoading;

  // Itens excluídos cujas listas ainda estão ativas (itens órfãos na lixeira).
  const orphanItemsQuery = useQuery({
    queryKey: ['trash-items', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_items')
        .select('*')
        .eq('user_id', user!.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data as WishItem[];
    },
    enabled: !!user,
  });
  const orphanItems = orphanItemsQuery.data ?? [];

  const restoreList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('wish_lists')
        .update({ deleted_at: null })
        .eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-lists'] });
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      queryClient.invalidateQueries({ queryKey: ['trash-count'] });
      toast({ title: '↩️ Lista restaurada!' });
    },
    onError: (e: unknown) => toastError(e, 'Erro ao restaurar'),
  });

  const purgeList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from('wish_lists').delete().eq('id', listId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-lists'] });
      setConfirmListId(null);
      toast({ title: '🗑️ Lista excluída definitivamente.' });
    },
    onError: (e: unknown) => toastError(e, 'Erro ao excluir'),
  });

  const restoreItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('wish_items')
        .update({ deleted_at: null })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-items'] });
      queryClient.invalidateQueries({ queryKey: ['trash-count'] });
      queryClient.invalidateQueries({ queryKey: ['list-items'] });
      toast({ title: '↩️ Item restaurado!' });
    },
    onError: (e: unknown) => toastError(e, 'Erro ao restaurar'),
  });

  const purgeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('wish_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-items'] });
      queryClient.invalidateQueries({ queryKey: ['trash-count'] });
      setConfirmId(null);
      toast({ title: '🗑️ Item excluído definitivamente.' });
    },
    onError: (e: unknown) => toastError(e, 'Erro ao excluir'),
  });

  const empty = trashedLists.length === 0 && orphanItems.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Trash2 className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lixeira</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Itens e listas excluídos ficam aqui por {PURGE_DAYS} dias antes de serem apagados definitivamente.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : trashedListsQuery.isError || orphanItemsQuery.isError ? (
        <QueryError
          onRetry={() => { trashedListsQuery.refetch(); orphanItemsQuery.refetch(); }}
          message="Não foi possível carregar a lixeira."
        />
      ) : empty ? (
        <Card className="border-border bg-card border-dashed">
          <CardContent className="py-12 text-center">
            <Trash2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">A lixeira está vazia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Listas excluídas (inclui seus itens via cascade na hora do purge) */}
          {trashedLists.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Listas excluídas</h3>
              <div className="space-y-3">
                {trashedLists.map((list) => {
                  const ListIcon = getListIcon(list.icon);
                  return (
                    <Card key={list.id} className="border-border bg-card">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                              <ListIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{list.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Será apagada em {daysLeft(list.deleted_at!)} dia{daysLeft(list.deleted_at!) === 1 ? '' : 's'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreList.mutate(list.id)}
                              disabled={restoreList.isPending}
                            >
                              <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
                            </Button>
                            {confirmListId === list.id ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => purgeList.mutate(list.id)}
                                disabled={purgeList.isPending}
                              >
                                <AlertTriangle className="h-4 w-4 mr-1.5" /> Confirmar
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmListId(list.id)}
                              >
                                <Trash2 className="h-4 w-4" /> Excluir
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Itens excluídos cujas listas ainda estão ativas */}
          {orphanItems.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Itens excluídos</h3>
              <div className="space-y-3">
                {orphanItems.map((item) => (
                  <Card key={item.id} className="border-border bg-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {(isValidImageUrl(item.image_url) || isValidImageUrl(faviconUrl(item.link))) && (
                            <img
                              src={isValidImageUrl(item.image_url) ? item.image_url! : faviconUrl(item.link)!}
                              alt=""
                              className="h-16 w-16 object-cover rounded-md border border-border shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              Será apagado em {daysLeft(item.deleted_at!)} dia{daysLeft(item.deleted_at!) === 1 ? '' : 's'}
                            </p>
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" /> Ver produto
                              </a>
                            )}
                          </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreItem.mutate(item.id)}
                            disabled={restoreItem.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
                          </Button>
                          {confirmId === item.id ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => purgeItem.mutate(item.id)}
                              disabled={purgeItem.isPending}
                            >
                              <AlertTriangle className="h-4 w-4 mr-1.5" /> Confirmar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmId(item.id)}
                            >
                              <Trash2 className="h-4 w-4" /> Excluir
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default Trash;
