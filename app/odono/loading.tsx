/** Esqueleto do superadmin — as páginas fazem várias consultas no servidor. */
export default function OdonoLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="skeleton h-7 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}
      </div>
      <div className="skeleton h-64 w-full" />
    </div>
  );
}
