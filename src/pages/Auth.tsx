import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Heart } from 'lucide-react';
import { authSchema, forgotSchema, type AuthValues, type ForgotValues } from '@/lib/authValidation';

type Mode = 'login' | 'register' | 'forgot';

const Auth = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Schema dinâmico conforme o modo. Forgot usa só e-mail; login/register usam e-mail+senha.
  const resolver = zodResolver(mode === 'forgot' ? forgotSchema : authSchema);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthValues & ForgotValues>({ resolver });

  const onSubmit = async (values: AuthValues & ForgotValues) => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: 'Cadastro realizado!',
          description: 'Verifique seu e-mail para confirmar a conta.',
        });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: 'E-mail enviado!',
          description: 'Verifique sua caixa de entrada para redefinir a senha.',
        });
        setMode('login');
      }
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

  const switchMode = (next: Mode) => {
    setMode(next);
    reset();
  };

  const titleText = mode === 'login' ? 'Entre na sua conta' : mode === 'register' ? 'Crie uma nova conta' : 'Recuperar senha';
  const submitText = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Cadastrar' : 'Enviar link';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Heart className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">WishList</CardTitle>
          <CardDescription className="text-muted-foreground">{titleText}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
                aria-invalid={!!errors.email}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            {mode !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Senha</Label>
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
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : submitText}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="block w-full py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu a senha?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="block w-full py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Não tem conta? Cadastre-se
                </button>
              </>
            )}
            {mode === 'register' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="block w-full py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Já tem conta? Faça login
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="block w-full py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Voltar para o login
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
