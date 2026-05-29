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
import { 
  Plus, ListChecks, ChevronRight,
  Plane, Briefcase, Palmtree, Smartphone, Laptop, Gamepad2,
  Sofa, Key, ShoppingBag, Dumbbell, Bike, BookOpen, Palette, Camera,
  Coffee, Utensils, GraduationCap, Backpack, PawPrint, Heart, ShoppingCart
} from 'lucide-react';
import { VisibilityBadge } from '@/lib/listVisibility';
import type { Tables } from '@/integrations/supabase/types';

type WishList = Tables<'wish_lists'>;

// Lista de ícones disponíveis extraídos da imagem de referência (excluindo bússola e adicionando carrinho de compras)
export const AVAILABLE_ICONS = [
  { name: 'plane', icon: Plane, label: '✈️ Viagem / Avião' },
  { name: 'briefcase', icon: Briefcase, label: '💼 Mala de Viagem' },
  { name: 'palmtree', icon: Palmtree, label: '🌴 Férias / Praia' },
  { name: 'shopping-cart', icon: ShoppingCart, label: '🛒 Carrinho de compras' },
  { name: 'smartphone', icon: Smartphone, label: '📱 Celular / Tech' },
  { name: 'laptop', icon: Laptop, label: '💻 Computador / Notebook' },
  { name: 'gamepad-2', icon: Gamepad2, label: '🎮 Games / Lazer' },
  { name: 'sofa', icon: Sofa, label: '🛋️ Decoração / Sofá' },
  { name: 'key', icon: Key, label: '🔑 Casa Nova / Chaves' },
  { name: 'shopping-bag', icon: ShoppingBag, label: '🛍️ Moda / Compras' },
  { name: 'dumbbell', icon: Dumbbell, label: '🏋️ Academia / Treino' },
  { name: 'bike', icon: Bike, label: '🚲 Ciclismo / Bicicleta' },
  { name: 'book-open', icon: BookOpen, label: '📖 Leitura / Livro' },
  { name: 'palette', icon: Palette, label: '🎨 Arte / Paleta' },
  { name: 'camera', icon: Camera, label: '📷 Fotografia / Câmera' },
  { name: 'coffee', icon: Coffee, label: '☕ Café / Bebidas' },
  { name: 'utensils', icon: Utensils, label: '🍽️ Gastronomia / Talheres' },
  { name: 'graduation-cap', icon: GraduationCap, label: '🎓 Formatura' },
  { name: 'backpack', icon: Backpack, label: '🎒 Escola / Mochila' },
  { name: 'paw-print', icon: PawPrint, label: '🐾 Pets / Patinha' },
  { name: 'heart', icon: Heart, label: '❤️ Favoritos' },
];

export const getListIcon = (iconName: string | null) => {
  const match = AVAILABLE_ICONS.find(i => i.name === iconName);
  return match ? match.icon : ListChecks;
};

const MyLists = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [icon, setIcon] = useState('gift');
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
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;
      if (!currentUserId) {
        throw new Error('Sua sessão expirou. Faça login novamente para criar uma lista.');
      }
      
      // Cria a lista diretamente inserindo na tabela para aceitar o campo customizado 'icon'
      const { data, error } = await supabase
        .from('wish_lists')
        .insert({
          name: name.trim(),
          visibility,
          icon,
          owner_id: currentUserId,
        } as any)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Não foi possível criar a lista. Tente novamente.');
      return data.id as string;
    },
    onSuccess: (listId) => {
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setOpen(false);
      setName('');
      setVisibility('public');
      setIcon('gift');
      setNameError('');
      toast({ title: '✨ Lista criada com sucesso!' });
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

  const renderCard = (list: WishList, shared = false) => {
    const IconComponent = getListIcon((list as any).icon);
    
    return (
      <Card
        key={list.id}
        className="border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
        onClick={() => navigate(`/list/${list.id}`)}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <IconComponent className="h-5 w-5 text-primary" />
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
  };

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

              {/* Seletor de Ícones */}
              <div className="space-y-2">
                <Label>Ícone da Lista</Label>
                <div className="grid grid-cols-7 gap-2 pt-1">
                  {AVAILABLE_ICONS.map((item) => {
                    const TargetIcon = item.icon;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIcon(item.name)}
                        className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          icon === item.name 
                            ? 'border-primary bg-primary/10 text-primary scale-105 font-medium shadow-sm' 
                            : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                        title={item.label}
                      >
                        <TargetIcon className="h-5 w-5" />
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
