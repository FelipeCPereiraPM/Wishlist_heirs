import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Heart } from 'lucide-react';

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: 'Cadastro realizado!',
          description: 'Verifique seu e-mail para confirmar a conta.',
        });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: 'E-mail enviado!',
          description: 'Verifique sua caixa de entrada para redefinir a senha.',
        });
        setMode('login');
        setPassword('');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {mode !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
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
                  onClick={() => setMode('forgot')}
                  className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu a senha?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Não tem conta? Cadastre-se
                </button>
              </>
            )}
            {mode === 'register' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Já tem conta? Faça login
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
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
