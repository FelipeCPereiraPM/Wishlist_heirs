import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Settings, Trash2, UserPlus, Eye, Pencil as PencilIcon } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type WishList = Tables<'wish_lists'>;
type Profile = Tables<'profiles'>;
type Member = Tables<'wish_list_members'>;

interface Props {
  list: WishList;
}

const ListSettingsDialog = ({ list }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(list.name);
  const [visibility, setVisibility] = useState(list.visibility);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('viewer');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user!.id)
        .order('display_name');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: open,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['list-members', list.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_list_members')
        .select('*')
        .eq('list_id', list.id);
      if (error) throw error;
      return data as Member[];
    },
    enabled: open,
  });

  const profileName = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name || 'Usuário';

  const saveDetails = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wish_lists')
        .update({ name: name.trim(), visibility })
        .eq('id', list.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', list.id] });
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      toast({ title: '✅ Lista atualizada!' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wish_list_members')
        .insert({ list_id: list.id, user_id: addUserId, role: addRole });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-members', list.id] });
      setAddUserId('');
      setAddRole('viewer');
      toast({ title: '👥 Membro adicionado!' });
    },
    onError: (e: any) => toast({ title: 'Erro ao adicionar', description: e.message, variant: 'destructive' }),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wish_list_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-members', list.id] });
      toast({ title: 'Membro removido.' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const availableProfiles = profiles.filter((p) => !members.some((m) => m.user_id === p.user_id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1.5" />Configurações</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações da lista</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Visibilidade</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">🌍 Pública — todos no app podem ver</SelectItem>
                <SelectItem value="private">🔒 Privada — só você (e editores) vê</SelectItem>
                <SelectItem value="specific">👥 Específica — perfis escolhidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending} size="sm" className="w-full">
            {saveDetails.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>

          <div className="border-t border-border pt-4 space-y-3">
            <Label className="text-foreground">
              Pessoas com acesso
              {visibility === 'public' && <span className="block text-xs font-normal text-muted-foreground mt-1">A lista é pública — todos já podem ver. Adicione editores para colaborar.</span>}
            </Label>

            {members.length > 0 ? (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.role === 'editor' ? <PencilIcon className="h-3.5 w-3.5 text-primary shrink-0" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="text-sm text-foreground truncate">{profileName(m.user_id)}</span>
                      <span className="text-xs text-muted-foreground">({m.role === 'editor' ? 'editor' : 'visualizador'})</span>
                    </div>
                    <button onClick={() => removeMember.mutate(m.id)} className="p-1 rounded text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma pessoa adicionada ainda.</p>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Adicionar perfil</Label>
                <Select value={addUserId} onValueChange={setAddUserId}>
                  <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                  <SelectContent>
                    {availableProfiles.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum perfil disponível</div>
                    ) : availableProfiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || 'Usuário'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-1.5">
                <Label className="text-xs">Papel</Label>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="icon" onClick={() => addMember.mutate()} disabled={!addUserId || addMember.isPending}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListSettingsDialog;
