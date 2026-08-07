interface SectionTitleProps {
  children: React.ReactNode;
  id?: string;
}

export function SectionTitle({ children, id }: SectionTitleProps) {
  return (
    <h2
      id={id}
      className="text-xl font-semibold text-warm-800 mb-4"
    >
      {children}
    </h2>
  );
}
