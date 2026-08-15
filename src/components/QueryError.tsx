import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface QueryErrorProps {
  onRetry?: () => void;
  message?: string;
}

const QueryError = ({ onRetry, message }: QueryErrorProps) => (
  <Card className="border-border bg-card border-dashed">
    <CardContent className="py-12 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground font-medium">
          {message ?? 'Não foi possível carregar'}
        </p>
        <p className="text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </CardContent>
  </Card>
);

export default QueryError;
