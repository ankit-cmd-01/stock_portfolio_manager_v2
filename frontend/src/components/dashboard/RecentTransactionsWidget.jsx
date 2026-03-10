import Card from "../ui/Card";

function RecentTransactionsWidget({ transactions, className = "" }) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Latest portfolio activity and unrealized movement</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="py-3 font-medium">Asset</th>
              <th className="py-3 font-medium">Action</th>
              <th className="py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((transaction) => (
              <tr key={`${transaction.stock}-${transaction.date}-${transaction.amount}`}>
                <td className="py-3 font-medium text-slate-800 dark:text-slate-100">{transaction.stock}</td>
                <td className="py-3 text-slate-500 dark:text-slate-400">{transaction.action}</td>
                <td className="py-3 text-slate-500 dark:text-slate-400">{transaction.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default RecentTransactionsWidget;
