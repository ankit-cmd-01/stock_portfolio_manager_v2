const baseClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20 dark:bg-brand-500 dark:hover:bg-brand-600",
  secondary:
    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
};

function Button({ children, variant = "primary", className = "", type = "button", ...rest }) {
  return (
    <button type={type} className={`${baseClassName} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export default Button;
