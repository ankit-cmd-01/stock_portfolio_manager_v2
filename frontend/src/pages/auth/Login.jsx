import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, TrendingUp } from "lucide-react";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const marketCandles = [
    { left: "8%", height: "30%", wickTop: "16%", wickBottom: "18%", tone: "bull" },
    { left: "23%", height: "42%", wickTop: "10%", wickBottom: "20%", tone: "bear" },
    { left: "38%", height: "34%", wickTop: "18%", wickBottom: "14%", tone: "bull" },
    { left: "53%", height: "54%", wickTop: "8%", wickBottom: "16%", tone: "bull" },
    { left: "68%", height: "28%", wickTop: "22%", wickBottom: "12%", tone: "bear" },
    { left: "82%", height: "46%", wickTop: "12%", wickBottom: "18%", tone: "bull" },
  ];

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      rememberMe: Boolean(formData.get("remember")),
    };
    login(payload);
    navigate("/dashboard");
  };

  return (
    <div className="grid min-h-screen bg-slate-100 dark:bg-slate-950 lg:grid-cols-2">
      <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome Back</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Login to track and analyze your portfolio performance.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input id="email" name="email" type="email" label="Email" placeholder="you@example.com" required />
            <Input id="password" name="password" type="password" label="Password" placeholder="••••••••" required />

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Remember me
              </label>
              <button type="button" className="font-medium text-brand-600 hover:text-brand-700">
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full">
              Login <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Register
            </Link>
          </p>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-slate-900 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(53,99,233,0.45),transparent_30%),radial-gradient(circle_at_80%_60%,rgba(16,185,129,0.35),transparent_35%),linear-gradient(135deg,#0f172a,#111827)]" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 text-white">
          <p className="font-display text-3xl font-semibold leading-tight">
            Smarter investing starts with real-time portfolio intelligence.
          </p>
          <div className="relative mx-auto my-8 h-80 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-400/10 to-transparent" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:100%_25%,12.5%_100%]" />
            <div className="absolute left-6 right-6 top-10 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.24em] text-slate-300/80">
              <span>Live trend</span>
              <span>Market pulse</span>
            </div>
            <div className="absolute inset-x-10 bottom-12 top-20">
              <div className="absolute inset-x-0 bottom-10 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
              {marketCandles.map((candle, index) => (
                <div
                  key={`${candle.left}-${index}`}
                  className="absolute bottom-10"
                  style={{ left: candle.left, width: "9%" }}
                >
                  <div
                    className={`mx-auto w-px ${
                      candle.tone === "bull" ? "bg-emerald-300/90" : "bg-rose-300/90"
                    }`}
                    style={{ height: `calc(${candle.height} + ${candle.wickTop} + ${candle.wickBottom})` }}
                  />
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 rounded-md border ${
                      candle.tone === "bull"
                        ? "border-emerald-200/80 bg-emerald-300/75"
                        : "border-rose-200/80 bg-rose-300/75"
                    }`}
                    style={{
                      bottom: candle.wickBottom,
                      height: candle.height,
                      width: "60%",
                    }}
                  />
                </div>
              ))}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between text-xs text-slate-400">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-200">
              <TrendingUp />
            </div>
            <p className="text-sm text-slate-200">
              Monitor market movement, transaction behavior, and allocation trends in one unified dashboard.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Login;
