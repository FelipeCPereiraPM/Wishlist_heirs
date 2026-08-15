import { z } from 'zod';

// Schema de e-mail reutilizável
const emailField = z
  .string()
  .min(1, 'O e-mail é obrigatório.')
  .email('E-mail inválido. Verifique o formato (ex: seu@email.com).');

// Schema de senha reutilizável
const passwordField = z
  .string()
  .min(6, 'A senha deve ter pelo menos 6 caracteres.');

// Login e Cadastro usam os mesmos campos (e-mail + senha)
export const authSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type AuthValues = z.infer<typeof authSchema>;

// Esqueci a senha: só precisa do e-mail
export const forgotSchema = z.object({
  email: emailField,
});

export type ForgotValues = z.infer<typeof forgotSchema>;

// Redefinir senha: senha + confirmação
export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
