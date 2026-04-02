import { Suspense } from 'react';
import { CameraClient } from '@/components/admin/camera-client';

export const metadata = { title: 'Câmera ao Vivo — Safe Door' };

export default function CameraPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="text-muted-foreground text-sm">Carregando câmera...</div>
        </div>
      }
    >
      <CameraClient />
    </Suspense>
  );
}
