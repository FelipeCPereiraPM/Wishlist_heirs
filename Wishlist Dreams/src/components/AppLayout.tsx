import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Heart, List, Users, LogOut } from 'lucide-react';

const AppLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = user?.email?.split('@')[0] ?? 'Usuário';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-foreground">WishList</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Olá, <span className="text-foreground font-medium">{displayName}</span>
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-4xl gap-1 px-4">
          <NavLink
            to="/my-list"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <List className="h-4 w-4" />
            Minhas Listas
          </NavLink>
          <NavLink
            to="/browse"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Users className="h-4 w-4" />
            Ver Listas
          </NavLink>
        </div>
      </nav>

      <main className="flex-1 mx-auto w-full max-w-4xl p-4">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
