export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full overflow-y-auto bg-neo-bg" data-admin-shell>
      {children}
    </div>
  );
}
