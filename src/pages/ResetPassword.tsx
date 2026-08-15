import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Heart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/authValidation';

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  // 'checking' = ainda aguardando o evento de recuperação; 'valid' = link válido; 'invalid' = sem recuperação
  const [recoveryState, setRecoveryState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    // O link de recuperação dispara um evento PASSWORD_RECOVERY no Supabase.
    // Só aceitamos o formulário quando esse evento chega — qualquer sessão prévia não conta.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryState('valid');
      }
    });

    // Timeout de segurança: se nenhum evento chegar em 3s, consideramos o link inválido.
    const timeout = setTimeout(() => {
      setRecoveryState((prev) => (prev === 'checking' ? 'invalid' : prev));
    }, 3000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSubmit = async (values: ResetPasswordValues) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;

      toast({
        title: 'Senha atualizada!',
        description: 'Sua senha foi redefinida com sucesso.',
      });

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (recoveryState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Verificando link de recuperação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRecovery = recoveryState === 'valid';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Heart className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {isRecovery ? 'Nova senha' : 'Redefinir senha'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isRecovery
              ? 'Digite sua nova senha abaixo'
              : 'Link de recuperação inválido ou expirado'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecovery ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  aria-invalid={!!errors.confirmPassword}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                O link de recuperação é válido por pouco tempo. Solicite um novo link na tela de login.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
