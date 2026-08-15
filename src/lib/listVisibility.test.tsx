import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { visibilityMeta, VisibilityBadge, type Visibility } from "@/lib/listVisibility";

describe("visibilityMeta", () => {
  it("contém metadados para todas as visibilidades", () => {
    const keys = Object.keys(visibilityMeta) as Visibility[];
    expect(keys).toEqual(expect.arrayContaining(["private", "public", "specific"]));
    expect(keys).toHaveLength(3);
  });

  it("cada entrada tem label, ícone e emoji", () => {
    for (const key of Object.keys(visibilityMeta) as Visibility[]) {
      const meta = visibilityMeta[key];
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon).toBeDefined();
      expect(typeof meta.emoji).toBe("string");
    }
  });
});

describe("VisibilityBadge", () => {
  it("renderiza o rótulo correto para visibilidade pública", () => {
    render(<VisibilityBadge visibility="public" />);
    expect(screen.getByText("Pública")).toBeInTheDocument();
  });

  it("renderiza o rótulo correto para visibilidade privada", () => {
    render(<VisibilityBadge visibility="private" />);
    expect(screen.getByText("Privada")).toBeInTheDocument();
  });

  it("renderiza o rótulo correto para visibilidade específica", () => {
    render(<VisibilityBadge visibility="specific" />);
    expect(screen.getByText("Específica")).toBeInTheDocument();
  });

  it("cai para o padrão 'Privada' quando a visibilidade é desconhecida", () => {
    render(<VisibilityBadge visibility="unknown" />);
    expect(screen.getByText("Privada")).toBeInTheDocument();
  });
});
