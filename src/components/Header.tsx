type HeaderProps = {
  title: string;
  subtitle: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
        Atualizar
      </button>
    </header>
  );
}
