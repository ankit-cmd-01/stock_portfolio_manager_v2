import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { X } from "lucide-react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed inset-y-0 left-0 z-20 hidden lg:flex">
        <Sidebar />
      </div>

      <Transition.Root show={isSidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setIsSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/70" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transform transition duration-300"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition duration-200"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative h-full w-72">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <X size={16} />
                </button>
                <Sidebar onNavigate={() => setIsSidebarOpen(false)} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <div className="lg:pl-72">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
