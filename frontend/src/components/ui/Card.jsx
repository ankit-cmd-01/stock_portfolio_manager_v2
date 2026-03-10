function Card({ children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}

export default Card;
