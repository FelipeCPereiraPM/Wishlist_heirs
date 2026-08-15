import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

const mockOnAuthStateChange = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => {
        mockOnAuthStateChange(...args);
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      },
      getSession: () => mockGetSession(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicia em estado de carregamento sem usuário", () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockGetSession.mockReturnValue(
      Promise.resolve({ data: { session: null } })
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("carrega usuário quando há sessão ativa", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token" };

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockGetSession.mockReturnValue(
      Promise.resolve({ data: { session: mockSession } })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    });

    expect(result.current.user?.id).toBe("user-123");
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.loading).toBe(false);
  });

  it("expira loading para false mesmo sem sessão", async () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockGetSession.mockReturnValue(
      Promise.resolve({ data: { session: null } })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it("signOut chama supabase.auth.signOut", async () => {
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockGetSession.mockReturnValue(
      Promise.resolve({ data: { session: null } })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.signOut).toBeDefined();
  });

  it("lança erro quando usado fora do AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within AuthProvider"
    );
    spy.mockRestore();
  });
});
