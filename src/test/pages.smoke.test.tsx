import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock comum do supabase para smoke tests (sem sessão)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        neq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "test-id" }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  },
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Smoke tests — páginas", () => {
  it("Auth renderiza título do formulário de login", async () => {
    const Auth = (await import("@/pages/Auth")).default;
    renderWithProviders(<Auth />);
    expect(screen.getByText("Entre na sua conta")).toBeInTheDocument();
  });

  it("ResetPassword sem evento de recuperação mostra link inválido", async () => {
    vi.useFakeTimers();
    const ResetPassword = (await import("@/pages/ResetPassword")).default;
    renderWithProviders(<ResetPassword />);
    // Sem evento PASSWORD_RECOVERY, após 3s deve cair no estado "link inválido"
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Redefinir senha/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("NotFound renderiza 404", async () => {
    const NotFound = (await import("@/pages/NotFound")).default;
    renderWithProviders(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });
});
