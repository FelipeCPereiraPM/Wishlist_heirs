import { Lock, Globe, Users } from 'lucide-react';

export type Visibility = 'private' | 'public' | 'specific';

export const visibilityMeta: Record<Visibility, { label: string; icon: typeof Lock; emoji: string }> = {
  private: { label: 'Privada', icon: Lock, emoji: '🔒' },
  public: { label: 'Pública', icon: Globe, emoji: '🌍' },
  specific: { label: 'Específica', icon: Users, emoji: '👥' },
};

export const VisibilityBadge = ({ visibility }: { visibility: string }) => {
  const meta = visibilityMeta[(visibility as Visibility)] ?? visibilityMeta.private;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
};
