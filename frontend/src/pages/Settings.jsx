import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";

function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Account access controls only.
        </p>
      </div>

      <Card className="space-y-5">
        <div>
          <p className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">Logout</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Signed in as {user?.email || "current user"}. Use this to end the current session on this browser.
          </p>
        </div>

        <Button variant="outline" onClick={logout} className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
          Logout
        </Button>
      </Card>
    </div>
  );
}

export default Settings;
