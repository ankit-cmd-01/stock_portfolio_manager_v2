function Input({ label, id, type = "text", className = "", ...rest }) {
  return (
    <div className="space-y-2">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type={type}
        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${className}`}
        {...rest}
      />
    </div>
  );
}

export default Input;
