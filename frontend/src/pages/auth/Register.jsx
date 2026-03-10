import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const marketCandles = [
    { left: "10%", height: "32%", wickTop: "14%", wickBottom: "18%", tone: "bull" },
    { left: "24%", height: "44%", wickTop: "8%", wickBottom: "16%", tone: "bear" },
    { left: "39%", height: "30%", wickTop: "18%", wickBottom: "12%", tone: "bull" },
    { left: "54%", height: "56%", wickTop: "10%", wickBottom: "18%", tone: "bull" },
    { left: "69%", height: "26%", wickTop: "22%", wickBottom: "12%", tone: "bear" },
    { left: "83%", height: "40%", wickTop: "12%", wickBottom: "16%", tone: "bull" },
  ];

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
    };
    register(payload);
    navigate("/dashboard");
  };

  return (
    <div className="grid min-h-screen bg-slate-100 dark:bg-slate-950 lg:grid-cols-2">
      <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <p className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Create Account</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Build your portfolio workspace and start tracking your investments.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input id="name" name="name" label="Full Name" placeholder="John Investor" required />
            <Input id="email" name="email" type="email" label="Email" placeholder="you@example.com" required />
            <Input id="password" name="password" type="password" label="Password" placeholder="••••••••" required />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              required
            />
            <Button type="submit" className="w-full">
              Register <ArrowRight size={16} />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Login
            </Link>
          </p>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-slate-900 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(53,99,233,0.5),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.35),transparent_30%),linear-gradient(135deg,#020617,#0f172a)]" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 text-white">
          <div className="relative mx-auto my-8 h-80 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-400/10 to-transparent" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:100%_25%,12.5%_100%]" />
            <div className="absolute left-6 right-6 top-10 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.24em] text-slate-300/80">
              <span>Market setup</span>
              <span>Growth watch</span>
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
                    className={`mx-auto w-px ${candle.tone === "bull" ? "bg-emerald-300/90" : "bg-rose-300/90"}`}
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
          <div className="mx-2 rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur">
            <p className="font-display text-2xl font-semibold text-white">One Platform. Full Market Visibility.</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Create watchlists, analyze allocation performance, and keep your portfolio strategy aligned with data.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Register;
