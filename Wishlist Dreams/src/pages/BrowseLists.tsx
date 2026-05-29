import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Users, ListChecks, ChevronRight } from 'lucide-react';
import { VisibilityBadge } from '@/lib/listVisibility';
import type { Tables } from '@/integrations/supabase/types';

type WishList = Tables<'wish_lists'>;
type Profile = Tables<'profiles'>;

const BrowseLists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // RLS returns only lists we can view: public ones + those shared with us.
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['browsable-lists', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wish_lists')
        .select('*')
        .neq('owner_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WishList[];
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user,
  });

  const ownerName = (uid: string) => profiles.find((p) => p.user_id === uid)?.display_name || 'Usuário';

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        Listas disponíveis
      </h2>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : lists.length === 0 ? (
        <Card className="border-border bg-card border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhuma lista pública ou compartilhada com você ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lists.map((list) => (
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
                    <span className="text-xs text-muted-foreground truncate">de {ownerName(list.owner_id)}</span>
                    <VisibilityBadge visibility={list.visibility} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowseLists;
