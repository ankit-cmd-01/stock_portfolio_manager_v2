import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Menu as MenuIcon, Settings as SettingsIcon, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MarketTicker from "./MarketTicker";
import ToggleTheme from "./ui/ToggleTheme";

function Navbar({ onMenuClick }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 sm:px-6 lg:px-8">
      <div className="flex w-full flex-wrap items-center gap-3 lg:flex-nowrap">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200 lg:hidden"
          aria-label="Open sidebar"
        >
          <MenuIcon size={18} />
        </button>

        <div className="order-3 min-w-0 basis-full overflow-hidden sm:order-2 sm:flex-1 sm:basis-auto">
          <MarketTicker />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:order-3 sm:gap-3 lg:ml-4">
          <ToggleTheme />
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Settings"
          >
            <SettingsIcon size={18} />
          </button>

          <Menu as="div" className="relative">
            <Menu.Button className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <User size={18} />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-soft focus:outline-none dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 border-b border-slate-100 px-2 pb-2 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name || "Guest"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || "not signed in"}</p>
                </div>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={logout}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      Logout
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
