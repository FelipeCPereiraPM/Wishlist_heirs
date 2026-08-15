import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteItemDialogProps {
  open: boolean;
  itemName: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

const DeleteItemDialog = ({
  open, itemName, onOpenChange, onConfirm, isPending,
}: DeleteItemDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle>Remover item?</AlertDialogTitle>
        <AlertDialogDescription>
          {itemName ? (
            <>O item <strong className="text-foreground">"{itemName}"</strong> será enviado para a lixeira. Você pode desfazer agora ou recuperá-lo na Lixeira em até 30 dias.</>
          ) : (
            <>Este item será enviado para a lixeira. Você pode desfazer agora ou recuperá-lo na Lixeira em até 30 dias.</>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => { e.preventDefault(); onConfirm(); }}
          disabled={isPending}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isPending ? 'Removendo...' : 'Sim, remover'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DeleteItemDialog;
