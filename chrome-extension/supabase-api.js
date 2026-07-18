const SUPABASE_URL = "https://uyzrkibtcpkdflhmommm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5enJraWJ0Y3BrZGZsaG1vbW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTUzMjQsImV4cCI6MjA5NTYzMTMyNH0.dcM4otVzznwdRYqYBvHjOpJpSqOKj1aBECU9Nb4_68E";

const SupabaseAPI = {
  // Autenticação com e-mail e senha
  async signIn(email, password) {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error_description || errData.error || "Erro de autenticação");
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        user: data.user
      };
    } catch (error) {
      throw error;
    }
  },

  // Obter listas de desejos do usuário autenticado
  async getWishLists(accessToken) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/wish_lists?select=*&order=name.asc`, {
        method: "GET",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar listas de desejos");
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Adicionar item à lista
  async addWishItem(accessToken, { userId, listId, name, link, category, sizeColor, notes }) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/wish_items`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          user_id: userId,
          list_id: listId,
          name: name,
          link: link || null,
          category: category || "para_mim",
          size_color: sizeColor || null,
          notes: notes || null,
          purchased: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Erro ao adicionar item à lista");
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
};
