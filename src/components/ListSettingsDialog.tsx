import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/toast';
import { ToastAction } from '@/components/ui/toast';
import QueryError from '@/components/QueryError';
import { 
  Settings, Trash2, UserPlus, Eye, Pencil as PencilIcon, AlertTriangle, ArrowLeft,
  Gift, Cake, Heart, Sparkles, Plane, Home, Baby, GraduationCap, Gamepad2, ShoppingBag 
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { AVAILABLE_ICONS } from '@/pages/MyLists';

type WishList = Tables<'wish_lists'>;
type Profile = Tables<'profiles'>;
type Member = Tables<'wish_list_members'>;

// Armazenamento global dos timeouts de exclusão para persistir entre desmontagens de componente
const deleteTimeouts = new Map<string, NodeJS.Timeout>();

interface Props {
  list: WishList;
}

const ListSettingsDialog = ({ list }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(list.name);
  const [visibility, setVisibility] = useState(list.visibility);
  const [icon, setIcon] = useState(list.icon || 'gift');
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('viewer');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: profiles = [], isError: profilesError } = useQuery({
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
        .update({ 
          name: name.trim(), 
          visibility,
          icon 
        })
        .eq('id', list.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', list.id] });
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      toast({ title: '✅ Lista atualizada!' });
    },
    onError: (e: unknown) => toastError(e, 'Erro'),
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
    onError: (e: unknown) => toastError(e, 'Erro ao adicionar'),
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
    onError: (e: unknown) => toastError(e, 'Erro'),
  });

  const softDeleteList = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wish_lists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', list.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // 1. Fecha o diálogo e redireciona o usuário para o painel principal
      setOpen(false);
      navigate('/my-list');

      // 2. Atualização otimista na UI para remover a lista imediatamente da tela
      queryClient.setQueryData(['my-lists', user?.id], (old: WishList[] | undefined) => 
        old ? old.filter((l) => l.id !== list.id) : []
      );

      // 3. Mostra o Toast de contagem com opção de Desfazer (Lixeira de 7 dias ativa no banco)
      toast({
        title: '🗑️ Lista enviada para a lixeira',
        description: 'Você pode desfazer em até 10s ou recuperá-la na Lixeira em até 30 dias.',
        duration: 10000,
        action: (
          <ToastAction
            altText="Desfazer"
            onClick={async () => {
              const { error } = await supabase
                .from('wish_lists')
                .update({ deleted_at: null })
                .eq('id', list.id);
              if (error) {
                toast({
                  title: 'Erro ao restaurar',
                  description: error.message,
                  variant: 'destructive',
                });
              } else {
                toast({
                  title: '↩️ Lista restaurada',
                  description: `A lista "${list.name}" foi recuperada com sucesso.`,
                });
                queryClient.invalidateQueries({ queryKey: ['my-lists'] });
              }
            }}
          >
            Desfazer
          </ToastAction>
        ),
      });
    },
    onError: (e: unknown) => toastError(e, 'Erro ao excluir lista'),
  });

  const availableProfiles = profiles.filter((p) => !members.some((m) => m.user_id === p.user_id));

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setConfirmDelete(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1.5" />Configurações</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {confirmDelete ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">Tem certeza que deseja excluir?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground px-2">
               A exclusão da lista <strong>"{list.name}"</strong> enviará todos os desejos cadastrados nela para a lixeira. 
               Você terá até <strong>30 dias</strong> para recuperar a lista na Lixeira antes que ela seja apagada definitivamente do sistema.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => softDeleteList.mutate()} disabled={softDeleteList.isPending}>
                <Trash2 className="h-4 w-4 mr-1.5" /> {softDeleteList.isPending ? 'Excluindo...' : 'Sim, excluir'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configurações da lista</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              {/* Seletor de Ícones nas Configurações */}
              <div className="space-y-2">
                <Label>Ícone da Lista</Label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1">
                  {AVAILABLE_ICONS.map((item) => {
                    const TargetIcon = item.icon;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIcon(item.name)}
                        className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          icon === item.name 
                            ? 'border-primary bg-primary/10 text-primary scale-105 shadow-sm' 
                            : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                        title={item.label}
                      >
                        <TargetIcon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
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

                {profilesError ? (
                  <QueryError message="Não foi possível carregar a lista de perfis." />
                ) : members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {m.role === 'editor' ? <PencilIcon className="h-3.5 w-3.5 text-primary shrink-0" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="text-sm text-foreground truncate">{profileName(m.user_id)}</span>
                          <span className="text-xs text-muted-foreground">({m.role === 'editor' ? 'editor' : 'visualizador'})</span>
                        </div>
                        <button onClick={() => removeMember.mutate(m.id)} className="p-2 rounded text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma pessoa adicionada ainda.</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
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
                  <div className="w-full sm:w-32 space-y-1.5">
                    <Label className="text-xs">Papel</Label>
                    <Select value={addRole} onValueChange={setAddRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="icon" className="w-full sm:w-11" onClick={() => addMember.mutate()} disabled={!addUserId || addMember.isPending}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Zona de Perigo */}
              <div className="border-t border-destructive/20 pt-4 mt-6">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Zona de Perigo
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                       A exclusão desta lista enviará todos os desejos para a lixeira, onde podem ser recuperados por até 30 dias.
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Excluir esta lista
                  </Button>
                </div>
              </div>

            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ListSettingsDialog;
