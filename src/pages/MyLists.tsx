import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, ListChecks, ChevronRight } from 'lucide-react';
import { VisibilityBadge } from '@/lib/listVisibility';
import type { Tables } from '@/integrations/supabase/types';

type WishList = Tables<'wish_lists'>;

const MyLists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [nameError, setNameError] = useState('');

  // Lists where I'm owner
  const { data: ownedLists = [] } = useQuery({
    queryKey: ['my-lists', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_lists')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WishList[];
    },
    enabled: !!user,
  });

  // Lists where I'm an editor member
  const { data: editorMemberships = [] } = useQuery({
    queryKey: ['my-editor-memberships', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_list_members')
        .select('list_id, role, wish_lists(*)')
        .eq('user_id', user!.id)
        .eq('role', 'editor');
      if (error) throw error;
      return ((data ?? []) as { wish_lists: WishList | null }[]).map((m) => m.wish_lists).filter(Boolean) as WishList[];
    },
    enabled: !!user,
  });

  const sharedWithMe = editorMemberships.filter((l) => l.owner_id !== user?.id);

  const createList = useMutation({
    mutationFn: async () => {
      // Ensure we have a fresh, valid session so auth.uid() is set on the server (RLS)
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;
      if (!currentUserId) {
        throw new Error('Sua sessão expirou. Faça login novamente para criar uma lista.');
      }
      const { data, error } = await supabase.rpc('create_wish_list' as never, {
        _name: name.trim(),
        _visibility: visibility,
      } as never);
      if (error) throw error;
      if (!data) throw new Error('Não foi possível criar a lista. Tente novamente.');
      return data as string;
    },
    onSuccess: (listId) => {
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setOpen(false);
      setName('');
      setVisibility('public');
      setNameError('');
      toast({ title: '✨ Lista criada!' });
      navigate(`/list/${listId}`);
    },
    onError: (e: unknown) => toast({ title: 'Erro ao criar lista', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' }),
  });

  const handleCreate = () => {
    if (!name.trim()) {
      setNameError('O nome da lista é obrigatório.');
      return;
    }
    createList.mutate();
  };

  const renderCard = (list: WishList, shared = false) => (
    <Card
      key={list.id}
      className="border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => navigate(`/list/${list.id}`)}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
          <ListChecks className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">{list.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <VisibilityBadge visibility={list.visibility} />
            {shared && <span className="text-xs text-muted-foreground">Compartilhada</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          Minhas listas
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Nova lista</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova lista</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome da lista *</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                  placeholder="Ex: Aniversário, Casa nova..."
                />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">🌍 Pública — todos no app podem ver</SelectItem>
                    <SelectItem value="private">🔒 Privada — só você vê</SelectItem>
                    <SelectItem value="specific">👥 Específica — perfis escolhidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createList.isPending} className="w-full">
                {createList.isPending ? 'Criando...' : 'Criar lista'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {ownedLists.length === 0 ? (
        <Card className="border-border bg-card border-dashed">
          <CardContent className="py-12 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Você ainda não tem listas.</p>
            <p className="text-sm text-muted-foreground mt-1">Crie sua primeira lista acima!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ownedLists.map((l) => renderCard(l))}
        </div>
      )}

      {sharedWithMe.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-foreground">Compartilhadas comigo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sharedWithMe.map((l) => renderCard(l, true))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MyLists;
