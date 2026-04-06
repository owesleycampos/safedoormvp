import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
