import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Heart, List, Users, LogOut, Sun, Moon, UserPen, Camera, Trash2 } from 'lucide-react';
import { compressAvatar } from '@/lib/compressImage';

const AppLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Estados para alteração de senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('wishlist-theme');
    if (saved === 'light') {
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Busca perfil atualizado do banco
  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Inicializa o form com dados do perfil
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  // Contagem de itens na lixeira (listas + itens órfãos excluídos do dono)
  const { data: trashCount = 0 } = useQuery({
    queryKey: ['trash-count', user?.id],
    queryFn: async () => {
      const [listsRes, itemsRes] = await Promise.all([
        supabase.from('wish_lists')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .not('deleted_at', 'is', null),
        supabase.from('wish_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .not('deleted_at', 'is', null),
      ]);
      if (listsRes.error) throw listsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return (listsRes.count ?? 0) + (itemsRes.count ?? 0);
    },
    enabled: !!user,
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('wishlist-theme', next);
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Valida tipo de conteúdo (não confiar só no atributo accept)
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione um arquivo de imagem (JPG, PNG, etc.).',
        variant: 'destructive',
      });
      return;
    }

    // Limite de 2MB no arquivo original (antes da compressão)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido para fotos é de 2MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      // Comprime/redimensiona no cliente (256×256 JPEG) antes do upload
      const compressed = await compressAvatar(file);
      const filePath = `${user!.id}/${Math.random()}.jpg`;

      // Envia a imagem comprimida para o storage bucket 'avatars' (RLS: só dono escreve em user_id/*)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      // Adquire a URL pública da imagem (bucket público — URL permanente)
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast({ title: '📸 Foto selecionada!', description: 'Lembre-se de salvar as alterações para aplicar.' });
    } catch (error: unknown) {
      toast({
        title: 'Erro no upload',
        description: (error instanceof Error ? error.message : null) || 'Erro inesperado ao enviar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Mutação para salvar perfil e senha
  const updateProfile = useMutation({
    mutationFn: async () => {
      // 1. Atualiza dados do perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
        })
        .eq('user_id', user!.id);
      if (profileError) throw profileError;

      // 2. Se digitou uma nova senha, faz o update
      if (newPassword.trim()) {
        if (newPassword !== confirmPassword) {
          throw new Error('As senhas digitadas não coincidem.');
        }
        if (newPassword.length < 6) {
          throw new Error('A nova senha deve possuir pelo menos 6 caracteres.');
        }
        
        const { error: authError } = await supabase.auth.updateUser({
          password: newPassword.trim(),
        });
        if (authError) throw authError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] });
      toast({ title: '✅ Perfil atualizado com sucesso!' });
      setProfileOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e: unknown) => toast({ title: 'Erro ao salvar', description: e instanceof Error ? e.message : 'Erro inesperado.', variant: 'destructive' }),
  });

  const displayUser = profile?.display_name || user?.email?.split('@')[0] || 'Usuário';
  const displayAvatar = profile?.avatar_url || '';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-foreground">WishList</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Perfil & Nome */}
            <div 
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 cursor-pointer hover:bg-secondary/40 px-2 py-1.5 rounded-lg transition-colors group"
            >
              <Avatar className="h-8 w-8 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all shrink-0">
                <AvatarImage src={displayAvatar} alt={displayUser} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {displayUser.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground hidden sm:inline max-w-[120px] truncate">
                {displayUser}
              </span>
            </div>

            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}>
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 overflow-x-auto">
          <NavLink
            to="/my-list"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <List className="h-4 w-4" />
            Minhas Listas
          </NavLink>
          <NavLink
            to="/browse"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Users className="h-4 w-4" />
            Ver Listas
          </NavLink>
          <NavLink
            to="/trash"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Trash2 className="h-4 w-4" />
            Lixeira
            {trashCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                {trashCount}
              </span>
            )}
          </NavLink>
        </div>
      </nav>

      <main className="flex-1 mx-auto w-full max-w-7xl p-4">
        <Outlet />
      </main>

      {/* Modal de Configuração do Perfil */}
      <Dialog open={profileOpen} onOpenChange={(val) => { setProfileOpen(val); if (!val) { setNewPassword(''); setConfirmPassword(''); } }}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPen className="h-5 w-5 text-primary" /> Editar Perfil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            
            {/* Clique no Avatar para Fazer Upload */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div 
                  onClick={handleAvatarClick}
                  className="relative cursor-pointer group rounded-full ring-4 ring-primary/20 overflow-hidden h-24 w-24 flex items-center justify-center bg-secondary hover:ring-primary transition-all shadow-sm shrink-0"
                  title="Clique para carregar uma imagem"
                >
                  <Avatar className="h-full w-full">
                    <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {displayName.substring(0, 2).toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Overlay no Hover e Efeito de Carregando */}
                  <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity duration-200 ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {uploading ? (
                      <span className="text-[10px] font-semibold animate-pulse text-center px-1">Enviando...</span>
                    ) : (
                      <>
                        <Camera className="h-6 w-6 mb-1 text-primary-foreground" />
                        <span className="text-[10px] font-semibold">Alterar Foto</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground text-center">
                  Tamanho máximo: <strong>2MB</strong> · imagens são comprimidas automaticamente
                </span>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileUpload} 
              />

              <div className="w-full space-y-2">
                <Label>Nome de Exibição</Label>
                <Input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="Seu nome no app" 
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            </div>

            {/* Nova Seção de Segurança: Alterar Senha */}
            <div className="border-t border-border pt-4 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground block">Segurança (Alterar Senha)</Label>
              
              <div className="space-y-1">
                <Label className="text-[11px]">Nova Senha</Label>
                <Input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Confirmar Nova Senha</Label>
                <Input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={() => updateProfile.mutate()} 
              disabled={updateProfile.isPending || uploading || !displayName.trim()}
            >
              {updateProfile.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLayout;
