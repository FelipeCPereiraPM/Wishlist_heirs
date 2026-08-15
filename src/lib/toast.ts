import { toast } from '@/hooks/use-toast';

// Helper para exibir erros de mutation/query com consistência.
// Elimina a duplicação do padrão onError: (e) => toast({ ... }) repetido pelo código.
export const toastError = (e: unknown, title = 'Erro') => {
  toast({
    title,
    description: e instanceof Error ? e.message : 'Erro inesperado.',
    variant: 'destructive',
  });
};
